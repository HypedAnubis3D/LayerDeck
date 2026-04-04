import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const router = Router();
const IG_BASE = "https://graph.facebook.com/v21.0";
const KNOWN_PAGE_ID = process.env.META_PAGE_ID ?? "445455645311970";
const STORAGE_BUCKET = "social-media";

// Disk storage — multer writes here for parsing; Supabase takes over persistence
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

// ── Supabase Storage helpers ──────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  // Prefer service role key for server-side uploads (bypasses RLS, can create buckets)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

let _bucketEnsured = false;

async function ensureStorageBucket(): Promise<boolean> {
  if (_bucketEnsured) return true;
  const sb = getSupabase();
  if (!sb) return false;
  try {
    // Check if bucket already exists
    const { data: buckets } = await sb.storage.listBuckets();
    const exists = (buckets ?? []).some((b: { name: string }) => b.name === STORAGE_BUCKET);
    if (exists) { _bucketEnsured = true; return true; }
    // Create bucket (public; no fileSizeLimit arg — Supabase API rejects large values)
    const { error } = await sb.storage.createBucket(STORAGE_BUCKET, { public: true });
    if (error) {
      console.warn("[social] Could not create Supabase bucket:", error.message);
      return false;
    }
    console.info("[social] Created Supabase Storage bucket:", STORAGE_BUCKET);
    _bucketEnsured = true;
    return true;
  } catch (e) {
    console.warn("[social] ensureStorageBucket error:", e);
    return false;
  }
}

async function uploadToSupabase(filePath: string, filename: string, mimetype: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const ready = await ensureStorageBucket();
    if (!ready) return null;
    const buffer = fs.readFileSync(filePath);
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(filename, buffer, { contentType: mimetype, upsert: true });
    if (error) {
      console.warn("[social] Supabase upload failed:", error.message, "— falling back to local disk");
      return null;
    }
    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
    try { fs.unlinkSync(filePath); } catch { /* ignore cleanup error */ }
    console.info("[social] Uploaded to Supabase Storage:", data.publicUrl);
    return data.publicUrl;
  } catch (e) {
    console.warn("[social] Supabase upload error:", e, "— falling back to local disk");
    return null;
  }
}

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

// Build the public base URL for media files (served under /api/social/media).
// Always derived from the incoming request so it works in both dev and production.
function getMediaBaseUrl(req: import("express").Request): string {
  const proto = req.protocol; // "https" in production (trust proxy is set)
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost";
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

// POST /api/social/upload — save single media file; Supabase Storage preferred, local fallback
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  const sbUrl = await uploadToSupabase(req.file.path, req.file.filename, req.file.mimetype);
  const publicUrl = sbUrl ?? `${getMediaBaseUrl(req)}/${req.file.filename}`;
  const storage = sbUrl ? "supabase" : "local";
  return res.json({ ok: true, url: publicUrl, mimeType: req.file.mimetype, size: req.file.size, storage });
});

// POST /api/social/upload/multi — save multiple media files; Supabase preferred, local fallback
router.post("/upload/multi", upload.array("files", 10), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) return res.status(400).json({ error: "No files provided" });
  const base = getMediaBaseUrl(req);
  const results = await Promise.all(
    files.map(async f => {
      const sbUrl = await uploadToSupabase(f.path, f.filename, f.mimetype);
      return { url: sbUrl ?? `${base}/${f.filename}`, storage: sbUrl ? "supabase" : "local" };
    })
  );
  const urls = results.map(r => r.url);
  const allSupabase = results.every(r => r.storage === "supabase");
  return res.json({ ok: true, urls, count: urls.length, storage: allSupabase ? "supabase" : "mixed" });
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
    // Instagram Graph API only supports video Reels — images posted as "reel" must fall back to IMAGE post
    const mediaIsVideo = !!resolvedMedia.match(/\.(mp4|mov|avi|mkv|webm)$/i);
    const isVideo = mediaIsVideo;
    const effectivePostType = (postType === "reel" && !mediaIsVideo) ? "post" : postType;
    const containerBody: Record<string, string | boolean> = { access_token: token };

    if (effectivePostType === "reel") {
      containerBody.media_type = "REELS";
      containerBody.video_url = resolvedMedia;
      containerBody.share_to_feed = true;
      if (caption) containerBody.caption = caption;
    } else if (effectivePostType === "story") {
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

    // For videos/reels, poll until container is ready (up to 45s — stay under proxy timeout)
    if (isVideo) {
      let ready = false;
      for (let i = 0; i < 9; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(`${IG_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`);
        const statusJson = (await statusRes.json()) as { status_code?: string };
        if (statusJson.status_code === "FINISHED") { ready = true; break; }
        if (statusJson.status_code === "ERROR") return res.status(400).json({ error: "Video processing failed on Instagram — check the video format and try again." });
      }
      if (!ready) return res.status(202).json({ ok: false, pending: true, containerId, error: "Video is still processing on Instagram. Try posting again in a minute." });
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
