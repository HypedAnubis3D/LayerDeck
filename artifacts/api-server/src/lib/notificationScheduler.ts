import fs from "fs";
import path from "path";
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
  logger.info("Notification scheduler started (60s interval)");
}
