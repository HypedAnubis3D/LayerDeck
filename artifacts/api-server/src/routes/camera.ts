import { Router } from 'express';
import { logger } from '../lib/logger';

const router = Router();

function sanitizeBase(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return raw.replace(/\/$/, '');
  } catch {
    return null;
  }
}

// Resolve a URL line from an m3u8 relative to the playlist URL it came from
function resolveM3u8Url(line: string, playlistUrl: string): string {
  if (line.startsWith('http://') || line.startsWith('https://')) return line;
  // Root-relative (/api/...)
  if (line.startsWith('/')) {
    const u = new URL(playlistUrl);
    return u.origin + line;
  }
  // Path-relative: resolve against the playlist's directory
  const base = playlistUrl.split('?')[0].replace(/\/[^/]+$/, '/');
  return base + line;
}

// Rewrite URI lines in an m3u8 body so they go through /api/camera/segment
function rewriteM3u8(text: string, playlistUrl: string): string {
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const absolute = resolveM3u8Url(trimmed, playlistUrl);
    return `/api/camera/segment?url=${encodeURIComponent(absolute)}`;
  }).join('\n');
}

function isM3u8(contentType: string | null, body: string): boolean {
  if (contentType && (contentType.includes('mpegurl') || contentType.includes('m3u8'))) return true;
  return body.trimStart().startsWith('#EXTM3U');
}

// ── JPEG snapshot ──────────────────────────────────────────────────────────
// GET /api/camera/snapshot?base=<go2rtcUrl>&src=<streamName>
router.get('/snapshot', async (req, res) => {
  const base = sanitizeBase(req.query.base as string);
  const src = req.query.src as string;
  if (!base || !src) return res.status(400).json({ error: 'Missing base or src' });

  const upstreamUrl = `${base}/api/frame.jpeg?src=${encodeURIComponent(src)}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const upstream = await fetch(upstreamUrl, { signal: ctrl.signal });
    clearTimeout(t);
    if (!upstream.ok) return res.status(upstream.status).end();
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    return res.send(buf);
  } catch (e: any) {
    logger.warn({ err: e?.message, upstreamUrl }, '[Camera] Snapshot failed');
    return res.status(502).json({ error: 'go2rtc unreachable', detail: e?.message });
  }
});

// ── MJPEG live stream (piped — works as <img src> in all browsers) ─────────
// GET /api/camera/mjpeg?base=<go2rtcUrl>&src=<streamName>
router.get('/mjpeg', async (req, res) => {
  const base = sanitizeBase(req.query.base as string);
  const src = req.query.src as string;
  if (!base || !src) return res.status(400).json({ error: 'Missing base or src' });

  const upstreamUrl = `${base}/api/stream.mjpeg?src=${encodeURIComponent(src)}`;
  const ctrl = new AbortController();

  // Abort upstream when client disconnects
  req.on('close', () => ctrl.abort());

  try {
    const upstream = await fetch(upstreamUrl, { signal: ctrl.signal });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'go2rtc returned ' + upstream.status });
    }
    if (!upstream.body) return res.status(502).json({ error: 'No stream body' });

    res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'multipart/x-mixed-replace;boundary=--boundary');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = (upstream.body as ReadableStream<Uint8Array>).getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || res.writableEnded) break;
          res.write(Buffer.from(value));
        }
      } catch {
        // Client disconnected or upstream closed — expected
      } finally {
        if (!res.writableEnded) res.end();
      }
    };
    pump();
  } catch (e: any) {
    if (!res.headersSent) {
      logger.warn({ err: e?.message, upstreamUrl }, '[Camera] MJPEG stream failed');
      res.status(502).json({ error: 'go2rtc unreachable', detail: e?.message });
    }
  }
});

// ── HLS master playlist ────────────────────────────────────────────────────
// GET /api/camera/playlist?base=<go2rtcUrl>&src=<streamName>
router.get('/playlist', async (req, res) => {
  const base = sanitizeBase(req.query.base as string);
  const src = req.query.src as string;
  if (!base || !src) return res.status(400).json({ error: 'Missing base or src' });

  const upstreamUrl = `${base}/api/stream.m3u8?src=${encodeURIComponent(src)}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const upstream = await fetch(upstreamUrl, { signal: ctrl.signal });
    clearTimeout(t);
    if (!upstream.ok) return res.status(upstream.status).end();
    const text = await upstream.text();
    const rewritten = rewriteM3u8(text, upstreamUrl);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(rewritten);
  } catch (e: any) {
    logger.warn({ err: e?.message, upstreamUrl }, '[Camera] HLS playlist failed');
    return res.status(502).json({ error: 'go2rtc unreachable', detail: e?.message });
  }
});

// ── HLS segment / sub-playlist passthrough ─────────────────────────────────
// GET /api/camera/segment?url=<absoluteUrl>
// If the upstream response is itself an m3u8, rewrite its URLs too.
router.get('/segment', async (req, res) => {
  const urlParam = req.query.url as string;
  if (!urlParam) return res.status(400).json({ error: 'Missing url' });

  let segUrl: string;
  try {
    segUrl = decodeURIComponent(urlParam);
    const u = new URL(segUrl);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol');
  } catch {
    return res.status(400).json({ error: 'Invalid segment URL' });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const upstream = await fetch(segUrl, { signal: ctrl.signal });
    clearTimeout(t);
    if (!upstream.ok) return res.status(upstream.status).end();

    const ct = upstream.headers.get('Content-Type') || '';

    // If this is a sub-playlist (m3u8), rewrite its segment URLs too
    if (ct.includes('mpegurl') || ct.includes('m3u8') || segUrl.includes('.m3u8')) {
      const text = await upstream.text();
      if (isM3u8(ct, text)) {
        const rewritten = rewriteM3u8(text, segUrl);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store');
        return res.send(rewritten);
      }
    }

    // Binary segment (video/MP2T or similar)
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', ct || 'video/MP2T');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    return res.send(buf);
  } catch (e: any) {
    logger.warn({ err: e?.message, segUrl }, '[Camera] Segment failed');
    return res.status(502).end();
  }
});

export default router;
