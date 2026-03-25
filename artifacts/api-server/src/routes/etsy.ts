import { Router, type IRouter, type Request, type Response } from "express";
import { createHash, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { etsyConnectionsTable, etsyAppConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const ETSY_SCOPES = "listings_r transactions_r";
const ETSY_API = "https://openapi.etsy.com/v3/application";

// In-memory PKCE state store: state → { verifier, redirectUri }
const pkceStore = new Map<string, { verifier: string; redirectUri: string }>();

function getRedirectUri(req: Request): string {
  if (process.env.ETSY_REDIRECT_URI) return process.env.ETSY_REDIRECT_URI;
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/etsy/oauth/callback`;
  }
  const proto = req.get("x-forwarded-proto") || "https";
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  return `${proto}://${host}/api/etsy/oauth/callback`;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function getClientId(): Promise<string | null> {
  const envId = process.env.ETSY_CLIENT_ID;
  if (envId) return envId;
  const rows = await db.select().from(etsyAppConfigTable).limit(1);
  return rows[0]?.clientId ?? null;
}

async function getConnection() {
  const rows = await db.select().from(etsyConnectionsTable).limit(1);
  return rows[0] ?? null;
}

async function refreshAccessToken(conn: typeof etsyConnectionsTable.$inferSelect): Promise<string | null> {
  if (!conn.refreshToken) return null;
  const clientId = await getClientId();
  if (!clientId) return null;
  try {
    const resp = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: conn.refreshToken,
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { access_token: string; refresh_token: string; expires_in: number };
    const expiry = new Date(Date.now() + data.expires_in * 1000);
    await db.update(etsyConnectionsTable)
      .set({ accessToken: data.access_token, refreshToken: data.refresh_token, tokenExpiry: expiry })
      .where(eq(etsyConnectionsTable.id, conn.id));
    return data.access_token;
  } catch {
    return null;
  }
}

async function getValidToken(): Promise<{ token: string; clientId: string; shopId: string } | null> {
  const conn = await getConnection();
  if (!conn) return null;
  const clientId = await getClientId();
  if (!clientId) return null;

  let token = conn.accessToken;
  if (conn.tokenExpiry && conn.tokenExpiry < new Date(Date.now() + 60_000)) {
    token = (await refreshAccessToken(conn)) ?? token;
  }
  return { token, clientId, shopId: conn.shopId };
}

/** POST /api/etsy/oauth/credentials — save Client ID */
router.post("/oauth/credentials", async (req: Request, res: Response): Promise<void> => {
  const { clientId } = req.body as { clientId?: string };
  if (!clientId) { res.status(400).json({ error: "clientId is required" }); return; }

  await db.insert(etsyAppConfigTable)
    .values({ clientId: clientId.trim() })
    .onConflictDoUpdate({ target: etsyAppConfigTable.id, set: { clientId: clientId.trim() } });

  const redirectUri = getRedirectUri(req);
  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(12).toString("hex");
  pkceStore.set(state, { verifier, redirectUri });
  setTimeout(() => pkceStore.delete(state), 10 * 60 * 1000);

  const authUrl = new URL("https://www.etsy.com/oauth/connect");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId.trim());
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", ETSY_SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  res.json({ authUrl: authUrl.toString() });
});

/** GET /api/etsy/oauth/start — begin PKCE flow */
router.get("/oauth/start", async (req: Request, res: Response): Promise<void> => {
  const clientId = await getClientId();
  if (!clientId) {
    res.redirect("/?etsy_error=true&error_message=Etsy+app+not+configured+—+enter+your+Client+ID+in+the+Etsy+tab.");
    return;
  }

  const redirectUri = getRedirectUri(req);
  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(12).toString("hex");
  pkceStore.set(state, { verifier, redirectUri });
  setTimeout(() => pkceStore.delete(state), 10 * 60 * 1000);

  const authUrl = new URL("https://www.etsy.com/oauth/connect");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", ETSY_SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  res.redirect(authUrl.toString());
});

/** GET /api/etsy/oauth/callback */
router.get("/oauth/callback", async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query as Record<string, string>;
  if (!code || !state) {
    res.redirect("/?etsy_error=true&error_message=Invalid+OAuth+callback+parameters");
    return;
  }

  const pkce = pkceStore.get(state);
  if (!pkce) {
    res.redirect("/?etsy_error=true&error_message=OAuth+state+expired+or+invalid+—+please+try+again");
    return;
  }
  pkceStore.delete(state);

  const clientId = await getClientId();
  if (!clientId) {
    res.redirect("/?etsy_error=true&error_message=Etsy+app+not+configured");
    return;
  }

  try {
    const tokenResp = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: pkce.redirectUri,
        code,
        code_verifier: pkce.verifier,
      }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      req.log.error({ status: tokenResp.status, body: errText }, "Etsy token exchange failed");
      res.redirect("/?etsy_error=true&error_message=Token+exchange+failed");
      return;
    }

    const tokenData = (await tokenResp.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    const expiry = new Date(Date.now() + tokenData.expires_in * 1000);

    // Fetch the user's shop details
    const meResp = await fetch(`${ETSY_API}/users/me`, {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "x-api-key": clientId,
      },
    });

    let shopId = "unknown";
    let shopName = "Etsy Shop";
    if (meResp.ok) {
      const me = (await meResp.json()) as { user_id?: number; shops?: Array<{ shop_id: number; shop_name: string }> };
      if (me.shops && me.shops[0]) {
        shopId = String(me.shops[0].shop_id);
        shopName = me.shops[0].shop_name;
      }
    }

    await db.insert(etsyConnectionsTable)
      .values({
        shopName,
        shopId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiry: expiry,
      })
      .onConflictDoUpdate({
        target: etsyConnectionsTable.shopId,
        set: {
          shopName,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiry: expiry,
        },
      });

    req.log.info({ shopId, shopName }, "Etsy OAuth connected successfully");
    res.redirect(`/?etsy_connected=true&shop=${encodeURIComponent(shopName)}`);
  } catch (err) {
    req.log.error(err, "Etsy OAuth error");
    res.redirect("/?etsy_error=true&error_message=OAuth+internal+error");
  }
});

/** GET /api/etsy/config — connection status (no token) */
router.get("/config", async (req: Request, res: Response): Promise<void> => {
  try {
    const conn = await getConnection();
    if (!conn) { res.json({ connected: false }); return; }
    res.json({ connected: true, shop: conn.shopName, shopId: conn.shopId, installedAt: conn.installedAt });
  } catch (err) {
    req.log.error(err, "Failed to get Etsy config");
    res.json({ connected: false });
  }
});

/** GET /api/etsy/listings — proxy to Etsy active listings */
router.get("/listings", async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = await getValidToken();
    if (!auth) { res.status(401).json({ error: "Not connected to Etsy", listings: [] }); return; }

    const url = new URL(`${ETSY_API}/shops/${auth.shopId}/listings/active`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("includes", "Images,MainImage");

    const etsyResp = await fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${auth.token}`, "x-api-key": auth.clientId },
    });

    if (!etsyResp.ok) {
      req.log.error({ status: etsyResp.status }, "Etsy listings API error");
      res.status(etsyResp.status).json({ error: "Etsy API error", listings: [] });
      return;
    }

    const data = (await etsyResp.json()) as { results: unknown[]; count: number };
    res.json({ listings: data.results || [], count: data.count || 0 });
  } catch (err) {
    req.log.error(err, "Failed to fetch Etsy listings");
    res.status(500).json({ error: "Internal error", listings: [] });
  }
});

/** GET /api/etsy/orders — proxy to Etsy receipts (orders) */
router.get("/orders", async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = await getValidToken();
    if (!auth) { res.status(401).json({ error: "Not connected to Etsy", receipts: [] }); return; }

    const url = new URL(`${ETSY_API}/shops/${auth.shopId}/receipts`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("was_paid", "true");
    url.searchParams.set("sort_on", "created");
    url.searchParams.set("sort_order", "desc");

    const etsyResp = await fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${auth.token}`, "x-api-key": auth.clientId },
    });

    if (!etsyResp.ok) {
      req.log.error({ status: etsyResp.status }, "Etsy orders API error");
      res.status(etsyResp.status).json({ error: "Etsy API error", receipts: [] });
      return;
    }

    const data = (await etsyResp.json()) as { results: unknown[]; count: number };
    res.json({ receipts: data.results || [], count: data.count || 0 });
  } catch (err) {
    req.log.error(err, "Failed to fetch Etsy orders");
    res.status(500).json({ error: "Internal error", receipts: [] });
  }
});

/** DELETE /api/etsy/disconnect */
router.delete("/disconnect", async (req: Request, res: Response): Promise<void> => {
  try {
    await db.delete(etsyConnectionsTable);
    await db.delete(etsyAppConfigTable);
    req.log.info("Etsy disconnected");
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to disconnect Etsy");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
