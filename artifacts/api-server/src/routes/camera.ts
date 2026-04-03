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

async function proxyFetch(url: string, timeoutMs = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const res = await fetch(url, { signal: ctrl.signal });
  clearTimeout(t);
  return res;
}

// ── JPEG snapshot ─────────────────────────────────────────────────────────────
// GET /api/camera/snapshot?base=<go2rtcUrl>&src=<streamName>
router.get('/snapshot', async (req, res) => {
  const base = sanitizeBase(req.query.base as string);
  const src = req.query.src as string;
  if (!base || !src) return res.status(400).json({ error: 'Missing base or src' });

  const upstream_url = `${base}/api/frame.jpeg?src=${encodeURIComponent(src)}`;
  try {
    const upstream = await proxyFetch(upstream_url, 8000);
    if (!upstream.ok) return res.status(upstream.status).end();
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    return res.send(buf);
  } catch (e: any) {
    logger.warn({ err: e?.message, upstream_url }, '[Camera] Snapshot failed');
    return res.status(502).json({ error: 'go2rtc unreachable', detail: e?.message });
  }
});

// ── HLS playlist (rewrite segment URLs to go through this proxy) ───────────
// GET /api/camera/hls.m3u8?base=<go2rtcUrl>&src=<streamName>
router.get('/hls.m3u8', async (req, res) => {
  const base = sanitizeBase(req.query.base as string);
  const src = req.query.src as string;
  if (!base || !src) return res.status(400).json({ error: 'Missing base or src' });

  const upstream_url = `${base}/api/stream.m3u8?src=${encodeURIComponent(src)}`;
  try {
    const upstream = await proxyFetch(upstream_url, 8000);
    if (!upstream.ok) return res.status(upstream.status).end();

    const text = await upstream.text();

    // Rewrite each URI line (lines that don't start with # and aren't empty).
    // go2rtc emits segments as relative paths like "stream000.ts?src=a1" or
    // absolute paths starting with /api/. Make them absolute then route
    // through /api/camera/segment?url=<encoded-absolute>.
    const rewritten = text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      let absolute: string;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        absolute = trimmed;
      } else if (trimmed.startsWith('/')) {
        // Root-relative — combine with go2rtc origin
        const origin = new URL(base).origin;
        absolute = origin + trimmed;
      } else {
        // Relative to /api/ directory
        const withSrc = trimmed.includes('src=') ? trimmed : trimmed + (trimmed.includes('?') ? '&' : '?') + 'src=' + encodeURIComponent(src);
        absolute = `${base}/api/${withSrc}`;
      }

      return `/api/camera/segment?url=${encodeURIComponent(absolute)}`;
    }).join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(rewritten);
  } catch (e: any) {
    logger.warn({ err: e?.message, upstream_url }, '[Camera] HLS playlist failed');
    return res.status(502).json({ error: 'go2rtc unreachable', detail: e?.message });
  }
});

// ── HLS segment passthrough ────────────────────────────────────────────────
// GET /api/camera/segment?url=<absoluteSegmentUrl>
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
    const upstream = await proxyFetch(segUrl, 12000);
    if (!upstream.ok) return res.status(upstream.status).end();
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'video/MP2T');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    return res.send(buf);
  } catch (e: any) {
    logger.warn({ err: e?.message, segUrl }, '[Camera] Segment failed');
    return res.status(502).end();
  }
});

export default router;
