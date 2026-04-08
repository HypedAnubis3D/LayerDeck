import { Router, type Request, type Response } from "express";
import {
  pendingEtsyOrders,
  lastSyncAt,
  lastSyncError,
  isPolling,
  triggerEtsyGmailPoll,
} from "../lib/etsyGmailPoller";

const router = Router();

router.get("/orders/recent", (_req: Request, res: Response): void => {
  const orders = pendingEtsyOrders.splice(0);
  res.json({ orders });
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

export default router;
