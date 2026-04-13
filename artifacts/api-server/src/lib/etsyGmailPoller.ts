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
  shop?: string; // 'ha3d' | 'dioscuri'
}

interface ShopConfig {
  shopId: string;   // 'ha3d' | 'dioscuri'
  shopLabel: string; // 'HypedAnubis3D' | 'Dioscuri&Co'
  user: string;
  pass: string;
}

export const pendingEtsyOrders: EtsyOrder[] = [];
export let lastSyncAt: number | null = null;
export let lastSyncError: string | null = null;
export let isPolling = false;

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const _pollerTimers: NodeJS.Timeout[] = [];

// Per-account in-memory message ID dedup: shopId → Set<messageId>
const _inMemoryMessageIds = new Map<string, Set<string>>();
// Discord notified: Set<`${shopId}:${orderNumber}`> — survives DB resyncs
const _discordNotifiedOrders = new Set<string>();
// Per-account first_run_at cache
const _firstRunAtCache = new Map<string, Date>();
// Active shop configs — set by startEtsyGmailPoller, used by resync/trigger
let _activeConfigs: ShopConfig[] = [];

function getAccountSet(shopId: string): Set<string> {
  if (!_inMemoryMessageIds.has(shopId)) _inMemoryMessageIds.set(shopId, new Set());
  return _inMemoryMessageIds.get(shopId)!;
}

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

async function getFirstRunAt(shopId: string): Promise<Date> {
  if (_firstRunAtCache.has(shopId)) return _firstRunAtCache.get(shopId)!;
  const dbKey = `first_run_at_${shopId}`;
  try {
    // Check account-specific key first
    let res = await pool.query(
      `SELECT value FROM etsy_gmail_config WHERE key = $1`,
      [dbKey]
    );
    if (res.rows.length > 0) {
      const d = new Date(res.rows[0].value as string);
      _firstRunAtCache.set(shopId, d);
      return d;
    }
    // Backward compat: fall back to legacy 'first_run_at' key for ha3d
    if (shopId === "ha3d") {
      res = await pool.query(
        `SELECT value FROM etsy_gmail_config WHERE key = 'first_run_at'`
      );
      if (res.rows.length > 0) {
        const d = new Date(res.rows[0].value as string);
        _firstRunAtCache.set(shopId, d);
        // Migrate to new key
        await pool.query(
          `INSERT INTO etsy_gmail_config (key, value)
           VALUES ($1, $2)
           ON CONFLICT (key) DO NOTHING`,
          [dbKey, res.rows[0].value]
        ).catch(() => {});
        return d;
      }
    }
  } catch (_) {}
  // First time — record today as start date
  const now = new Date();
  _firstRunAtCache.set(shopId, now);
  try {
    await pool.query(
      `INSERT INTO etsy_gmail_config (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [dbKey, now.toISOString()]
    );
  } catch (_) {}
  return now;
}

async function isMessageImported(shopId: string, messageId: string): Promise<boolean> {
  const set = getAccountSet(shopId);
  if (set.has(messageId)) return true;
  // DB key is prefixed to ensure per-account isolation
  const dbKey = `${shopId}:${messageId}`;
  try {
    const res = await pool.query(
      `SELECT 1 FROM etsy_gmail_imports WHERE message_id = $1 LIMIT 1`,
      [dbKey]
    );
    if (res.rows.length > 0) {
      set.add(messageId);
      return true;
    }
  } catch (_) {}
  // Legacy ha3d records stored without prefix — check plain messageId too
  if (shopId === "ha3d") {
    try {
      const res = await pool.query(
        `SELECT 1 FROM etsy_gmail_imports WHERE message_id = $1 LIMIT 1`,
        [messageId]
      );
      if (res.rows.length > 0) {
        set.add(messageId);
        return true;
      }
    } catch (_) {}
  }
  return false;
}

async function markMessageImported(
  shopId: string,
  messageId: string,
  orderNumber: string,
  order?: EtsyOrder
): Promise<void> {
  getAccountSet(shopId).add(messageId);
  const dbKey = `${shopId}:${messageId}`;
  try {
    await pool.query(
      `INSERT INTO etsy_gmail_imports (message_id, order_number, order_json)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id) DO UPDATE SET order_json = COALESCE($3, etsy_gmail_imports.order_json)`,
      [dbKey, orderNumber, order ? JSON.stringify(order) : null]
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
  let m = subject.match(/Order\s*#(\d{5,})/i);
  if (m) return m[1];
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
  const m = subject.match(/\[\$?([\d,]+\.?\d*)/);
  if (m) return parseFloat(m[1].replace(/,/g, ""));
  const m2 = subject.match(/\$\s*([\d,]+\.?\d*)/);
  if (m2) return parseFloat(m2[1].replace(/,/g, ""));
  return 0;
}

const _BAD_NAME_WORDS = /^(did|not|leave|note|the|and|for|from|your|order|item|shop|etsy|view|payment|invoice|ship|shipping|please|you|we|our|buyer|seller|hi|hello|dear|congratulations|processing|finished|method|cash|paypal)$/i;

function _isValidName(s: string): boolean {
  if (!s || s.length < 2 || s.length > 50) return false;
  const words = s.trim().split(/\s+/);
  if (words.length < 2) return false;
  if (words.some(w => _BAD_NAME_WORDS.test(w))) return false;
  if (/[0-9@_]/.test(s)) return false;
  return true;
}

function parseBuyerName(text: string): string {
  const spanM = text.match(/<span class=['"]name['"]>([^<]+)<\/span>/i);
  if (spanM) {
    const n = spanM[1].trim();
    if (_isValidName(n)) return n;
  }

  const candidates: string[] = [];
  let m: RegExpMatchArray | null;

  m = text.match(/new order from\s+([A-Za-z][a-zA-Z'' -]{1,40})/i);
  if (m && m[1].includes(" ")) candidates.push(m[1].trim());

  m = text.match(/bought by[:\s]+([A-Za-z][a-zA-Z'' -]{2,40})/i);
  if (m) candidates.push(m[1].trim());

  m = text.match(/ship(?:ping)?\s+to[:\s]*\n([A-Za-z][a-zA-Z'' \-]{2,40})\n/i);
  if (m) candidates.push(m[1].trim());

  for (const c of candidates) {
    if (_isValidName(c)) return c;
  }
  return "Etsy Customer";
}

function parseTotal(subject: string, text: string): number {
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

  const decodeEntities = (s: string) => s
    .replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
  const itemNames = Array.from(text.matchAll(/^Item:\s{2,}(.+)/gm)).map(m2 => decodeEntities(m2[1].trim().replace(/\s+/g, " ")));
  const quantities = Array.from(text.matchAll(/^Quantity:\s{2,}(\d+)/gm)).map(m2 => parseInt(m2[1]));
  const itemPrices = Array.from(text.matchAll(/^Item price:\s{2,}\$?([\d,]+\.?\d*)/gm)).map(m2 => parseFloat(m2[1].replace(/,/g, "")));
  const count = Math.min(itemNames.length, quantities.length, itemPrices.length);
  for (let i = 0; i < count; i++) {
    const name = itemNames[i];
    const qty = quantities[i] || 1;
    const price = itemPrices[i];
    if (name.length >= 3 && qty > 0 && price > 0 && !name.match(/delivery fee|retail delivery|sales tax|gift card|refund|discount/i)) {
      items.push({ name, qty, price });
    }
  }
  if (items.length > 0) return items;

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
  if (items.length > 0) return items;

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
  return items;
}

function parseShippingAddress(text: string): string {
  const spanM = text.match(/<span class=['"]name['"]>([^<]+)<\/span>[\s\S]{0,20}<span class=['"]first-line['"]>([^<]+)<\/span>[\s\S]{0,20}<span class=['"]city['"]>([^<]+)<\/span>,\s*<span class=['"]state['"]>([^<]+)<\/span>\s*<span class=['"]zip['"]>([^<]+)<\/span>/i);
  if (spanM) {
    return `${spanM[1].trim()}, ${spanM[2].trim()}, ${spanM[3].trim()}, ${spanM[4].trim()} ${spanM[5].trim()}`;
  }
  const m = text.match(/[Ss]hipping\s+[Aa]ddress:?\s*\n([\s\S]{10,300}?)(?:\n\s*\n|\nOrder|\nTotal|$)/i);
  if (m) {
    return m[1]
      .replace(/<[^>]+>/g, " ")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join(", ");
  }
  return "";
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s*\|\s*$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ \n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseFromHtml(html: string): {
  items: EtsyOrderItem[];
  shippingAddress: string;
  buyerName: string;
  customerEmail: string;
} {
  const result = { items: [] as EtsyOrderItem[], shippingAddress: "", buyerName: "", customerEmail: "" };
  const h = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let trM: RegExpExecArray | null;
  while ((trM = trRe.exec(h)) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellM: RegExpExecArray | null;
    while ((cellM = cellRe.exec(trM[0])) !== null) {
      const t = cellM[1]
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (t) cells.push(t);
    }
    for (let ci = 0; ci < cells.length; ci++) {
      const pm = cells[ci].match(/^\$?\s*([\d,]+\.\d{2})$/);
      if (!pm) continue;
      const price = parseFloat(pm[1].replace(/,/g, ""));
      if (price <= 0) continue;
      for (let ni = 0; ni < cells.length; ni++) {
        if (ni === ci) continue;
        const raw = cells[ni];
        if (raw.match(/total|subtotal|shipping|tax|discount|handling|etsy|order|invoice/i)) continue;
        if (/^\$/.test(raw) || /^\d+$/.test(raw)) continue;
        const qtyM = raw.match(/\bqty:?\s*(\d+)/i) || raw.match(/^(\d+)\s*[×x]\s/i);
        const qty = qtyM ? parseInt(qtyM[1]) : 1;
        const name = raw
          .replace(/\bqty:?\s*\d+/gi, "")
          .replace(/^\d+\s*[×x]\s*/i, "")
          .replace(/\s+/g, " ")
          .trim();
        if (name.length >= 4 && !_BAD_NAME_WORDS.test(name.split(" ")[0])) {
          result.items.push({ name, qty, price });
          break;
        }
      }
      break;
    }
  }

  const shipPatterns = [
    /[Ss]hip(?:ping)?\s+(?:to|address):?[\s\S]{0,80}?(<(?:td|p|div)[^>]*>)([\s\S]{15,400}?)(?:<\/(?:td|p|div)>)/i,
    /[Dd]eliver\s+to:?[\s\S]{0,80}?(<(?:td|p|div)[^>]*>)([\s\S]{15,400}?)(?:<\/(?:td|p|div)>)/i,
  ];
  for (const pat of shipPatterns) {
    const sm = h.match(pat);
    if (sm) {
      const raw = sm[2]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 1);
      if (raw.length >= 2) {
        result.shippingAddress = raw.join(", ");
        const firstLine = raw[0];
        if (_isValidName(firstLine)) result.buyerName = firstLine;
        break;
      }
    }
  }

  const emailM = h.match(/(?:buyer|from)[^<]{0,40}([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (emailM && !emailM[1].includes("etsy.com") && !emailM[1].includes("google.com")) {
    result.customerEmail = emailM[1].toLowerCase();
  }

  return result;
}

function parseEtsyEmail(
  subject: string,
  textBody: string,
  htmlBody: string,
  messageId: string,
  date: Date,
  shopId: string
): EtsyOrder | null {
  const text = textBody || htmlToText(htmlBody);

  const orderNumber = parseOrderNumber(subject, text);
  if (!orderNumber) {
    logger.warn({ subject, messageId }, "Etsy Gmail: could not parse order number — skipping");
    return null;
  }

  const fromHtml = htmlBody ? parseFromHtml(htmlBody) : null;

  const total = parseTotal(subject, text);
  const shipping = parseShipping(text);

  const items: EtsyOrderItem[] = (fromHtml?.items.length ? fromHtml.items : parseItems(text));
  if (items.length === 0) {
    if (total > 0) {
      items.push({ name: `Etsy Order #${orderNumber}`, qty: 1, price: total });
    } else {
      logger.warn({ subject, messageId, orderNumber }, "Etsy Gmail: could not parse items — skipping");
      return null;
    }
  }

  const buyer =
    (fromHtml?.buyerName && fromHtml.buyerName !== "Etsy Customer" ? fromHtml.buyerName : null) ??
    parseBuyerName(text);

  const shippingAddress = fromHtml?.shippingAddress || parseShippingAddress(text);
  const customerEmail = fromHtml?.customerEmail || "";

  return {
    id: `etsy-${shopId}-${orderNumber}-${Date.now()}`,
    orderId: `#${orderNumber}`,
    orderNumber: `#${orderNumber}`,
    customer: buyer,
    customerEmail,
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
    shop: shopId,
  };
}

async function pollGmailAccount(config: ShopConfig): Promise<void> {
  const { shopId, shopLabel, user, pass } = config;

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

    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const uids = await client.search({
      from: "transaction@etsy.com",
      since,
    });

    logger.info(
      { shopId, count: uids.length, since: since.toISOString() },
      "Etsy Gmail: search complete"
    );

    let imported = 0;
    for (const uid of uids) {
      let msgSource: Buffer | undefined;
      try {
        const fetched = await client.fetchOne(String(uid), { source: true });
        msgSource = fetched?.source as Buffer | undefined;
      } catch (err) {
        logger.warn({ err, uid, shopId }, "Etsy Gmail: failed to fetch message — skipping");
        continue;
      }
      if (!msgSource) continue;

      let parsed;
      try {
        parsed = await simpleParser(msgSource);
      } catch (err) {
        logger.warn({ err, uid, shopId }, "Etsy Gmail: failed to parse message — skipping");
        continue;
      }

      const messageId = parsed.messageId ?? `uid-${uid}`;
      const subject = parsed.subject ?? "";
      const textBody = parsed.text ?? "";
      const htmlBody = (typeof parsed.html === "string" ? parsed.html : "") ?? "";
      const date = parsed.date ?? new Date();

      if (isInPersonPayment(subject)) {
        logger.info({ subject, messageId, shopId }, "Etsy Gmail: skipping in-person payment email");
        await markMessageImported(shopId, messageId, "");
        continue;
      }

      const alreadyDone = await isMessageImported(shopId, messageId);

      const order = parseEtsyEmail(subject, textBody, htmlBody, messageId, date, shopId);
      if (!order) {
        await markMessageImported(shopId, messageId, "");
        continue;
      }

      await markMessageImported(shopId, messageId, order.orderNumber, order);

      if (!alreadyDone) {
        pendingEtsyOrders.push(order);
      } else {
        if (!pendingEtsyOrders.some(o => o.gmailMessageId === order.gmailMessageId && o.shop === order.shop)) {
          pendingEtsyOrders.push(order);
        }
      }
      imported++;

      logger.info(
        { shopId, orderNumber: order.orderNumber, customer: order.customer, total: order.total },
        "Etsy Gmail: order imported"
      );

      // Only notify Discord for genuinely new orders
      const discordUrl = process.env.DISCORD_WEBHOOK_ORDERS;
      const discordKey = `${shopId}:${order.orderNumber}`;
      if (discordUrl && !alreadyDone && !_discordNotifiedOrders.has(discordKey)) {
        _discordNotifiedOrders.add(discordKey);
        try {
          const itemLines = order.items
            .map((i) => `  • ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""} — $${i.price.toFixed(2)}`)
            .join("\n");
          await fetch(discordUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `🟠 **New Etsy Order** · ${shopLabel}\nOrder: **${order.orderNumber}**\nCustomer: ${order.customer}\nTotal: **$${order.total.toFixed(2)}**\n${itemLines}`,
            }),
          });
        } catch (_) {}
      }
    }

    if (imported > 0) {
      logger.info({ shopId, imported }, "Etsy Gmail: poll complete");
    }

    await updateLastSyncAt();
    lastSyncError = null;
  } catch (err) {
    lastSyncError = err instanceof Error ? err.message : String(err);
    logger.warn({ err, shopId }, "Etsy Gmail: poll failed — will retry next cycle");
  } finally {
    try {
      await client.logout();
    } catch (_) {}
  }
}

// Pre-populate _discordNotifiedOrders from DB so server restarts don't re-fire alerts
async function loadDiscordNotifiedOrders(): Promise<void> {
  try {
    const res = await pool.query<{ order_number: string; order_json: EtsyOrder | null }>(
      `SELECT order_number, order_json FROM etsy_gmail_imports WHERE order_number IS NOT NULL AND order_number != ''`
    );
    for (const row of res.rows) {
      if (!row.order_number) continue;
      // Determine shopId from stored order_json; default to 'ha3d' for legacy records
      const shopId = row.order_json?.shop ?? "ha3d";
      _discordNotifiedOrders.add(`${shopId}:${row.order_number}`);
    }
    logger.info({ count: _discordNotifiedOrders.size }, "Loaded Discord-notified order numbers from DB");
  } catch (err) {
    logger.warn({ err }, "Could not load Discord-notified orders from DB — restart dupes possible");
  }
}

function buildConfigs(): ShopConfig[] {
  const configs: ShopConfig[] = [];
  const user1 = process.env.ETSY_GMAIL_ADDRESS;
  const pass1 = process.env.ETSY_GMAIL_APP_PASSWORD;
  if (user1 && pass1) {
    configs.push({ shopId: "ha3d", shopLabel: "HypedAnubis3D", user: user1, pass: pass1 });
  }
  const user2 = process.env.ETSY_GMAIL_ADDRESS_2;
  const pass2 = process.env.ETSY_GMAIL_APP_PASSWORD_2;
  if (user2 && pass2) {
    configs.push({ shopId: "dioscuri", shopLabel: "Dioscuri&Co", user: user2, pass: pass2 });
  }
  return configs;
}

function startAccountPoller(config: ShopConfig): void {
  logger.info({ shopId: config.shopId, user: config.user }, "Etsy Gmail: starting poller for account");
  // Initial poll after 15s stagger (+ 5s per subsequent account to avoid simultaneous IMAP connects)
  const stagger = config.shopId === "dioscuri" ? 20_000 : 15_000;
  setTimeout(async () => {
    await pollGmailAccount(config).catch(err =>
      logger.warn({ err, shopId: config.shopId }, "Etsy Gmail: initial poll failed")
    );
    const timer = setInterval(() => {
      pollGmailAccount(config).catch(err =>
        logger.warn({ err, shopId: config.shopId }, "Etsy Gmail: interval poll failed")
      );
    }, POLL_INTERVAL_MS);
    _pollerTimers.push(timer);
  }, stagger);
}

export async function startEtsyGmailPoller(): Promise<void> {
  await initDb();
  await loadDiscordNotifiedOrders();

  _activeConfigs = buildConfigs();

  if (_activeConfigs.length === 0) {
    logger.warn("Etsy Gmail: no accounts configured (ETSY_GMAIL_ADDRESS not set) — poller not started");
    return;
  }

  logger.info({ accounts: _activeConfigs.map(c => c.shopId) }, "Etsy Gmail poller starting");
  for (const config of _activeConfigs) {
    startAccountPoller(config);
  }
}

export async function debugEtsyGmailInbox(shopId?: string): Promise<object[]> {
  const configs = buildConfigs();
  const config = shopId
    ? configs.find(c => c.shopId === shopId)
    : configs[0];

  if (!config) {
    return [{ error: shopId ? `No config found for shopId '${shopId}'` : "ETSY_GMAIL_ADDRESS or ETSY_GMAIL_APP_PASSWORD not set" }];
  }

  const client = new ImapFlow({
    host: "imap.gmail.com", port: 993, secure: true,
    auth: { user: config.user, pass: config.pass }, logger: false,
  });

  const results: object[] = [];
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const uids = await client.search({ from: "transaction@etsy.com", since });
    results.push({ info: `[${config.shopLabel}] Found ${uids.length} emails from transaction@etsy.com in last 30 days` });

    for (const uid of uids.slice(-20)) {
      try {
        const fetched = await client.fetchOne(String(uid), { envelope: true, source: true });
        const parsed = await (await import("mailparser")).simpleParser(fetched.source as Buffer);
        const alreadyImported = await isMessageImported(config.shopId, parsed.messageId ?? `uid-${uid}`);
        const orderNumMatch = parseOrderNumber(parsed.subject ?? "", parsed.text ?? "");
        results.push({
          uid,
          shop: config.shopId,
          subject: parsed.subject,
          from: parsed.from?.text,
          date: parsed.date?.toISOString(),
          messageId: parsed.messageId,
          alreadyImported,
          parsedOrderNumber: orderNumMatch || "(could not parse)",
          textPreview: (parsed.text ?? "").slice(0, 300).replace(/\s+/g, " "),
          htmlExtracted: parsed.html ? parseFromHtml(typeof parsed.html === "string" ? parsed.html : "") : null,
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

export async function debugEtsyEmailHtml(uid: number): Promise<string> {
  const configs = buildConfigs();
  const config = configs[0];
  if (!config) return "not configured";
  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: config.user, pass: config.pass }, logger: false });
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    const fetched = await client.fetchOne(String(uid), { source: true });
    const parsed = await (await import("mailparser")).simpleParser(fetched.source as Buffer);
    const html = typeof parsed.html === "string" ? parsed.html : "";
    const stripped = html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
    return `=== SUBJECT: ${parsed.subject} ===\n\n=== HTML (first 8000 chars) ===\n${stripped.slice(0, 8000)}\n\n=== TEXT ===\n${(parsed.text ?? "").slice(0, 2000)}`;
  } finally {
    try { await client.logout(); } catch (_) {}
  }
}

export async function clearAndResyncEtsy(): Promise<{ cleared: number; imported: number }> {
  const res = await pool.query(`SELECT COUNT(*) FROM etsy_gmail_imports`);
  const cleared = parseInt(res.rows[0].count ?? "0");
  await pool.query(`DELETE FROM etsy_gmail_imports`);
  pendingEtsyOrders.length = 0;
  _inMemoryMessageIds.clear();
  isPolling = false;

  const configs = _activeConfigs.length > 0 ? _activeConfigs : buildConfigs();
  for (const config of configs) {
    await pollGmailAccount(config).catch(err =>
      logger.warn({ err, shopId: config.shopId }, "Etsy Gmail: resync poll failed")
    );
  }
  return { cleared, imported: pendingEtsyOrders.length };
}

export async function triggerEtsyGmailPoll(): Promise<{ imported: number }> {
  if (isPolling) return { imported: 0 };
  isPolling = true;
  const before = pendingEtsyOrders.length;
  const configs = _activeConfigs.length > 0 ? _activeConfigs : buildConfigs();
  try {
    for (const config of configs) {
      await pollGmailAccount(config).catch(err =>
        logger.warn({ err, shopId: config.shopId }, "Etsy Gmail: triggered poll failed")
      );
    }
  } finally {
    isPolling = false;
  }
  return { imported: pendingEtsyOrders.length - before };
}
