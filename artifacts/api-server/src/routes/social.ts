import { Router } from "express";

const router = Router();
const IG_BASE = "https://graph.facebook.com/v21.0";

async function getIgUserId(token: string): Promise<string | null> {
  try {
    const r = await fetch(
      `${IG_BASE}/me/accounts?access_token=${encodeURIComponent(token)}&fields=id,name,instagram_business_account{id,username}`
    );
    const j = (await r.json()) as {
      data?: Array<{ instagram_business_account?: { id: string; username?: string } }>;
    };
    return j?.data?.[0]?.instagram_business_account?.id ?? null;
  } catch {
    return null;
  }
}

async function getIgInfo(token: string): Promise<{ id: string; username: string } | null> {
  try {
    const r = await fetch(
      `${IG_BASE}/me/accounts?access_token=${encodeURIComponent(token)}&fields=id,name,instagram_business_account{id,username}`
    );
    const j = (await r.json()) as {
      data?: Array<{ name?: string; instagram_business_account?: { id: string; username?: string } }>;
    };
    const ib = j?.data?.[0]?.instagram_business_account;
    if (!ib?.id) return null;
    return { id: ib.id, username: ib.username ?? ib.id };
  } catch {
    return null;
  }
}

// GET /api/social/status — check Meta token + return IG username
router.get("/status", async (_req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.json({ ok: false, error: "META_ACCESS_TOKEN not set" });

  try {
    const r = await fetch(
      `${IG_BASE}/me?access_token=${encodeURIComponent(token)}&fields=id,name`
    );
    const j = (await r.json()) as { id?: string; name?: string; error?: { message: string } };
    if (j.error) return res.json({ ok: false, error: j.error.message });

    const igInfo = await getIgInfo(token);
    return res.json({
      ok: true,
      name: j.name,
      igId: igInfo?.id ?? null,
      igUsername: igInfo?.username ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return res.json({ ok: false, error: msg });
  }
});

// POST /api/social/instagram — publish photo post to Instagram Business account
router.post("/instagram", async (req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "META_ACCESS_TOKEN not set" });

  const { imageUrl, caption } = req.body as { imageUrl?: string; caption?: string };
  if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });
  if (!caption) return res.status(400).json({ error: "caption required" });

  try {
    const igId = await getIgUserId(token);
    if (!igId)
      return res
        .status(400)
        .json({ error: "No Instagram Business account linked to this token. Check token permissions." });

    // Step 1: create media container
    const createRes = await fetch(`${IG_BASE}/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
    });
    const createJson = (await createRes.json()) as { id?: string; error?: { message: string } };
    if (createJson.error) return res.status(400).json({ error: createJson.error.message });
    const containerId = createJson.id;
    if (!containerId) return res.status(400).json({ error: "Failed to create media container" });

    // Step 2: publish
    const publishRes = await fetch(`${IG_BASE}/${igId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    });
    const publishJson = (await publishRes.json()) as { id?: string; error?: { message: string } };
    if (publishJson.error) return res.status(400).json({ error: publishJson.error.message });

    return res.json({ ok: true, id: publishJson.id });
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
    // Get first Facebook page ID
    const pagesRes = await fetch(
      `${IG_BASE}/me/accounts?access_token=${encodeURIComponent(token)}&fields=id,name,access_token`
    );
    const pagesJson = (await pagesRes.json()) as {
      data?: Array<{ id: string; name: string; access_token: string }>;
    };
    const page = pagesJson?.data?.[0];
    if (!page) return res.status(400).json({ error: "No Facebook page linked to this token" });

    const endpoint = imageUrl
      ? `${IG_BASE}/${page.id}/photos`
      : `${IG_BASE}/${page.id}/feed`;

    const body: Record<string, string> = { access_token: page.access_token };
    if (imageUrl) {
      body.url = imageUrl;
      body.caption = message;
    } else {
      body.message = message;
    }

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
