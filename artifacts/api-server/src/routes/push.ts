import { Router } from "express";
import fs from "fs";
import path from "path";
import { getSubscriptions, saveSubscriptions, sendPushToAll } from "../lib/pushNotifications";

const router = Router();
const DATA_DIR = path.join(process.cwd(), "data");
const PRINTS_FILE = path.join(DATA_DIR, "watched-prints.json");
const CONVENTIONS_FILE = path.join(DATA_DIR, "watched-conventions.json");
const ORDERS_FILE = path.join(DATA_DIR, "watched-orders.json");

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

router.get("/vapid-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? "" });
});

router.post("/subscribe", (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint) { res.status(400).json({ error: "Invalid subscription" }); return; }
  const subs = getSubscriptions();
  if (!subs.some((s) => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    saveSubscriptions(subs);
  }
  res.json({ ok: true });
});

router.delete("/unsubscribe", (req, res) => {
  const { endpoint } = req.body ?? {};
  saveSubscriptions(getSubscriptions().filter((s) => s.endpoint !== endpoint));
  res.json({ ok: true });
});

router.post("/watch-print", (req, res) => {
  const { id, name, printer, startedAt, hrs, extendMins } = req.body ?? {};
  if (!id) { res.status(400).json({ error: "Missing id" }); return; }
  const prints = readJson<any[]>(PRINTS_FILE, []);
  const idx = prints.findIndex((p) => p.id === id);
  if (extendMins && idx >= 0) {
    prints[idx].notifiedAt = undefined;
    prints[idx].hrs = (prints[idx].hrs ?? 0) + extendMins / 60;
    writeJson(PRINTS_FILE, prints);
    res.json({ ok: true, extended: true }); return;
  }
  const entry = { id, name, printer, startedAt: startedAt ?? Date.now(), hrs: hrs ?? 0 };
  if (idx >= 0) prints[idx] = entry;
  else prints.push(entry);
  writeJson(PRINTS_FILE, prints);
  res.json({ ok: true });
});

router.delete("/watch-print/:id", (req, res) => {
  writeJson(PRINTS_FILE, readJson<any[]>(PRINTS_FILE, []).filter((p) => p.id !== req.params.id));
  res.json({ ok: true });
});

router.post("/confirm-print/:id", (req, res) => {
  writeJson(PRINTS_FILE, readJson<any[]>(PRINTS_FILE, []).filter((p) => p.id !== req.params.id));
  res.json({ ok: true });
});

router.post("/watch-convention", (req, res) => {
  const { id, name, start, itemCount } = req.body ?? {};
  if (!id || !start) { res.status(400).json({ error: "Missing fields" }); return; }
  const convs = readJson<any[]>(CONVENTIONS_FILE, []);
  const idx = convs.findIndex((c) => c.id === id);
  const entry = { id, name, start, itemCount: itemCount ?? 0 };
  if (idx >= 0) convs[idx] = { ...convs[idx], ...entry };
  else convs.push(entry);
  writeJson(CONVENTIONS_FILE, convs);
  res.json({ ok: true });
});

router.delete("/watch-convention/:id", (req, res) => {
  writeJson(CONVENTIONS_FILE, readJson<any[]>(CONVENTIONS_FILE, []).filter((c) => c.id !== req.params.id));
  res.json({ ok: true });
});

router.post("/watch-order", (req, res) => {
  const { id, customer, orderId, addedAt } = req.body ?? {};
  if (!id) { res.status(400).json({ error: "Missing id" }); return; }
  const orders = readJson<any[]>(ORDERS_FILE, []);
  if (!orders.some((o) => o.id === id)) {
    orders.push({ id, customer, orderId, addedAt: addedAt ?? Date.now() });
    writeJson(ORDERS_FILE, orders);
  }
  res.json({ ok: true });
});

router.delete("/watch-order/:id", (req, res) => {
  writeJson(ORDERS_FILE, readJson<any[]>(ORDERS_FILE, []).filter((o) => o.id !== req.params.id));
  res.json({ ok: true });
});

router.post("/test", async (_req, res) => {
  const subs = getSubscriptions();
  if (!subs.length) { res.status(400).json({ error: "No subscribers — grant permission in the app first" }); return; }
  try {
    await sendPushToAll({ type: "test", title: "🔔 HypedAnubis3D", body: "Notifications are working!" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/notify-order", async (req, res) => {
  const { orderId, customer, summary, itemCount } = req.body ?? {};
  const subs = getSubscriptions();
  if (!subs.length) { res.json({ ok: true, skipped: true }); return; }
  try {
    const itemLabel = itemCount === 1 ? "1 item" : `${itemCount} items`;
    await sendPushToAll({
      type: "new-order",
      title: `🛍 New Order ${orderId ?? ""}`,
      body: `${customer ?? "Customer"} · ${itemLabel}${summary ? " — " + summary.slice(0, 60) : ""}`,
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
