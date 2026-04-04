import { Router } from "express";

const router = Router();
const IG_BASE = "https://graph.facebook.com/v21.0";

// Known page ID for HypedAnubis3D — used as primary discovery path for system user tokens
const KNOWN_PAGE_ID = process.env.META_PAGE_ID ?? "445455645311970";

interface IgInfo {
  id: string;
  username: string | null;
  pageId: string | null;
  tokenType: "USER" | "SYSTEM_USER" | "PAGE" | "unknown";
  missingScopes: string[];
}

interface PageIgResult {
  id?: string;
  name?: string;
  instagram_business_account?: { id: string; username?: string };
  error?: { message: string };
}

// Resolve IG Business Account — handles both User tokens and System User tokens
async function resolveIgInfo(token: string): Promise<IgInfo | null> {
  const appId = process.env.META_APP_ID ?? "4317363561863449";
  const appSecret = process.env.META_APP_SECRET;

  let tokenType: IgInfo["tokenType"] = "unknown";
  let scopes: string[] = [];
  let granularPageId: string | null = null;
  let granularIgId: string | null = null;

  // Step 1: debug_token to understand what we have
  if (appSecret) {
    try {
      const appToken = `${appId}|${appSecret}`;
      const r = await fetch(
        `${IG_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`
      );
      const j = (await r.json()) as {
        data?: {
          type?: string;
          is_valid?: boolean;
          scopes?: string[];
          granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
        };
      };
      const d = j?.data;
      if (!d?.is_valid) return null;

      tokenType = (d.type ?? "unknown") as IgInfo["tokenType"];
      scopes = d.scopes ?? [];

      const granular = d.granular_scopes ?? [];
      const pageScope = granular.find((s) => s.scope === "pages_show_list");
      const igScope = granular.find((s) => s.scope === "instagram_content_publish");
      granularPageId = pageScope?.target_ids?.[0] ?? null;
      granularIgId = igScope?.target_ids?.[0] ?? null;
    } catch {
      // proceed without debug info
    }
  }

  // Check required scopes
  const missingScopes: string[] = [];
  if (!scopes.includes("pages_read_engagement")) missingScopes.push("pages_read_engagement");
  if (!scopes.includes("instagram_content_publish")) missingScopes.push("instagram_content_publish");

  // Step 2: resolve IG info via page — try known page ID and granular page ID
  const pageIds = [...new Set([KNOWN_PAGE_ID, granularPageId].filter(Boolean) as string[])];

  for (const pageId of pageIds) {
    try {
      const r = await fetch(
        `${IG_BASE}/${pageId}?fields=id,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
      );
      const j = (await r.json()) as PageIgResult;
      if (j.instagram_business_account?.id) {
        return {
          id: j.instagram_business_account.id,
          username: j.instagram_business_account.username ?? null,
          pageId,
          tokenType,
          missingScopes,
        };
      }
    } catch {
      // try next
    }
  }

  // Step 3: fall back to IG ID from granular scopes (user token path)
  if (granularIgId) {
    return {
      id: granularIgId,
      username: null,
      pageId: granularPageId,
      tokenType,
      missingScopes,
    };
  }

  return null;
}

// Cached IG info per server instance (cleared on restart with new token)
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

  try {
    const igInfo = await getIgInfo(token);

    if (!igInfo) {
      return res.json({
        ok: false,
        error: "Could not resolve Instagram Business Account. Check token and META_APP_SECRET.",
        missingScopes: ["instagram_content_publish"],
      });
    }

    const canPublish = igInfo.missingScopes.length === 0;
    return res.json({
      ok: canPublish,
      igId: igInfo.id,
      igUsername: igInfo.username,
      pageId: igInfo.pageId,
      tokenType: igInfo.tokenType,
      missingScopes: igInfo.missingScopes,
      warning: igInfo.missingScopes.length > 0
        ? `Token missing: ${igInfo.missingScopes.join(", ")}. Regenerate token and add these permissions.`
        : null,
    });
  } catch (e) {
    return res.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// POST /api/social/instagram — publish photo to Instagram Business account
router.post("/instagram", async (req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "META_ACCESS_TOKEN not set" });

  const { imageUrl, caption } = req.body as { imageUrl?: string; caption?: string };
  if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });
  if (!caption) return res.status(400).json({ error: "caption required" });

  try {
    const igInfo = await getIgInfo(token);
    if (!igInfo?.id) {
      return res.status(400).json({
        error: "Cannot resolve Instagram Business Account ID. Check token and page asset assignment.",
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
        hint: "Ensure the image URL is publicly accessible (not localhost, Supabase private storage, or behind auth).",
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

    return res.json({ ok: true, id: publishJson.id, igId: igInfo.id, username: igInfo.username });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// POST /api/social/facebook — post to the HypedAnubis3D Facebook Page
router.post("/facebook", async (req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "META_ACCESS_TOKEN not set" });

  const { message, imageUrl } = req.body as { message?: string; imageUrl?: string };
  if (!message) return res.status(400).json({ error: "message required" });

  try {
    const igInfo = await getIgInfo(token);
    const pageId = igInfo?.pageId ?? KNOWN_PAGE_ID;

    // For system user tokens, use the token directly (no page token needed)
    // For user tokens, get the page access token first
    let postToken = token;
    if (igInfo?.tokenType === "USER") {
      const pgRes = await fetch(
        `${IG_BASE}/${pageId}?fields=access_token&access_token=${encodeURIComponent(token)}`
      );
      const pgJ = (await pgRes.json()) as { access_token?: string };
      if (pgJ.access_token) postToken = pgJ.access_token;
    }

    const endpoint = imageUrl ? `${IG_BASE}/${pageId}/photos` : `${IG_BASE}/${pageId}/feed`;
    const body: Record<string, string> = { access_token: postToken };
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
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

export default router;
