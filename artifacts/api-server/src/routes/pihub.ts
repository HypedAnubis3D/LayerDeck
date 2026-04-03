import { Router } from 'express';
import { logger } from '../lib/logger';

const router = Router();

function classifyError(e: any): { hint: string; code: string } {
  const msg = (e?.message || '').toLowerCase();
  const cause = (e?.cause?.message || e?.cause?.code || '').toLowerCase();
  const combined = msg + ' ' + cause;

  if (combined.includes('eof') || combined.includes('unexpected') || combined.includes('tls') || combined.includes('ssl')) {
    return { code: 'funnel_down', hint: 'Tailscale Funnel is not running on the Pi. Run: sudo tailscale funnel --bg 3000' };
  }
  if (combined.includes('econnrefused') || combined.includes('connection refused')) {
    return { code: 'refused', hint: 'Pi Hub server is not running on port 3000. Check your Pi Hub service.' };
  }
  if (combined.includes('abort') || combined.includes('timeout')) {
    return { code: 'timeout', hint: 'Request timed out — Pi may be sleeping or Funnel is slow.' };
  }
  if (combined.includes('enotfound') || combined.includes('getaddrinfo') || combined.includes('dns')) {
    return { code: 'dns', hint: 'Cannot resolve Pi Hub hostname. Check your Tailscale Funnel URL.' };
  }
  return { code: 'unreachable', hint: 'Pi Hub unreachable.' };
}

// Proxy Pi Hub status through the server to avoid mixed-content browser blocks.
// Timeout is 7.5s — slightly under the frontend's 8s so the server always responds.
router.get('/status', async (req, res) => {
  const hubUrl = req.query.hub as string;
  if (!hubUrl) {
    return res.status(400).json({ error: 'Missing hub URL' });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const upstream = await fetch(`${hubUrl}/status`, { signal: controller.signal });
    clearTimeout(timer);
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Pi Hub returned '+upstream.status });
    }
    const data = await upstream.json();
    return res.json(data);
  } catch (e: any) {
    const { hint, code } = classifyError(e);
    logger.warn({ err: e?.message, cause: e?.cause?.message || e?.cause?.code, code }, '[PiHub] Status proxy failed');
    return res.status(502).json({ error: 'Pi Hub unreachable', code, hint, detail: e?.message });
  }
});

// Proxy control commands to Pi Hub
router.post('/control', async (req, res) => {
  const hubUrl = req.query.hub as string;
  if (!hubUrl) {
    return res.status(400).json({ error: 'Missing hub URL' });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const upstream = await fetch(`${hubUrl}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await upstream.json().catch(() => ({ ok: true }));
    return res.json(data);
  } catch (e: any) {
    const { hint, code } = classifyError(e);
    logger.warn({ err: e?.message, cause: e?.cause?.message || e?.cause?.code, code }, '[PiHub] Control proxy failed');
    return res.status(502).json({ error: 'Pi Hub unreachable', code, hint });
  }
});

// Proxy AMS set-slot to Pi Hub
router.post('/ams-set-slot', async (req, res) => {
  const hubUrl = req.query.hub as string;
  if (!hubUrl) return res.status(400).json({ error: 'Missing hub URL' });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const upstream = await fetch(`${hubUrl}/ams/set-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await upstream.json().catch(() => ({ ok: true }));
    return res.json(data);
  } catch (e: any) {
    const { hint, code } = classifyError(e);
    logger.warn({ err: e?.message }, '[PiHub] ams-set-slot proxy failed');
    return res.status(502).json({ error: 'Pi Hub unreachable', code, hint });
  }
});

// Proxy AMS load to Pi Hub
router.post('/ams-load', async (req, res) => {
  const hubUrl = req.query.hub as string;
  if (!hubUrl) return res.status(400).json({ error: 'Missing hub URL' });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const upstream = await fetch(`${hubUrl}/ams/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await upstream.json().catch(() => ({ ok: true }));
    return res.json(data);
  } catch (e: any) {
    const { hint, code } = classifyError(e);
    logger.warn({ err: e?.message }, '[PiHub] ams-load proxy failed');
    return res.status(502).json({ error: 'Pi Hub unreachable', code, hint });
  }
});

// Proxy AMS unload to Pi Hub
router.post('/ams-unload', async (req, res) => {
  const hubUrl = req.query.hub as string;
  if (!hubUrl) return res.status(400).json({ error: 'Missing hub URL' });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const upstream = await fetch(`${hubUrl}/ams/unload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await upstream.json().catch(() => ({ ok: true }));
    return res.json(data);
  } catch (e: any) {
    const { hint, code } = classifyError(e);
    logger.warn({ err: e?.message }, '[PiHub] ams-unload proxy failed');
    return res.status(502).json({ error: 'Pi Hub unreachable', code, hint });
  }
});

// Proxy AMS set-ext-spool to Pi Hub (external/virtual spool, no AMS)
router.post('/ams-set-ext-spool', async (req, res) => {
  const hubUrl = req.query.hub as string;
  if (!hubUrl) return res.status(400).json({ error: 'Missing hub URL' });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const upstream = await fetch(`${hubUrl}/ams/set-ext-spool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await upstream.json().catch(() => ({ ok: true }));
    return res.json(data);
  } catch (e: any) {
    const { hint, code } = classifyError(e);
    logger.warn({ err: e?.message }, '[PiHub] ams-set-ext-spool proxy failed');
    return res.status(502).json({ error: 'Pi Hub unreachable', code, hint });
  }
});

// Proxy health-cron update to Pi Hub
router.post('/health-cron', async (req, res) => {
  const hubUrl = req.query.hub as string;
  if (!hubUrl) return res.status(400).json({ error: 'Missing hub URL' });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    const upstream = await fetch(`${hubUrl}/health/cron`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await upstream.json().catch(() => ({ ok: true }));
    return res.json(data);
  } catch (e: any) {
    const { hint, code } = classifyError(e);
    logger.warn({ err: e?.message, cause: e?.cause?.message }, '[PiHub] health-cron proxy failed');
    return res.status(502).json({ error: 'Pi Hub unreachable', code, hint });
  }
});

export default router;
