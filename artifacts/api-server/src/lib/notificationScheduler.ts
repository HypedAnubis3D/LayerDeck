import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { sendPushToAll } from "./pushNotifications";
import { logger } from "./logger";

const DATA_DIR = path.join(process.cwd(), "data");
const PRINTS_FILE = path.join(DATA_DIR, "watched-prints.json");
const CONVENTIONS_FILE = path.join(DATA_DIR, "watched-conventions.json");
const ORDERS_FILE = path.join(DATA_DIR, "watched-orders.json");

interface WatchedPrint {
  id: string;
  name: string;
  printer: string;
  startedAt: number;
  hrs: number;
  notifiedAt?: number;
  overdueNotifiedAt?: number;
}
interface WatchedConvention {
  id: string;
  name: string;
  start: string;
  itemCount: number;
  notifiedDay?: boolean;
  notifiedHour?: boolean;
}
interface WatchedOrder {
  id: string;
  customer: string;
  orderId: string;
  addedAt: number;
  notifiedAt?: number;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return fallback;
  }
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function checkPrints() {
  const prints = readJson<WatchedPrint[]>(PRINTS_FILE, []);
  let changed = false;
  const now = Date.now();
  for (const p of prints) {
    if (!p.hrs) continue;
    const finishAt = p.startedAt + p.hrs * 3_600_000;
    const overdueAt = p.startedAt + p.hrs * 1.25 * 3_600_000;
    if (!p.notifiedAt && now >= finishAt) {
      await sendPushToAll({
        type: "print-complete",
        title: "🖨 Print may be done!",
        body: `${p.name} on ${p.printer} — did it finish successfully?`,
        printId: p.id,
      });
      p.notifiedAt = now;
      changed = true;
      logger.info({ printId: p.id, name: p.name }, "Print complete notification sent");
    } else if (p.notifiedAt && !p.overdueNotifiedAt && now >= overdueAt) {
      await sendPushToAll({
        type: "print-overdue",
        title: "⚠️ Print running long",
        body: `${p.name} on ${p.printer} is 25%+ past the estimated time`,
        printId: p.id,
      });
      p.overdueNotifiedAt = now;
      changed = true;
      logger.info({ printId: p.id }, "Print overdue notification sent");
    }
  }
  if (changed) writeJson(PRINTS_FILE, prints);
}

async function checkConventions() {
  const convs = readJson<WatchedConvention[]>(CONVENTIONS_FILE, []);
  let changed = false;
  const now = Date.now();
  for (const c of convs) {
    const startTs = new Date(c.start).getTime();
    if (isNaN(startTs) || startTs < now) continue;
    const dayBefore = startTs - 18 * 3_600_000;
    const hourBefore = startTs - 3_600_000;
    if (!c.notifiedDay && now >= dayBefore) {
      await sendPushToAll({
        type: "convention-tomorrow",
        title: "🎪 Convention tomorrow!",
        body: `${c.name} starts in ~${Math.round((startTs - now) / 3_600_000)}h — ${c.itemCount} items packed`,
      });
      c.notifiedDay = true;
      changed = true;
    }
    if (!c.notifiedHour && now >= hourBefore) {
      await sendPushToAll({
        type: "convention-soon",
        title: "🎪 Convention in 1 hour!",
        body: `${c.name} — time to head out! You've got ${c.itemCount} items ready.`,
      });
      c.notifiedHour = true;
      changed = true;
    }
  }
  if (changed) writeJson(CONVENTIONS_FILE, convs);
}

async function checkOrders() {
  const orders = readJson<WatchedOrder[]>(ORDERS_FILE, []);
  let changed = false;
  const now = Date.now();
  const THREE_DAYS = 3 * 24 * 3_600_000;
  for (const o of orders) {
    if (!o.notifiedAt && now - o.addedAt > THREE_DAYS) {
      await sendPushToAll({
        type: "order-aging",
        title: "📦 Order still pending",
        body: `${o.orderId} for ${o.customer} has been pending 3+ days`,
      });
      o.notifiedAt = now;
      changed = true;
    }
  }
  if (changed) writeJson(ORDERS_FILE, orders);
}

// ── Supabase helper ────────────────────────────────────────────────────────────

function makeSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getSupabaseCollection(
  supabase: ReturnType<typeof createClient>,
  collection: string
): Promise<unknown[]> {
  try {
    const { data, error } = await supabase
      .from("ha3d_user_data")
      .select("payload")
      .eq("collection", collection)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return [];
    let payload = data.payload;
    // The app stores payload as JSON.stringify(array) — parse if it's a string
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch { return []; }
    }
    if (Array.isArray(payload)) return payload;
    return [];
  } catch {
    return [];
  }
}


// ── Daily Discord Report ───────────────────────────────────────────────────────

export async function sendDailyDiscordReport() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_DAILY_REPORT;
  if (!webhookUrl) {
    logger.warn("DISCORD_WEBHOOK_DAILY_REPORT not set — skipping daily report");
    return;
  }

  const supabase = makeSupabase();
  if (!supabase) {
    logger.warn("Supabase env vars missing — skipping daily report");
    return;
  }

  const [rawPrints, rawSpools, rawQueue, rawCatalog] = await Promise.all([
    getSupabaseCollection(supabase, "prints"),
    getSupabaseCollection(supabase, "spools"),
    getSupabaseCollection(supabase, "queueItems"),
    getSupabaseCollection(supabase, "catalogItems"),
  ]);

  type FilamentEntry = { spoolId?: string; grams?: number };
  type PrintRecord   = {
    name?: string;
    printer?: string;
    hrs?: number;
    status?: string;     // 'done' | 'printing' | 'failed' — used by current app
    success?: boolean;   // legacy field on older manual-log prints
    finishedAt?: number; // ms timestamp — set on Pi Hub auto-logged and finished prints
    timestamp?: number;  // ms timestamp — always set
    date?: string;       // ISO date string — set on some older/manual prints
    filaments?: FilamentEntry[];
  };
  type SpoolRecord   = { remaining?: number; brand?: string; colorName?: string; name?: string };
  type QueueRecord   = { stage?: string; hrs?: number };
  type CatalogRecord = { stockQty?: number; lowStockAt?: number; name?: string; productName?: string };

  const prints  = rawPrints  as PrintRecord[];
  const spools  = rawSpools  as SpoolRecord[];
  const queue   = rawQueue   as QueueRecord[];
  const catalog = rawCatalog as CatalogRecord[];

  // Build today's date window in Eastern time
  const easternNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const todayStart = new Date(easternNow); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(todayStart);  todayEnd.setDate(todayEnd.getDate() + 1);
  const todayStartMs = todayStart.getTime();
  const todayEndMs   = todayEnd.getTime();

  // A print counts as "today" based on finishedAt → timestamp → parsed date field
  const printTs = (p: PrintRecord): number => {
    if (p.finishedAt) return p.finishedAt;
    if (p.timestamp)  return p.timestamp;
    if (p.date)       return new Date(p.date).getTime() || 0;
    return 0;
  };
  const isToday = (p: PrintRecord) => { const t = printTs(p); return t >= todayStartMs && t < todayEndMs; };
  // "done" = new status field OR legacy success boolean
  const isDone   = (p: PrintRecord) => p.status === "done"   || p.success === true;
  const isFailed = (p: PrintRecord) => p.status === "failed" || p.success === false;

  const todayPrints = prints.filter(p => isDone(p)   && isToday(p));
  const todayFails  = prints.filter(p => isFailed(p) && isToday(p));

  const queuedJobs = queue.filter(q => q.stage === "queued" || q.stage === "inprogress");
  const queueTotalMins = queuedJobs.reduce((a, q) => a + (parseFloat(String(q.hrs ?? 0)) * 60), 0);
  const queueHours   = Math.floor(queueTotalMins / 60);
  const queueRemMins = Math.round(queueTotalMins % 60);
  const queueTime    = queueHours > 0 ? `${queueHours}h ${queueRemMins}m` : `${queueRemMins}m`;

  // Grams = sum of filaments array; hrs = decimal hours stored directly
  const totalGrams = todayPrints.reduce((a, p) =>
    a + (p.filaments ?? []).reduce((s, f) => s + (f.grams ?? 0), 0), 0);
  const printersRan = [...new Set(todayPrints.map(p => p.printer).filter(Boolean))];

  let totalMins = 0;
  for (const p of todayPrints) {
    totalMins += Math.round((p.hrs ?? 0) * 60);
  }
  const hrs    = Math.floor(totalMins / 60);
  const mins   = totalMins % 60;
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  const lowSpools     = spools.filter(s => (s.remaining ?? 0) > 0 && (s.remaining ?? 0) < 100);
  const lowStockItems = catalog.filter(i => (i.stockQty ?? 0) <= (i.lowStockAt ?? 3));

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    timeZone: "America/New_York",
  });

  const lines: string[] = [
    `📊 LayerDeck Daily Report — ${dateLabel}`,
    "──────────────────────────",
    `🖨️ Prints Completed: ${todayPrints.length}${totalMins > 0 ? ` (total ${timeStr})` : ""}`,
  ];
  // List each print's name and printer
  todayPrints.slice(0, 8).forEach(p => {
    const pMins = Math.round((p.hrs ?? 0) * 60);
    const pHrs  = Math.floor(pMins / 60);
    const pMin  = pMins % 60;
    const dur   = pMins > 0 ? ` (${pHrs > 0 ? pHrs + "h " : ""}${pMin}m)` : "";
    lines.push(`   • ${p.name ?? "Unknown"}${p.printer ? ` — ${p.printer}` : ""}${dur}`);
  });
  if (totalGrams > 0) lines.push(`\n🧵 Filament Used: ${totalGrams.toFixed(0)}g total`);
  if (todayFails.length) {
    lines.push(`\n❌ Print Failures: ${todayFails.length}`);
    todayFails.forEach(f => lines.push(`   ${f.printer ?? ""}${f.name ? ` — ${f.name}` : ""}`));
  }
  if (lowStockItems.length) {
    lines.push("\n⚠️ Low Stock:");
    lowStockItems.slice(0, 5).forEach(i => lines.push(`   ${i.name ?? i.productName ?? ""} (${i.stockQty ?? 0} left)`));
  }
  if (lowSpools.length) {
    lines.push("\n🧵 Spools Running Low:");
    lowSpools.slice(0, 3).forEach(s => lines.push(`   ${s.brand ?? ""} ${s.colorName ?? s.name ?? ""} ~${Math.round(s.remaining ?? 0)}g`));
  }
  lines.push(`\n📋 Queue: ${queuedJobs.length} jobs pending (~${queueTime} total)`);
  lines.push("──────────────────────────");
  if (!todayFails.length && !lowStockItems.length && !lowSpools.length) lines.push("No alerts today ✅");

  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: lines.join("\n") }),
    });
    if (r.ok) {
      logger.info("Daily Discord report sent successfully");
    } else {
      const txt = await r.text().catch(() => "");
      logger.error({ status: r.status, body: txt }, "Daily Discord report failed");
    }
  } catch (err) {
    logger.error({ err }, "Daily Discord report fetch error");
  }
}

// ── Schedule helpers ───────────────────────────────────────────────────────────

function msUntilNext6amEastern(): number {
  const now = new Date();
  const eastern = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const next6am = new Date(eastern);
  next6am.setHours(6, 0, 0, 0);
  if (next6am <= eastern) next6am.setDate(next6am.getDate() + 1);
  return next6am.getTime() - eastern.getTime();
}

function scheduleDailyReport() {
  const delay = msUntilNext6amEastern();
  logger.info({ hoursUntil: Math.round(delay / 3_600_000 * 10) / 10 }, "Daily Discord report scheduled");
  setTimeout(function tick() {
    sendDailyDiscordReport().catch(err => logger.error({ err }, "Daily report error"));
    // Reset stock alert date so the stock check also runs fresh each new day
    setTimeout(tick, 24 * 60 * 60 * 1000);
  }, delay);
}

// ── Main export ────────────────────────────────────────────────────────────────

export function startNotificationScheduler() {
  const tick = async () => {
    try {
      await checkPrints();
      await checkConventions();
      await checkOrders();
    } catch (err) {
      logger.error({ err }, "Notification scheduler error");
    }
  };
  tick();
  setInterval(tick, 60_000);
  scheduleDailyReport();
  logger.info("Notification scheduler started (60s interval)");
}
