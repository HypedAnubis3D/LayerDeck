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
        id           SERIAL PRIMARY KEY,
        message_id   TEXT UNIQUE NOT NULL,
        order_number TEXT,
        order_json   JSONB,
        imported_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Add order_json column if it doesn't exist yet (migration)
    await pool.query(`
      ALTER TABLE etsy_gmail_imports ADD COLUMN IF NOT EXISTS order_json JSONB
    `).catch(() => {});
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

async function markMessageImported(messageId: string, orderNumber: string, order?: EtsyOrder): Promise<void> {
  _inMemoryMessageIds.add(messageId);
  try {
    await pool.query(
      `INSERT INTO etsy_gmail_imports (message_id, order_number, order_json)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id) DO UPDATE SET order_json = COALESCE($3, etsy_gmail_imports.order_json)`,
      [messageId, orderNumber, order ? JSON.stringify(order) : null]
    );
  } catch (_) {}
}

export async function getStoredEtsyOrders(): Promise<EtsyOrder[]> {
  try {
    const res = await pool.query<{ order_json: EtsyOrder }>(
      `SELECT order_json FROM etsy_gmail_imports
       WHERE order_json IS NOT NULL
       ORDER BY imported_at DESC
       LIMIT 200`
    );
    return res.rows.map(r => r.order_json);
  } catch (_) {
    return [];
  }
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

function isInPersonPayment(subject: string): boolean {
  return /in-person payment/i.test(subject);
}

function parseOrderNumber(subject: string, text: string): string {
  // Subject format: "You made a sale - [$39.58, Order #4012648759]"
  let m = subject.match(/Order\s*#(\d{5,})/i);
  if (m) return m[1];
  // Subject format: "In-person payment confirmation: $0.01 (4022653986)"
  m = subject.match(/\((\d{9,})\)/);
  if (m) return m[1];
  m = subject.match(/#(\d{5,})/);
  if (m) return m[1];
  m = text.match(/order\s*(?:number\s*[:\s]+)?#?\s*(\d{9,})/i);
  if (m) return m[1];
  m = text.match(/order\s*#\s*(\d{5,})/i);
  if (m) return m[1];
  m = subject.match(/(\d{9,})/);
  if (m) return m[1];
  return "";
}

function parseTotalFromSubject(subject: string): number {
  // "You made a sale on Etsy - Ship by Apr 22 - [$75.25, Order #4023336732]"
  const m = subject.match(/\[\$?([\d,]+\.?\d*)/);
  if (m) return parseFloat(m[1].replace(/,/g, ""));
  // "In-person payment confirmation: $0.01 (4022653986)"
  const m2 = subject.match(/\$\s*([\d,]+\.?\d*)/);
  if (m2) return parseFloat(m2[1].replace(/,/g, ""));
  return 0;
}

const _BAD_NAME_WORDS = /^(did|not|leave|note|the|and|for|from|your|order|item|shop|etsy|view|payment|invoice|ship|shipping|please|you|we|our|buyer|seller|hi|hello|dear|congratulations|processing|finished|method|cash|paypal)$/i;

function _isValidName(s: string): boolean {
  if (!s || s.length < 2 || s.length > 50) return false;
  const words = s.trim().split(/\s+/);
  if (words.length < 2) return false;
  // Reject if any word looks like a non-name stopword
  if (words.some(w => _BAD_NAME_WORDS.test(w))) return false;
  // Reject if contains digits or common punctuation other than hyphens/apostrophes
  if (/[0-9@_]/.test(s)) return false;
  return true;
}

function parseBuyerName(text: string): string {
  const candidates: string[] = [];
  let m: RegExpMatchArray | null;

  // "new order from John Smith" or "from jux1dmqx" — skip usernames (no space = username)
  m = text.match(/new order from\s+([A-Za-z][a-zA-Z'' -]{1,40})/i);
  if (m && m[1].includes(" ")) candidates.push(m[1].trim());

  // "Sold by... Bought by John Smith"
  m = text.match(/bought by[:\s]+([A-Za-z][a-zA-Z'' -]{2,40})/i);
  if (m) candidates.push(m[1].trim());

  // Shipping "To:\nJohn Smith\n..."
  m = text.match(/ship(?:ping)?\s+to[:\s]*\n([A-Za-z][a-zA-Z'' \-]{2,40})\n/i);
  if (m) candidates.push(m[1].trim());

  // "order from <Name>" in the body
  m = text.match(/order for [0-9]+ items? from ([a-zA-Z][a-zA-Z0-9_]+)\./i);
  // ^ skip: that's the Etsy username, not a real name

  for (const c of candidates) {
    if (_isValidName(c)) return c;
  }
  return "Etsy Customer";
}

function parseTotal(subject: string, text: string): number {
  // First try the subject line — most reliable for Etsy emails
  const fromSubject = parseTotalFromSubject(subject);
  if (fromSubject > 0) return fromSubject;
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
  const total = parseTotal(subject, text);
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

    // Always look back 30 days — message-ID dedup in etsy_gmail_imports prevents double-imports
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    // Search only by sender — subject varies ("New Etsy Order", "You have a new order", etc.)
    // Subject filtering is done in parseEtsyEmail via order-number extraction
    const uids = await client.search({
      from: "transaction@etsy.com",
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

      const subject = parsed.subject ?? "";
      const textBody = parsed.text ?? "";
      const htmlBody = (typeof parsed.html === "string" ? parsed.html : "") ?? "";
      const date = parsed.date ?? new Date();

      // Skip in-person payment confirmation emails — those are convention/POS sales
      if (isInPersonPayment(subject)) {
        logger.info({ subject, messageId }, "Etsy Gmail: skipping in-person payment email");
        await markMessageImported(messageId, "");
        continue;
      }

      const alreadyDone = await isMessageImported(messageId);

      const order = parseEtsyEmail(subject, textBody, htmlBody, messageId, date);
      if (!order) {
        await markMessageImported(messageId, "");
        continue;
      }

      await markMessageImported(messageId, order.orderNumber, order);

      if (!alreadyDone) {
        pendingEtsyOrders.push(order);
      } else {
        // Already in DB but push again so frontend can pick it up if it missed it
        // (frontend dedup by gmailMessageId prevents double-display)
        if (!pendingEtsyOrders.some(o => o.gmailMessageId === order.gmailMessageId)) {
          pendingEtsyOrders.push(order);
        }
      }
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

export async function debugEtsyGmailInbox(): Promise<object[]> {
  const user = process.env.ETSY_GMAIL_ADDRESS;
  const pass = process.env.ETSY_GMAIL_APP_PASSWORD;
  if (!user || !pass) return [{ error: "ETSY_GMAIL_ADDRESS or ETSY_GMAIL_APP_PASSWORD not set" }];

  const client = new ImapFlow({
    host: "imap.gmail.com", port: 993, secure: true,
    auth: { user, pass }, logger: false,
  });

  const results: object[] = [];
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    // Look back 30 days to catch anything
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const uids = await client.search({ from: "transaction@etsy.com", since });
    results.push({ info: `Found ${uids.length} emails from transaction@etsy.com in last 30 days` });

    for (const uid of uids.slice(-20)) { // last 20 at most
      try {
        const fetched = await client.fetchOne(String(uid), { envelope: true, source: true });
        const parsed = await (await import("mailparser")).simpleParser(fetched.source as Buffer);
        const alreadyImported = await isMessageImported(parsed.messageId ?? `uid-${uid}`);
        const orderNumMatch = parseOrderNumber(parsed.subject ?? "", parsed.text ?? "");
        results.push({
          uid,
          subject: parsed.subject,
          from: parsed.from?.text,
          date: parsed.date?.toISOString(),
          messageId: parsed.messageId,
          alreadyImported,
          parsedOrderNumber: orderNumMatch || "(could not parse)",
          textPreview: (parsed.text ?? "").slice(0, 300).replace(/\s+/g, " "),
        });
      } catch (e) {
        results.push({ uid, error: String(e) });
      }
    }
  } catch (e) {
    results.push({ error: String(e) });
  } finally {
    try { await client.logout(); } catch (_) {}
  }
  return results;
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
