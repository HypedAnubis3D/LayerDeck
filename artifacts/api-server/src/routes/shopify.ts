import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import {
  shopifyConnectionsTable,
  shopifyAppConfigTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const SCOPES =
  "read_products,read_orders,read_inventory,read_customers";

function getRedirectUri(_req: Request): string {
  if (process.env.SHOPIFY_REDIRECT_URI) return process.env.SHOPIFY_REDIRECT_URI;
  // Use Replit's dev domain (always HTTPS) when available
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/shopify/oauth/callback`;
  }
  // Fallback: derive from request (works behind a correctly configured proxy)
  const proto = _req.get("x-forwarded-proto") || _req.protocol || "https";
  const host = _req.get("x-forwarded-host") || _req.get("host") || "";
  return `${proto}://${host}/api/shopify/oauth/callback`;
}

/** Resolve OAuth credentials: prefer env vars, fall back to DB-stored config. */
async function getOAuthCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const envKey = process.env.SHOPIFY_API_KEY;
  const envSecret = process.env.SHOPIFY_API_SECRET;
  if (envKey && envSecret) return { clientId: envKey, clientSecret: envSecret };

  const rows = await db
    .select()
    .from(shopifyAppConfigTable)
    .limit(1);
  if (rows.length > 0) {
    return { clientId: rows[0].clientId, clientSecret: rows[0].clientSecret };
  }
  return null;
}

/** POST /api/shopify/oauth/credentials — save Client ID + Secret, then return the OAuth URL */
router.post(
  "/oauth/credentials",
  async (req: Request, res: Response): Promise<void> => {
    const { clientId, clientSecret, shopDomain } = req.body as {
      clientId?: string;
      clientSecret?: string;
      shopDomain?: string;
    };

    if (!clientId || !clientSecret || !shopDomain) {
      res
        .status(400)
        .json({ error: "clientId, clientSecret and shopDomain are required" });
      return;
    }

    const shop = shopDomain
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");

    // Persist credentials (upsert the single config row)
    await db
      .insert(shopifyAppConfigTable)
      .values({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })
      .onConflictDoUpdate({
        target: shopifyAppConfigTable.id,
        set: {
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        },
      });

    const redirectUri = getRedirectUri(req);
    const state = Math.random().toString(36).substring(2, 18);

    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", clientId.trim());
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    req.log.info({ shop, redirectUri }, "Shopify OAuth flow initiated via stored credentials");
    res.json({ authUrl: authUrl.toString(), shop });
  }
);

/** GET /api/shopify/oauth/start?shop=yourstore.myshopify.com */
router.get(
  "/oauth/start",
  async (req: Request, res: Response): Promise<void> => {
    const shop = ((req.query.shop as string) || "").trim();
    if (!shop) {
      res.status(400).json({ error: "shop parameter required" });
      return;
    }

    const creds = await getOAuthCredentials();
    if (!creds) {
      res.redirect(
        "/?shopify_error=true&error_message=Shopify+app+not+configured+—+enter+your+Client+ID+and+Secret+in+the+Shopify+tab."
      );
      return;
    }

    const redirectUri = getRedirectUri(req);
    const state = Math.random().toString(36).substring(2, 18);

    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", creds.clientId);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    res.redirect(authUrl.toString());
  }
);

/** GET /api/shopify/oauth/callback */
router.get("/oauth/callback", async (req: Request, res: Response): Promise<void> => {
  const { code, shop, hmac } = req.query as Record<string, string>;

  if (!code || !shop || !hmac) {
    res.redirect(
      "/?shopify_error=true&error_message=Invalid+OAuth+callback+parameters"
    );
    return;
  }

  const creds = await getOAuthCredentials();
  if (!creds) {
    res.redirect(
      "/?shopify_error=true&error_message=Shopify+app+not+configured+—+enter+credentials+in+the+Shopify+tab."
    );
    return;
  }

  const { clientId: apiKey, clientSecret: apiSecret } = creds;

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

/** POST /api/shopify/connect — store a custom-app token (never echoed back) */
router.post("/connect", async (req: Request, res: Response): Promise<void> => {
  const { shopDomain, accessToken } = req.body as {
    shopDomain?: string;
    accessToken?: string;
  };

  if (!shopDomain || !accessToken) {
    res.status(400).json({ error: "shopDomain and accessToken are required" });
    return;
  }

  const domain = shopDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Quick validation — try to fetch shop info with the token
  try {
    const testResp = await fetch(
      `https://${domain}/admin/api/2024-01/shop.json`,
      { headers: { "X-Shopify-Access-Token": accessToken } }
    );
    if (!testResp.ok) {
      res.status(401).json({ error: "Invalid token or store domain — Shopify returned " + testResp.status });
      return;
    }
  } catch {
    res.status(502).json({ error: "Could not reach Shopify. Check your store domain." });
    return;
  }

  try {
    await db
      .insert(shopifyConnectionsTable)
      .values({ shopDomain: domain, accessToken, scopes: "custom_app" })
      .onConflictDoUpdate({
        target: shopifyConnectionsTable.shopDomain,
        set: { accessToken, scopes: "custom_app" },
      });

    req.log.info({ domain }, "Shopify custom app connected");
    res.json({ connected: true, shop: domain });
  } catch (err) {
    req.log.error(err, "Failed to store Shopify connection");
    res.status(500).json({ error: "Internal error saving connection" });
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
      url.searchParams.set("status", "any");
      url.searchParams.set("limit", "100");
      url.searchParams.set(
        "fields",
        "id,name,customer,line_items,created_at,financial_status,fulfillment_status,discount_codes"
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
