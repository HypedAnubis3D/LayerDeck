import { Router } from "express";

const router = Router();
const IG_BASE = "https://graph.facebook.com/v21.0";

interface DebugTokenData {
  app_id?: string;
  type?: string;
  is_valid?: boolean;
  expires_at?: number;
  scopes?: string[];
  granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
  user_id?: string;
  error?: { message: string };
}

interface IgInfo {
  id: string;
  username: string | null;
  missingScopes: string[];
}

// Use debug_token with app access token to extract IG Business Account ID
// from the token's granular scopes — works even without pages_read_engagement
async function resolveIgInfo(userToken: string): Promise<IgInfo | null> {
  const appId = process.env.META_APP_ID ?? "4317363561863449";
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return null;

  const appToken = `${appId}|${appSecret}`;

  try {
    const r = await fetch(
      `${IG_BASE}/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(appToken)}`
    );
    const j = (await r.json()) as { data?: DebugTokenData };
    const data = j?.data;
    if (!data || !data.is_valid) return null;

    const scopes = data.scopes ?? [];
    const granular = data.granular_scopes ?? [];
    const missingScopes: string[] = [];

    // Check required scopes
    if (!scopes.includes("pages_read_engagement")) missingScopes.push("pages_read_engagement");
    if (!scopes.includes("instagram_content_publish")) missingScopes.push("instagram_content_publish");

    // Extract IG Business Account ID from granular scope targets
    const igScope = granular.find((s) => s.scope === "instagram_content_publish");
    const igId = igScope?.target_ids?.[0] ?? null;
    if (!igId) return null;

    // Try to resolve IG username — attempt multiple paths
    let username: string | null = null;
    try {
      // Path 1: direct IG account query with user token
      const igRes = await fetch(
        `${IG_BASE}/${igId}?fields=id,username&access_token=${encodeURIComponent(userToken)}`
      );
      const igJ = (await igRes.json()) as { id?: string; username?: string; error?: unknown };
      if (igJ.username) username = igJ.username;

      // Path 2: via Facebook Page → instagram_business_account (when IG is linked to page)
      if (!username) {
        const pageScope = granular.find((s) => s.scope === "pages_show_list");
        const pageId = pageScope?.target_ids?.[0];
        if (pageId) {
          // Get page access token first
          const pgRes = await fetch(
            `${IG_BASE}/${pageId}?fields=access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`
          );
          const pgJ = (await pgRes.json()) as {
            access_token?: string;
            instagram_business_account?: { id: string; username?: string };
          };
          if (pgJ?.instagram_business_account?.username) {
            username = pgJ.instagram_business_account.username;
          } else if (pgJ?.access_token) {
            // Try again with page token
            const pgRes2 = await fetch(
              `${IG_BASE}/${pageId}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(pgJ.access_token)}`
            );
            const pgJ2 = (await pgRes2.json()) as {
              instagram_business_account?: { id: string; username?: string };
            };
            if (pgJ2?.instagram_business_account?.username) {
              username = pgJ2.instagram_business_account.username;
            }
          }
        }
      }
    } catch {
      // username stays null — not critical for publishing
    }

    return { id: igId, username, missingScopes };
  } catch {
    return null;
  }
}

// Cached IG info per server instance
let _cachedIgInfo: IgInfo | null | undefined = undefined;
async function getIgInfo(token: string): Promise<IgInfo | null> {
  if (_cachedIgInfo !== undefined) return _cachedIgInfo;
  _cachedIgInfo = await resolveIgInfo(token);
  return _cachedIgInfo;
}

// GET /api/social/status
router.get("/status", async (_req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.json({ ok: false, error: "META_ACCESS_TOKEN not set" });
  if (!process.env.META_APP_SECRET) return res.json({ ok: false, error: "META_APP_SECRET not set" });

  try {
    // Validate token + get user name
    const meRes = await fetch(
      `${IG_BASE}/me?access_token=${encodeURIComponent(token)}&fields=id,name`
    );
    const me = (await meRes.json()) as { id?: string; name?: string; error?: { message: string } };
    if (me.error) return res.json({ ok: false, error: me.error.message });

    const igInfo = await getIgInfo(token);

    if (!igInfo) {
      return res.json({
        ok: false,
        name: me.name,
        error: "Could not resolve Instagram Business Account from token. Ensure META_APP_SECRET is correct.",
        missingScopes: ["instagram_content_publish"],
      });
    }

    const canPublish = igInfo.missingScopes.length === 0;
    return res.json({
      ok: canPublish,
      name: me.name,
      igId: igInfo.id,
      igUsername: igInfo.username,
      missingScopes: igInfo.missingScopes,
      warning: igInfo.missingScopes.length > 0
        ? `Token missing: ${igInfo.missingScopes.join(", ")}. Regenerate token and add these permissions.`
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return res.json({ ok: false, error: msg });
  }
});

// POST /api/social/instagram — publish photo to Instagram Business account
router.post("/instagram", async (req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "META_ACCESS_TOKEN not set" });
  if (!process.env.META_APP_SECRET) return res.status(500).json({ error: "META_APP_SECRET not set" });

  const { imageUrl, caption } = req.body as { imageUrl?: string; caption?: string };
  if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });
  if (!caption) return res.status(400).json({ error: "caption required" });

  try {
    const igInfo = await getIgInfo(token);
    if (!igInfo?.id) {
      return res.status(400).json({
        error: "Cannot resolve Instagram Business Account ID from token. Check META_APP_SECRET and token scopes.",
      });
    }

    // Step 1: create media container
    const createRes = await fetch(`${IG_BASE}/${igInfo.id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
    });
    const createJson = (await createRes.json()) as { id?: string; error?: { message: string } };
    if (createJson.error) {
      return res.status(400).json({
        error: createJson.error.message,
        hint: igInfo.missingScopes.length > 0
          ? `Token may be missing: ${igInfo.missingScopes.join(", ")}`
          : "Ensure the image URL is publicly accessible (not localhost or private storage).",
      });
    }
    const containerId = createJson.id;
    if (!containerId) return res.status(400).json({ error: "Failed to create media container" });

    // Step 2: publish
    const publishRes = await fetch(`${IG_BASE}/${igInfo.id}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    });
    const publishJson = (await publishRes.json()) as { id?: string; error?: { message: string } };
    if (publishJson.error) return res.status(400).json({ error: publishJson.error.message });

    return res.json({ ok: true, id: publishJson.id, igId: igInfo.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

// POST /api/social/facebook — post to a Facebook Page
router.post("/facebook", async (req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "META_ACCESS_TOKEN not set" });

  const { message, imageUrl } = req.body as { message?: string; imageUrl?: string };
  if (!message) return res.status(400).json({ error: "message required" });

  try {
    const pagesRes = await fetch(
      `${IG_BASE}/me/accounts?access_token=${encodeURIComponent(token)}&fields=id,name,access_token`
    );
    const pagesJson = (await pagesRes.json()) as {
      data?: Array<{ id: string; name: string; access_token: string }>;
    };
    const page = pagesJson?.data?.[0];
    if (!page) {
      return res.status(400).json({
        error: "No Facebook Page linked. Token needs pages_show_list + pages_manage_posts + pages_read_engagement.",
      });
    }

    const endpoint = imageUrl ? `${IG_BASE}/${page.id}/photos` : `${IG_BASE}/${page.id}/feed`;
    const body: Record<string, string> = { access_token: page.access_token };
    if (imageUrl) { body.url = imageUrl; body.caption = message; }
    else { body.message = message; }

    const postRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const postJson = (await postRes.json()) as { id?: string; post_id?: string; error?: { message: string } };
    if (postJson.error) return res.status(400).json({ error: postJson.error.message });

    return res.json({ ok: true, id: postJson.post_id ?? postJson.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
});

export default router;
