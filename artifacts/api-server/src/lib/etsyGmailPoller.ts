import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { pool } from "@workspace/db";
import { logger } from "./logger";

export interface EtsyOrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface EtsyOrder {
  id: string;
  orderId: string;
  orderNumber: string;
  customer: string;
  customerEmail: string;
  shippingAddress: string;
  items: EtsyOrderItem[];
  total: number;
  shipping: number;
  date: string;
  timestamp: number;
  platform: string;
  fromEtsy: boolean;
  status: string;
  gmailMessageId: string;
  notes: string;
}

export const pendingEtsyOrders: EtsyOrder[] = [];
export let lastSyncAt: number | null = null;
export let lastSyncError: string | null = null;
export let isPolling = false;

const POLL_INTERVAL_MS = 5 * 60 * 1000;
let _pollerTimer: NodeJS.Timeout | null = null;
const _inMemoryMessageIds = new Set<string>();
let _firstRunAt: Date | null = null;

async function initDb(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS etsy_gmail_imports (
        id         SERIAL PRIMARY KEY,
        message_id TEXT UNIQUE NOT NULL,
        order_number TEXT,
        imported_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS etsy_gmail_config (
        key        TEXT PRIMARY KEY,
        value      TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    logger.info("Etsy Gmail DB tables ready");
  } catch (err) {
    logger.warn({ err }, "Etsy Gmail DB init failed — falling back to in-memory dedup");
  }
}

async function getFirstRunAt(): Promise<Date> {
  if (_firstRunAt) return _firstRunAt;
  try {
    const res = await pool.query(
      `SELECT value FROM etsy_gmail_config WHERE key = 'first_run_at'`
    );
    if (res.rows.length > 0) {
      _firstRunAt = new Date(res.rows[0].value as string);
      return _firstRunAt;
    }
  } catch (_) {}
  const now = new Date();
  _firstRunAt = now;
  try {
    await pool.query(
      `INSERT INTO etsy_gmail_config (key, value)
       VALUES ('first_run_at', $1)
       ON CONFLICT (key) DO NOTHING`,
      [now.toISOString()]
    );
  } catch (_) {}
  return now;
}

async function isMessageImported(messageId: string): Promise<boolean> {
  if (_inMemoryMessageIds.has(messageId)) return true;
  try {
    const res = await pool.query(
      `SELECT 1 FROM etsy_gmail_imports WHERE message_id = $1 LIMIT 1`,
      [messageId]
    );
    return res.rows.length > 0;
  } catch (_) {
    return false;
  }
}

async function markMessageImported(messageId: string, orderNumber: string): Promise<void> {
  _inMemoryMessageIds.add(messageId);
  try {
    await pool.query(
      `INSERT INTO etsy_gmail_imports (message_id, order_number)
       VALUES ($1, $2)
       ON CONFLICT (message_id) DO NOTHING`,
      [messageId, orderNumber]
    );
  } catch (_) {}
}

async function updateLastSyncAt(): Promise<void> {
  lastSyncAt = Date.now();
  try {
    await pool.query(
      `INSERT INTO etsy_gmail_config (key, value)
       VALUES ('last_sync_at', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [new Date().toISOString()]
    );
  } catch (_) {}
}

function parseOrderNumber(subject: string, text: string): string {
  let m = subject.match(/#(\d{5,})/);
  if (m) return m[1];
  m = text.match(/order\s*#\s*(\d{5,})/i);
  if (m) return m[1];
  m = text.match(/order\s+number[:\s]+#?(\d{5,})/i);
  if (m) return m[1];
  m = subject.match(/(\d{9,})/);
  if (m) return m[1];
  return "";
}

function parseBuyerName(text: string): string {
  let m = text.match(/new order from\s+([A-Z][a-zA-Z''-]+(?:\s+[A-Z][a-zA-Z''-]+)+)/);
  if (m) return m[1].trim();
  m = text.match(/buyer[:\s]+([A-Za-z][a-zA-Z''-]+(?:\s+[A-Za-z][a-zA-Z''-]+)+)/i);
  if (m) return m[1].trim();
  m = text.match(/sold to[:\s]+([A-Za-z][a-zA-Z''-]+(?:\s+[A-Za-z][a-zA-Z''-]+)+)/i);
  if (m) return m[1].trim();
  m = text.match(/ship(?:ping)?\s+to[:\s]*\n([A-Za-z][a-zA-Z''\- ]{2,40})\n/i);
  if (m) return m[1].trim();
  return "Etsy Customer";
}

function parseTotal(text: string): number {
  let m = text.match(/order\s+total[:\s]+\$?([\d,]+\.?\d*)/i);
  if (m) return parseFloat(m[1].replace(/,/g, ""));
  m = text.match(/total[:\s]+\$?([\d,]+\.?\d*)/i);
  if (m) return parseFloat(m[1].replace(/,/g, ""));
  const all = [...text.matchAll(/\$\s*([\d,]+\.\d{2})/g)].map(
    (x) => parseFloat(x[1].replace(/,/g, ""))
  );
  return all.length ? Math.max(...all) : 0;
}

function parseShipping(text: string): number {
  const m = text.match(/shipping[:\s]+\$?([\d,]+\.?\d*)/i);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}

function parseItems(text: string): EtsyOrderItem[] {
  const items: EtsyOrderItem[] = [];
  const lineRe = /([A-Za-z][^\n$×xX]{4,80?}?)\s*(?:×|x|qty[:\s]*|quantity[:\s]*)(\d+)\s*(?:[–—-]\s*)?\$?([\d,]+\.?\d*)/gi;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(text)) !== null) {
    const name = m[1].trim().replace(/\s+/g, " ").replace(/[,:]+$/, "");
    const qty = parseInt(m[2]);
    const price = parseFloat(m[3].replace(/,/g, ""));
    if (name.length >= 3 && qty > 0 && price > 0 && !name.match(/total|shipping|tax|discount|subtotal/i)) {
      items.push({ name, qty, price });
    }
  }
  if (items.length === 0) {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 3);
    for (const line of lines) {
      const pm = line.match(/\$\s*([\d,]+\.\d{2})/);
      if (pm && line.length < 120 && !line.match(/total|shipping|tax|discount|subtotal|order|invoice/i)) {
        const price = parseFloat(pm[1].replace(/,/g, ""));
        const name = line.replace(/\$[\d,.]+/, "").replace(/^\s*[-–•·]\s*/, "").trim().replace(/\s+/g, " ");
        if (name.length >= 3 && price > 0) {
          items.push({ name, qty: 1, price });
        }
      }
    }
  }
  return items;
}

function parseShippingAddress(text: string): string {
  let m = text.match(/ship(?:ping)?\s+(?:to|address)[:\s]*\n([\s\S]{10,300?}?)(?:\n\s*\n|\nOrder|\nTotal|$)/i);
  if (m) {
    return m[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join(", ");
  }
  return "";
}

function parseEtsyEmail(
  subject: string,
  textBody: string,
  htmlBody: string,
  messageId: string,
  date: Date
): EtsyOrder | null {
  const text =
    textBody ||
    htmlBody
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s{2,}/g, " ")
      .replace(/ \n/g, "\n");

  const orderNumber = parseOrderNumber(subject, text);
  if (!orderNumber) {
    logger.warn({ subject, messageId }, "Etsy Gmail: could not parse order number — skipping");
    return null;
  }

  const buyer = parseBuyerName(text);
  const total = parseTotal(text);
  const shipping = parseShipping(text);
  const items = parseItems(text);
  const shippingAddress = parseShippingAddress(text);

  if (items.length === 0) {
    if (total > 0) {
      items.push({ name: `Etsy Order #${orderNumber}`, qty: 1, price: total });
    } else {
      logger.warn({ subject, messageId, orderNumber }, "Etsy Gmail: could not parse items — skipping");
      return null;
    }
  }

  return {
    id: `etsy-${orderNumber}-${Date.now()}`,
    orderId: `#${orderNumber}`,
    orderNumber: `#${orderNumber}`,
    customer: buyer,
    customerEmail: "",
    shippingAddress,
    items,
    total: total || items.reduce((s, i) => s + i.price * i.qty, 0),
    shipping,
    date: date.toISOString().split("T")[0],
    timestamp: date.getTime(),
    platform: "Etsy",
    fromEtsy: true,
    status: "pending",
    gmailMessageId: messageId,
    notes: "",
  };
}

async function pollGmail(): Promise<void> {
  const user = process.env.ETSY_GMAIL_ADDRESS;
  const pass = process.env.ETSY_GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    logger.warn("Etsy Gmail: ETSY_GMAIL_ADDRESS or ETSY_GMAIL_APP_PASSWORD not set — skipping poll");
    return;
  }

  const firstRunAt = await getFirstRunAt();

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    const since = new Date(firstRunAt);
    since.setHours(0, 0, 0, 0);

    const uids = await client.search({
      from: "transaction@etsy.com",
      subject: "New Etsy Order",
      since,
    });

    logger.info(
      { count: uids.length, since: since.toISOString() },
      "Etsy Gmail: search complete"
    );

    let imported = 0;
    for (const uid of uids) {
      let msgSource: Buffer | undefined;
      try {
        const fetched = await client.fetchOne(String(uid), { source: true });
        msgSource = fetched?.source as Buffer | undefined;
      } catch (err) {
        logger.warn({ err, uid }, "Etsy Gmail: failed to fetch message — skipping");
        continue;
      }
      if (!msgSource) continue;

      let parsed;
      try {
        parsed = await simpleParser(msgSource);
      } catch (err) {
        logger.warn({ err, uid }, "Etsy Gmail: failed to parse message — skipping");
        continue;
      }

      const messageId = parsed.messageId ?? `uid-${uid}`;

      if (await isMessageImported(messageId)) continue;

      const subject = parsed.subject ?? "";
      const textBody = parsed.text ?? "";
      const htmlBody = (typeof parsed.html === "string" ? parsed.html : "") ?? "";
      const date = parsed.date ?? new Date();

      const order = parseEtsyEmail(subject, textBody, htmlBody, messageId, date);
      if (!order) {
        await markMessageImported(messageId, "");
        continue;
      }

      await markMessageImported(messageId, order.orderNumber);
      pendingEtsyOrders.push(order);
      imported++;

      logger.info(
        { orderNumber: order.orderNumber, customer: order.customer, total: order.total },
        "Etsy Gmail: order imported"
      );

      const discordUrl = process.env.DISCORD_WEBHOOK_ORDERS;
      if (discordUrl) {
        try {
          const itemLines = order.items
            .map((i) => `  • ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""} — $${i.price.toFixed(2)}`)
            .join("\n");
          await fetch(discordUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `🟠 **New Etsy Order**\nOrder: **${order.orderNumber}**\nCustomer: ${order.customer}\nTotal: **$${order.total.toFixed(2)}**\n${itemLines}`,
            }),
          });
        } catch (_) {}
      }
    }

    if (imported > 0) {
      logger.info({ imported }, "Etsy Gmail: poll complete");
    }

    await updateLastSyncAt();
    lastSyncError = null;
  } catch (err) {
    lastSyncError = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, "Etsy Gmail: poll failed — will retry next cycle");
  } finally {
    try {
      await client.logout();
    } catch (_) {}
  }
}

export async function startEtsyGmailPoller(): Promise<void> {
  await initDb();
  logger.info("Etsy Gmail poller started");
  setTimeout(async () => {
    await pollGmail();
    _pollerTimer = setInterval(pollGmail, POLL_INTERVAL_MS);
  }, 15_000);
}

export async function triggerEtsyGmailPoll(): Promise<{ imported: number }> {
  if (isPolling) return { imported: 0 };
  isPolling = true;
  const before = pendingEtsyOrders.length;
  try {
    await pollGmail();
  } finally {
    isPolling = false;
  }
  return { imported: pendingEtsyOrders.length - before };
}
