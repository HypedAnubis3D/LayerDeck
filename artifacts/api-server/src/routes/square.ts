import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, timingSafeEqual, randomUUID } from "crypto";

const router: IRouter = Router();

// ── In-memory queue of orders received via webhook ───────────────────────────
// The frontend polls GET /orders/recent and drains this queue.
const pendingOrders: Record<string, unknown>[] = [];

// ── HMAC helper ───────────────────────────────────────────────────────────────
function buildSquareHmac(sigKey: string, webhookUrl: string, rawBody: string): string {
  return createHmac("sha256", sigKey)
    .update(webhookUrl + rawBody)
    .digest("base64");
}

// ── Square API helper ─────────────────────────────────────────────────────────
async function fetchSquareOrder(orderId: string): Promise<Record<string, unknown> | null> {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://connect.squareup.com/v2/orders/${orderId}`, {
      headers: {
        "Square-Version": "2024-01-18",
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json() as { order?: Record<string, unknown> };
    return data.order ?? null;
  } catch {
    return null;
  }
}

// ── Process a completed Square payment ───────────────────────────────────────
async function processSquareSale(payment: Record<string, unknown>): Promise<Record<string, unknown>> {
  const orderId = payment["order_id"] as string | undefined;
  let items: unknown[] = [];
  let referenceId: string | undefined;

  if (orderId) {
    const order = await fetchSquareOrder(orderId);
    if (order) {
      referenceId = order["reference_id"] as string | undefined;
      const lineItems = (order["line_items"] as Array<Record<string, unknown>>) ?? [];
      items = lineItems.map(item => ({
        name:          item["name"] as string ?? "Item",
        qty:           parseInt(item["quantity"] as string ?? "1"),
        price:         parseFloat(String((item["base_price_money"] as Record<string, unknown>)?.["amount"] ?? 0)) / 100,
        variationName: item["variation_name"] as string ?? "",
        squareItemId:  item["catalog_object_id"] as string ?? null,
        shipLater:     false,
        shipped:       false,
      }));
    }
  }

  const totalMoney = payment["total_money"] as Record<string, unknown> | undefined;
  const total = parseFloat(String(totalMoney?.["amount"] ?? 0)) / 100;
  const paymentId = payment["id"] as string ?? randomUUID();
  const shortId = orderId ? orderId.slice(-6).toUpperCase() : paymentId.slice(-6).toUpperCase();

  return {
    id:                  randomUUID(),
    squareId:            paymentId,
    orderId:             orderId ?? paymentId,
    orderNumber:         `SQ-${referenceId ?? shortId}`,
    customer:            (payment["buyer_email_address"] as string ?? "").split("@")[0] || "In-Person Customer",
    customerEmail:       payment["buyer_email_address"] as string ?? "",
    phone:               (payment["shipping_address"] as Record<string, unknown>)?.["phone"] as string ?? "",
    shippingAddress:     null,
    total,
    status:              "pending",
    source:              "square",
    platform:            "square",
    fromSquare:          true,
    items,
    createdAt:           payment["created_at"] as string ?? new Date().toISOString(),
    syncedAt:            new Date().toISOString(),
    timestamp:           Date.now(),
    date:                new Date().toLocaleDateString(),
    conventionDeduction: true,
    hasPendingShipments: false,
  };
}

// ── POST /api/square/webhook ──────────────────────────────────────────────────
router.post(
  "/webhook",
  async (req: Request, res: Response): Promise<void> => {
    const sigKey = process.env.SQUARE_WEBHOOK_SIG_KEY;
    const signature = req.headers["x-square-hmacsha256-signature"] as string | undefined;

    // Determine the exact URL Square called (must match what you registered in Square dashboard)
    const webhookUrl =
      process.env.SQUARE_WEBHOOK_URL ??
      (process.env.REPLIT_APP_DOMAIN
        ? `https://${process.env.REPLIT_APP_DOMAIN}/api/square/webhook`
        : process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/square/webhook`
        : `https://layerstack.replit.app/api/square/webhook`);

    // Validate signature if sig key is configured
    if (sigKey && signature) {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
      const expected = buildSquareHmac(sigKey, webhookUrl, rawBody);
      let valid = false;
      try {
        valid = timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      } catch {
        valid = false;
      }
      if (!valid) {
        req.log.warn({ webhookUrl }, "Square webhook HMAC mismatch — rejected");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    } else if (sigKey && !signature) {
      req.log.warn("Square webhook missing signature header — rejected");
      res.status(401).json({ error: "Missing signature" });
      return;
    }

    // Parse body
    let event: Record<string, unknown>;
    try {
      event = Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString())
        : req.body;
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }

    // Only process completed payments
    if (event["type"] !== "payment.completed") {
      res.json({ received: true, skipped: true });
      return;
    }

    const data = event["data"] as Record<string, unknown> | undefined;
    const obj  = data?.["object"] as Record<string, unknown> | undefined;
    const payment = obj?.["payment"] as Record<string, unknown> | undefined;

    if (!payment) {
      res.status(400).json({ error: "No payment object in event" });
      return;
    }

    // Process in background — respond immediately so Square doesn't retry
    res.json({ received: true });

    try {
      const order = await processSquareSale(payment);
      pendingOrders.push(order);
      req.log.info({ orderNumber: order["orderNumber"], total: order["total"] }, "Square sale processed");

      // Post to Discord orders webhook directly
      const discordOrdersUrl = process.env.DISCORD_WEBHOOK_ORDERS;
      if (discordOrdersUrl) {
        try {
          const items = order["items"] as Array<{ name: string; qty: number }>;
          const itemLines = items.length
            ? items.map(i => `  • ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join("\n")
            : "  • (no item details)";
          const msg = [
            `🟦 **New Square Sale**`,
            `Order: **${order["orderNumber"]}**`,
            `Customer: ${order["customer"]}`,
            `Total: **$${(order["total"] as number).toFixed(2)}**`,
            itemLines,
          ].join("\n");
          await fetch(discordOrdersUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: msg }),
          });
        } catch {
          // Discord is best-effort
        }
      }
    } catch (err) {
      req.log.error(err, "Failed to process Square sale");
    }
  }
);

// ── GET /api/square/orders/recent ─────────────────────────────────────────────
// Returns all pending orders and drains the queue.
router.get(
  "/orders/recent",
  (_req: Request, res: Response): void => {
    const orders = pendingOrders.splice(0);
    res.json({ orders });
  }
);

// ── GET /api/square/status ────────────────────────────────────────────────────
router.get(
  "/status",
  (_req: Request, res: Response): void => {
    res.json({
      connected:    !!process.env.SQUARE_ACCESS_TOKEN,
      webhookReady: !!process.env.SQUARE_WEBHOOK_SIG_KEY,
      pending:      pendingOrders.length,
    });
  }
);

export default router;
