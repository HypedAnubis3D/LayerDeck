import { Router } from 'express';
import { logger } from '../lib/logger';

const router = Router();

// Proxy Pi Hub status through the server to avoid mixed-content browser blocks
// The frontend calls /api/pihub/status?hub=http://100.x.x.x:3000
router.get('/status', async (req, res) => {
  const hubUrl = req.query.hub as string;
  if (!hubUrl) {
    return res.status(400).json({ error: 'Missing hub URL' });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const upstream = await fetch(`${hubUrl}/status`, { signal: controller.signal });
    clearTimeout(timer);
    const data = await upstream.json();
    return res.json(data);
  } catch (e: any) {
    logger.warn({ err: e?.message }, '[PiHub] Status proxy failed');
    return res.status(502).json({ error: 'Pi Hub unreachable', detail: e?.message });
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
    const timer = setTimeout(() => controller.abort(), 5000);
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
    logger.warn({ err: e?.message }, '[PiHub] Control proxy failed');
    return res.status(502).json({ error: 'Pi Hub unreachable', detail: e?.message });
  }
});

export default router;
