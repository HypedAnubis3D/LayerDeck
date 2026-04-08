import { Router, type Request, type Response } from "express";
import {
  pendingEtsyOrders,
  lastSyncAt,
  lastSyncError,
  isPolling,
  triggerEtsyGmailPoll,
  debugEtsyGmailInbox,
  getStoredEtsyOrders,
} from "../lib/etsyGmailPoller";

const router = Router();

router.get("/orders/recent", async (_req: Request, res: Response): Promise<void> => {
  // Drain pending (new this cycle) + all stored from DB so page reloads don't lose orders
  const pending = pendingEtsyOrders.splice(0);
  const stored = await getStoredEtsyOrders();
  // Merge: DB is authoritative; pending may include orders not yet written (race), merge by messageId
  const seen = new Set<string>();
  const merged: typeof stored = [];
  for (const o of [...pending, ...stored]) {
    const key = o.gmailMessageId || o.orderId;
    if (!seen.has(key)) { seen.add(key); merged.push(o); }
  }
  res.json({ orders: merged });
});

router.get("/status", (_req: Request, res: Response): void => {
  res.json({
    configured: !!(process.env.ETSY_GMAIL_ADDRESS && process.env.ETSY_GMAIL_APP_PASSWORD),
    gmailAddress: process.env.ETSY_GMAIL_ADDRESS ?? null,
    lastSyncAt,
    lastSyncError,
    isPolling,
    pending: pendingEtsyOrders.length,
  });
});

router.post("/sync", async (_req: Request, res: Response): Promise<void> => {
  const result = await triggerEtsyGmailPoll();
  res.json({ ok: true, imported: result.imported });
});

router.get("/debug", async (_req: Request, res: Response): Promise<void> => {
  const results = await debugEtsyGmailInbox();
  res.json({ results });
});

router.post("/resync", async (_req: Request, res: Response): Promise<void> => {
  const { clearAndResyncEtsy } = await import("../lib/etsyGmailPoller.js");
  const result = await clearAndResyncEtsy();
  res.json({ ok: true, ...result });
});

router.get("/debug/html/:uid", async (req: Request, res: Response): Promise<void> => {
  const { debugEtsyEmailHtml } = await import("../lib/etsyGmailPoller.js");
  const html = await debugEtsyEmailHtml(Number(req.params.uid));
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(html);
});

export default router;
