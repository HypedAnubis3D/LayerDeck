import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { shopifyConnectionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const SCOPES =
  "read_products,read_orders,read_inventory,write_orders,read_customers";

function getRedirectUri(req: Request): string {
  return (
    process.env.SHOPIFY_REDIRECT_URI ||
    `${req.protocol}://${req.get("host")}/api/shopify/oauth/callback`
  );
}

/** GET /api/shopify/oauth/start?shop=yourstore.myshopify.com */
router.get("/oauth/start", (req: Request, res: Response): void => {
  const shop = ((req.query.shop as string) || "").trim();
  if (!shop) {
    res.status(400).json({ error: "shop parameter required" });
    return;
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    // No Partner app configured yet — redirect with helpful error
    res.redirect(
      "/?shopify_error=true&error_message=Shopify+app+not+configured.+Set+SHOPIFY_API_KEY+%26+SHOPIFY_API_SECRET+in+environment+variables."
    );
    return;
  }

  const redirectUri = getRedirectUri(req);
  const state = Math.random().toString(36).substring(2, 18);

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", apiKey);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  res.redirect(authUrl.toString());
});

/** GET /api/shopify/oauth/callback */
router.get("/oauth/callback", async (req: Request, res: Response): Promise<void> => {
  const { code, shop, hmac } = req.query as Record<string, string>;

  if (!code || !shop || !hmac) {
    res.redirect(
      "/?shopify_error=true&error_message=Invalid+OAuth+callback+parameters"
    );
    return;
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    res.redirect(
      "/?shopify_error=true&error_message=Shopify+app+not+fully+configured"
    );
    return;
  }

  // Verify HMAC signature from Shopify
  const params = new URLSearchParams(
    req.query as Record<string, string>
  );
  params.delete("hmac");
  params.sort();
  const message = params.toString();
  const digest = createHmac("sha256", apiSecret)
    .update(message)
    .digest("hex");

  let hmacValid = false;
  try {
    hmacValid = timingSafeEqual(
      Buffer.from(digest, "hex"),
      Buffer.from(hmac, "hex")
    );
  } catch {
    hmacValid = false;
  }

  if (!hmacValid) {
    res.redirect(
      "/?shopify_error=true&error_message=HMAC+verification+failed"
    );
    return;
  }

  // Exchange authorization code for access token
  try {
    const tokenResp = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
          code,
        }),
      }
    );

    if (!tokenResp.ok) {
      req.log.error(
        { status: tokenResp.status },
        "Shopify token exchange failed"
      );
      res.redirect(
        "/?shopify_error=true&error_message=Token+exchange+failed"
      );
      return;
    }

    const tokenData = (await tokenResp.json()) as {
      access_token: string;
      scope: string;
    };

    // Store credentials in database (never sent to browser)
    await db
      .insert(shopifyConnectionsTable)
      .values({
        shopDomain: shop,
        accessToken: tokenData.access_token,
        scopes: tokenData.scope,
      })
      .onConflictDoUpdate({
        target: shopifyConnectionsTable.shopDomain,
        set: {
          accessToken: tokenData.access_token,
          scopes: tokenData.scope,
        },
      });

    req.log.info({ shop }, "Shopify OAuth connected successfully");

    // Redirect back to frontend with success signal
    res.redirect(
      `/?shopify_connected=true&shop=${encodeURIComponent(shop)}`
    );
  } catch (err) {
    req.log.error(err, "Shopify OAuth error");
    res.redirect("/?shopify_error=true&error_message=OAuth+internal+error");
  }
});

/** GET /api/shopify/config — returns connection status (no token!) */
router.get("/config", async (req: Request, res: Response): Promise<void> => {
  try {
    const connections = await db
      .select({
        shopDomain: shopifyConnectionsTable.shopDomain,
        scopes: shopifyConnectionsTable.scopes,
        installedAt: shopifyConnectionsTable.installedAt,
      })
      .from(shopifyConnectionsTable)
      .limit(1);

    const conn = connections[0];
    if (!conn) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: true,
      shop: conn.shopDomain,
      scopes: conn.scopes,
      installedAt: conn.installedAt,
    });
  } catch (err) {
    req.log.error(err, "Failed to get Shopify config");
    res.json({ connected: false });
  }
});

/** GET /api/shopify/orders/sync — proxy to Shopify orders API */
router.get(
  "/orders/sync",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const connections = await db
        .select()
        .from(shopifyConnectionsTable)
        .limit(1);
      const conn = connections[0];

      if (!conn) {
        res.status(401).json({ error: "Not connected to Shopify" });
        return;
      }

      const url = new URL(
        `https://${conn.shopDomain}/admin/api/2024-01/orders.json`
      );
      url.searchParams.set("status", "open");
      url.searchParams.set("limit", "50");
      url.searchParams.set(
        "fields",
        "id,name,customer,line_items,created_at,financial_status,discount_codes"
      );

      const shopifyResp = await fetch(url.toString(), {
        headers: { "X-Shopify-Access-Token": conn.accessToken },
      });

      if (!shopifyResp.ok) {
        req.log.error(
          { status: shopifyResp.status },
          "Shopify orders API error"
        );
        res
          .status(shopifyResp.status)
          .json({ error: "Shopify API error", orders: [] });
        return;
      }

      const data = (await shopifyResp.json()) as { orders: unknown[] };
      res.json(data);
    } catch (err) {
      req.log.error(err, "Failed to sync Shopify orders");
      res.status(500).json({ error: "Internal error", orders: [] });
    }
  }
);

/** GET /api/shopify/products — proxy to Shopify products API */
router.get(
  "/products",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const connections = await db
        .select()
        .from(shopifyConnectionsTable)
        .limit(1);
      const conn = connections[0];

      if (!conn) {
        res.status(401).json({ error: "Not connected to Shopify", products: [] });
        return;
      }

      const url = new URL(
        `https://${conn.shopDomain}/admin/api/2024-01/products.json`
      );
      url.searchParams.set("limit", "250");
      url.searchParams.set(
        "fields",
        "id,title,variants,images,status,product_type,tags"
      );

      const shopifyResp = await fetch(url.toString(), {
        headers: { "X-Shopify-Access-Token": conn.accessToken },
      });

      if (!shopifyResp.ok) {
        res
          .status(shopifyResp.status)
          .json({ error: "Shopify API error", products: [] });
        return;
      }

      const data = (await shopifyResp.json()) as { products: unknown[] };
      res.json(data);
    } catch (err) {
      req.log.error(err, "Failed to fetch Shopify products");
      res.status(500).json({ error: "Internal error", products: [] });
    }
  }
);

/** POST /api/shopify/webhooks/orders/create — receive real-time order webhooks */
router.post(
  "/webhooks/orders/create",
  async (req: Request, res: Response): Promise<void> => {
    const hmacHeader = req.headers["x-shopify-hmac-sha256"] as string;
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;

    // Verify HMAC if secret is configured
    if (webhookSecret && hmacHeader && Buffer.isBuffer(req.body)) {
      const digest = createHmac("sha256", webhookSecret)
        .update(req.body)
        .digest("base64");

      let valid = false;
      try {
        valid = timingSafeEqual(
          Buffer.from(digest),
          Buffer.from(hmacHeader)
        );
      } catch {
        valid = false;
      }

      if (!valid) {
        req.log.warn("Shopify webhook HMAC verification failed");
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }

    // Parse order data
    let order: Record<string, unknown>;
    try {
      order = Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString())
        : req.body;
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    req.log.info(
      {
        orderId: order["id"],
        orderName: order["name"],
        discountCodes: order["discount_codes"],
      },
      "Shopify webhook: new order received"
    );

    // Check for WELCOME20 mystery print trigger
    const discounts = (order["discount_codes"] as Array<{ code: string }>) || [];
    const hasMysteryCode = discounts.some(
      (d) => d.code?.toUpperCase() === "WELCOME20"
    );

    if (hasMysteryCode) {
      req.log.info(
        { orderId: order["id"] },
        "Mystery print triggered by WELCOME20 code"
      );
      // TODO: Push mystery print event to Supabase for real-time frontend update
    }

    // Always respond 200 quickly — Shopify retries on timeout
    res.status(200).json({ received: true });
  }
);

/** DELETE /api/shopify/disconnect — clear stored credentials */
router.delete(
  "/disconnect",
  async (req: Request, res: Response): Promise<void> => {
    try {
      await db.delete(shopifyConnectionsTable);
      req.log.info("Shopify disconnected");
      res.json({ success: true });
    } catch (err) {
      req.log.error(err, "Failed to disconnect Shopify");
      res.status(500).json({ error: "Internal error" });
    }
  }
);

export default router;
