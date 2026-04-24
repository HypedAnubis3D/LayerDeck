import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";

const IG_BASE = "https://graph.facebook.com/v21.0";
const KNOWN_PAGE_ID = process.env.META_PAGE_ID ?? "445455645311970";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

interface SocialPost {
  id: string;
  status: string;
  scheduledFor?: number;
  postedAt?: number;
  mediaUrl?: string;
  imageUrl?: string;
  mediaUrls?: string[];
  caption?: string;
  postType?: string;
  error?: string;
  igId?: string;
  serverPosting?: boolean;
}

let _cachedIgId: string | null | undefined = undefined;

async function resolveIgId(token: string): Promise<string | null> {
  if (_cachedIgId !== undefined) return _cachedIgId;
  for (const pageId of [KNOWN_PAGE_ID]) {
    try {
      const r = await fetch(
        `${IG_BASE}/${pageId}?fields=id,instagram_business_account{id}&access_token=${encodeURIComponent(token)}`
      );
      const j = (await r.json()) as { instagram_business_account?: { id: string } };
      if (j.instagram_business_account?.id) {
        _cachedIgId = j.instagram_business_account.id;
        return _cachedIgId;
      }
    } catch { /* try next */ }
  }
  _cachedIgId = null;
  return null;
}

function isVideo(url: string): boolean {
  return !!url.match(/\.(mp4|mov|avi|mkv|webm)(\?|$)/i);
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function publishPost(
  post: SocialPost,
  token: string,
  igId: string
): Promise<{ success: true; igPostId: string } | { success: false; error: string }> {
  const media = post.mediaUrl ?? post.imageUrl ?? post.mediaUrls?.[0];
  if (!media) return { success: false, error: "No media URL on post" };

  const postType = post.postType ?? "post";
  const mediaIsVideo = isVideo(media);

  const containerBody: Record<string, string | boolean> = { access_token: token };
  if (postType === "story") {
    containerBody.media_type = "STORIES";
    if (mediaIsVideo) containerBody.video_url = media;
    else containerBody.image_url = media;
  } else if (mediaIsVideo) {
    containerBody.media_type = "REELS";
    containerBody.video_url = media;
    containerBody.share_to_feed = true;
    if (post.caption) containerBody.caption = post.caption;
  } else {
    containerBody.image_url = media;
    if (post.caption) containerBody.caption = post.caption;
  }

  // Step 1: create container
  const createRes = await fetch(`${IG_BASE}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(containerBody),
  });
  const createJson = (await createRes.json()) as { id?: string; error?: { message: string } };
  if (createJson.error) return { success: false, error: createJson.error.message };
  const containerId = createJson.id;
  if (!containerId) return { success: false, error: "No container ID returned" };

  // Step 2: for videos, poll until the container is processed (up to 5 min)
  if (mediaIsVideo) {
    for (let i = 0; i < 30; i++) {
      await sleep(10_000);
      try {
        const sr = await fetch(
          `${IG_BASE}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
        );
        const sj = (await sr.json()) as { status_code?: string };
        if (sj.status_code === "FINISHED") break;
        if (sj.status_code === "ERROR") return { success: false, error: "Video processing failed on Instagram" };
      } catch { /* keep polling */ }
    }
  }

  // Step 3: publish
  const pubRes = await fetch(`${IG_BASE}/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerId, access_token: token }),
  });
  const pubJson = (await pubRes.json()) as { id?: string; error?: { message: string } };
  if (pubJson.error) return { success: false, error: pubJson.error.message };
  if (!pubJson.id) return { success: false, error: "Publish returned no post ID" };

  return { success: true, igPostId: pubJson.id };
}

// Track which user IDs are currently being processed so we don't double-fire
const _activeUsers = new Set<string>();

async function runScheduledPosts() {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return;

  const sb = getSupabase();
  if (!sb) return;

  const now = Date.now();

  // Fetch all users' socialQueue rows from Supabase
  let rows: Array<{ user_id: string; payload: string }>;
  try {
    const { data, error } = await sb
      .from("ha3d_user_data")
      .select("user_id,payload")
      .eq("collection", "socialQueue");
    if (error) {
      logger.warn({ error }, "[socialScheduler] Supabase read error");
      return;
    }
    rows = (data ?? []) as typeof rows;
  } catch (err) {
    logger.warn({ err }, "[socialScheduler] Supabase read exception");
    return;
  }

  // Resolve IG account ID (cached)
  let igId: string | null;
  try {
    igId = await resolveIgId(token);
  } catch {
    igId = null;
  }
  if (!igId) {
    logger.warn("[socialScheduler] Could not resolve Instagram account — skipping tick");
    return;
  }

  for (const row of rows) {
    if (_activeUsers.has(row.user_id)) continue;

    let queue: SocialPost[];
    try {
      queue = JSON.parse(row.payload) as SocialPost[];
    } catch {
      continue;
    }
    if (!Array.isArray(queue)) continue;

    const due = queue.filter(
      p => p.status === "scheduled" && p.scheduledFor != null && p.scheduledFor <= now
    );
    if (!due.length) continue;

    _activeUsers.add(row.user_id);
    const userId = row.user_id;

    // Process in background so we don't block the tick loop
    void (async () => {
      try {
        // Re-fetch the freshest queue before modifying to avoid overwriting concurrent changes
        const { data: fresh } = await sb
          .from("ha3d_user_data")
          .select("payload")
          .eq("user_id", userId)
          .eq("collection", "socialQueue")
          .maybeSingle();
        let freshQueue: SocialPost[] = queue;
        if (fresh?.payload) {
          try { freshQueue = JSON.parse(fresh.payload as string); } catch { /* keep original */ }
        }

        let changed = false;
        for (const duePost of due) {
          const post = freshQueue.find(p => p.id === duePost.id);
          if (!post || post.status !== "scheduled") continue; // already handled

          // Mark as posting (with server flag so the browser won't reset it on page load)
          post.status = "posting";
          post.serverPosting = true;
          changed = true;

          // Write the 'posting' state first so the browser shows correct status
          await sb.from("ha3d_user_data").upsert(
            { user_id: userId, collection: "socialQueue", payload: JSON.stringify(freshQueue), updated_at: new Date().toISOString() },
            { onConflict: "user_id,collection" }
          );

          logger.info({ postId: post.id, scheduledFor: post.scheduledFor }, "[socialScheduler] Publishing scheduled post");

          const result = await publishPost(post, token, igId!);

          if (result.success) {
            post.status = "posted";
            post.postedAt = Date.now();
            post.igId = result.igPostId;
            post.serverPosting = false;
            logger.info({ postId: post.id, igPostId: result.igPostId }, "[socialScheduler] ✅ Published");
          } else {
            post.status = "failed";
            post.error = result.error;
            post.serverPosting = false;
            logger.warn({ postId: post.id, error: result.error }, "[socialScheduler] ❌ Failed");
          }
          changed = true;
        }

        if (changed) {
          const { error } = await sb.from("ha3d_user_data").upsert(
            { user_id: userId, collection: "socialQueue", payload: JSON.stringify(freshQueue), updated_at: new Date().toISOString() },
            { onConflict: "user_id,collection" }
          );
          if (error) logger.warn({ error }, "[socialScheduler] Failed to write final status back to Supabase");
        }
      } finally {
        _activeUsers.delete(userId);
      }
    })();
  }
}

// On startup, any post that was left in status:"posting" with serverPosting:true means the
// server restarted in the middle of a publish. Reset them to "failed" so the user can retry.
async function cleanupStuckPosts() {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data, error } = await sb
      .from("ha3d_user_data")
      .select("user_id,payload")
      .eq("collection", "socialQueue");
    if (error || !data?.length) return;

    for (const row of data) {
      let queue: SocialPost[];
      try { queue = JSON.parse(row.payload as string); } catch { continue; }
      if (!Array.isArray(queue)) continue;

      let changed = false;
      for (const post of queue) {
        if (post.status === "posting" && post.serverPosting) {
          logger.warn({ postId: post.id }, "[socialScheduler] Resetting stuck server-owned post to failed (server restarted mid-publish)");
          post.status = "failed";
          post.serverPosting = false;
          post.error = "Server restarted while publishing — click Post to retry.";
          changed = true;
        }
      }
      if (changed) {
        await sb.from("ha3d_user_data").upsert(
          { user_id: row.user_id, collection: "socialQueue", payload: JSON.stringify(queue), updated_at: new Date().toISOString() },
          { onConflict: "user_id,collection" }
        );
      }
    }
  } catch (err) {
    logger.warn({ err }, "[socialScheduler] cleanupStuckPosts error (non-fatal)");
  }
}

export function startSocialScheduler() {
  const tick = async () => {
    try {
      await runScheduledPosts();
    } catch (err) {
      logger.error({ err }, "[socialScheduler] Uncaught error in tick");
    }
  };
  // Clean up any posts stuck in "posting" from a previous server run before starting
  void cleanupStuckPosts();
  // Run immediately and then every 60 seconds
  void tick();
  setInterval(() => void tick(), 60_000);
  logger.info("[socialScheduler] Social post scheduler started (60s interval)");
}
