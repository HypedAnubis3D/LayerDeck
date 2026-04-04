import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();
const IG_BASE = "https://graph.facebook.com/v21.0";
const KNOWN_PAGE_ID = process.env.META_PAGE_ID ?? "445455645311970";

// Disk storage for uploaded media — served at /media/:filename
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage: diskStorage, limits: { fileSize: 200 * 1024 * 1024 } });

interface IgInfo {
  id: string;
  username: string | null;
  pageId: string | null;
  tokenType: "USER" | "SYSTEM_USER" | "PAGE" | "unknown";
  missingScopes: string[];
}

async function resolveIgInfo(token: string): Promise<IgInfo | null> {
  const appId = process.env.META_APP_ID ?? "4317363561863449";
  const appSecret = process.env.META_APP_SECRET;
  let tokenType: IgInfo["tokenType"] = "unknown";
  let scopes: string[] = [];
  let granularPageId: string | null = null;
  let granularIgId: string | null = null;

  if (appSecret) {
    try {
      const appToken = `${appId}|${appSecret}`;
      const r = await fetch(
        `${IG_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`
      );
      const j = (await r.json()) as {
        data?: {
          type?: string; is_valid?: boolean; scopes?: string[];
          granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
        };
      };
      const d = j?.data;
      if (!d?.is_valid) return null;
      tokenType = (d.type ?? "unknown") as IgInfo["tokenType"];
      scopes = d.scopes ?? [];
      const granular = d.granular_scopes ?? [];
      granularPageId = granular.find(s => s.scope === "pages_show_list")?.target_ids?.[0] ?? null;
      granularIgId = granular.find(s => s.scope === "instagram_content_publish")?.target_ids?.[0] ?? null;
    } catch { /* proceed */ }
  }

  const missingScopes: string[] = [];
  if (scopes.length && !scopes.includes("pages_read_engagement")) missingScopes.push("pages_read_engagement");
  if (scopes.length && !scopes.includes("instagram_content_publish")) missingScopes.push("instagram_content_publish");

  // Try known page IDs to resolve IG account
  for (const pageId of [...new Set([KNOWN_PAGE_ID, granularPageId].filter(Boolean) as string[])]) {
    try {
      const r = await fetch(`${IG_BASE}/${pageId}?fields=id,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`);
      const j = (await r.json()) as { instagram_business_account?: { id: string; username?: string } };
      if (j.instagram_business_account?.id) {
        return { id: j.instagram_business_account.id, username: j.instagram_business_account.username ?? null, pageId, tokenType, missingScopes };
      }
    } catch { /* try next */ }
  }

  if (granularIgId) return { id: granularIgId, username: null, pageId: granularPageId, tokenType, missingScopes };
  return null;
}

let _cachedIgInfo: IgInfo | null | undefined = undefined;
async function getIgInfo(token: string): Promise<IgInfo | null> {
  if (_cachedIgInfo !== undefined) return _cachedIgInfo;
  _cachedIgInfo = await resolveIgInfo(token);
  return _cachedIgInfo;
}

// Build the public base URL for media files (served under /api/social/media)
function getMediaBaseUrl(req: import("express").Request): string {
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) return `https://${domain}/api/social/media`;
  const proto = req.protocol;
  const host = req.get("host") ?? "localhost";
  return `${proto}://${host}/api/social/media`;
}

// GET /api/social/media/:filename — serve uploaded files
router.get("/media/:filename", (req, res) => {
  const filename = path.basename(req.params.filename); // strip path traversal
  res.sendFile(path.join(UPLOADS_DIR, filename));
});

// GET /api/social/status
router.get("/status", async (_req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.json({ ok: false, error: "META_ACCESS_TOKEN not set" });
  try {
    const igInfo = await getIgInfo(token);
    if (!igInfo) return res.json({ ok: false, error: "Could not resolve Instagram Business Account. Check token and META_APP_SECRET." });
    const canPublish = igInfo.missingScopes.length === 0;
    return res.json({
      ok: canPublish, igId: igInfo.id, igUsername: igInfo.username, pageId: igInfo.pageId,
      tokenType: igInfo.tokenType, missingScopes: igInfo.missingScopes,
      warning: igInfo.missingScopes.length > 0 ? `Token missing: ${igInfo.missingScopes.join(", ")}` : null,
    });
  } catch (e) {
    return res.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// POST /api/social/upload — save media file to local disk and return a public URL
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  const base = getMediaBaseUrl(req);
  const publicUrl = `${base}/${req.file.filename}`;
  return res.json({ ok: true, url: publicUrl, mimeType: req.file.mimetype, size: req.file.size });
});

// POST /api/social/instagram — publish to Instagram (post/reel/story)
router.post("/instagram", async (req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "META_ACCESS_TOKEN not set" });

  const { mediaUrl, imageUrl, caption, postType = "post" } = req.body as {
    mediaUrl?: string; imageUrl?: string; caption?: string; postType?: "post" | "reel" | "story";
  };
  const resolvedMedia = mediaUrl ?? imageUrl;
  if (!resolvedMedia) return res.status(400).json({ error: "mediaUrl required" });
  if (!caption && postType !== "story") return res.status(400).json({ error: "caption required" });

  try {
    const igInfo = await getIgInfo(token);
    if (!igInfo?.id) return res.status(400).json({ error: "Cannot resolve Instagram Business Account ID." });

    // Build container payload based on post type
    const isVideo = postType === "reel" || resolvedMedia.match(/\.(mp4|mov|avi|mkv|webm)$/i);
    const containerBody: Record<string, string | boolean> = { access_token: token };

    if (postType === "reel") {
      containerBody.media_type = "REELS";
      containerBody.video_url = resolvedMedia;
      containerBody.share_to_feed = true;
      if (caption) containerBody.caption = caption;
    } else if (postType === "story") {
      containerBody.media_type = "STORIES";
      if (isVideo) containerBody.video_url = resolvedMedia;
      else containerBody.image_url = resolvedMedia;
    } else {
      // regular post
      if (isVideo) {
        containerBody.media_type = "VIDEO";
        containerBody.video_url = resolvedMedia;
      } else {
        containerBody.image_url = resolvedMedia;
      }
      if (caption) containerBody.caption = caption;
    }

    // Step 1: create media container
    const createRes = await fetch(`${IG_BASE}/${igInfo.id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    });
    const createJson = (await createRes.json()) as { id?: string; error?: { message: string } };
    if (createJson.error) {
      return res.status(400).json({
        error: createJson.error.message,
        hint: "Ensure the media URL is publicly accessible.",
      });
    }

    const containerId = createJson.id;
    if (!containerId) return res.status(400).json({ error: "Failed to create media container" });

    // For videos/reels, poll until container is ready (up to 60s)
    if (isVideo) {
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(`${IG_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
        const statusJson = (await statusRes.json()) as { status_code?: string };
        if (statusJson.status_code === "FINISHED") break;
        if (statusJson.status_code === "ERROR") return res.status(400).json({ error: "Video processing failed on Instagram" });
      }
    }

    // Step 2: publish
    const publishRes = await fetch(`${IG_BASE}/${igInfo.id}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: containerId, access_token: token }),
    });
    const publishJson = (await publishRes.json()) as { id?: string; error?: { message: string } };
    if (publishJson.error) return res.status(400).json({ error: publishJson.error.message });

    return res.json({ ok: true, id: publishJson.id, igId: igInfo.id, username: igInfo.username, postType });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

// POST /api/social/facebook — post to the HypedAnubis3D Facebook Page
router.post("/facebook", async (req, res) => {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "META_ACCESS_TOKEN not set" });
  const { message, imageUrl, mediaUrl } = req.body as { message?: string; imageUrl?: string; mediaUrl?: string };
  if (!message) return res.status(400).json({ error: "message required" });
  const photo = mediaUrl ?? imageUrl;

  try {
    const igInfo = await getIgInfo(token);
    const pageId = igInfo?.pageId ?? KNOWN_PAGE_ID;

    // Always try to get a Page-scoped token — both USER and SYSTEM_USER tokens
    // may need this for pages_manage_posts to work on the /photos and /feed endpoints
    let postToken = token;
    const pgRes = await fetch(`${IG_BASE}/${pageId}?fields=access_token&access_token=${encodeURIComponent(token)}`);
    const pgJ = (await pgRes.json()) as { access_token?: string };
    if (pgJ.access_token) postToken = pgJ.access_token;

    let postJson: { id?: string; post_id?: string; error?: { message: string; code?: number } };

    if (photo) {
      // Post photo to Facebook Page: use /photos with published=true
      const body = { url: photo, caption: message, published: "true", access_token: postToken };
      const photoRes = await fetch(`${IG_BASE}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      postJson = (await photoRes.json()) as typeof postJson;

      // Fallback: if /photos fails, try /feed with link attachment
      if (postJson.error) {
        const feedBody = { message: message, link: photo, access_token: postToken };
        const feedRes = await fetch(`${IG_BASE}/${pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(feedBody),
        });
        postJson = (await feedRes.json()) as typeof postJson;
      }
    } else {
      // Text-only post
      const body = { message: message, access_token: postToken };
      const feedRes = await fetch(`${IG_BASE}/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      postJson = (await feedRes.json()) as typeof postJson;
    }

    if (postJson.error) return res.status(400).json({ error: postJson.error.message });
    return res.json({ ok: true, id: postJson.post_id ?? postJson.id });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

export default router;
