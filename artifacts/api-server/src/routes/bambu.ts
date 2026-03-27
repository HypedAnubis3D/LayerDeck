import { Router } from 'express';
import { logger } from '../lib/logger';

const router = Router();

router.get('/status', async (_req, res) => {
  const email = process.env.BAMBU_EMAIL;
  const password = process.env.BAMBU_PASSWORD;
  if (!email || !password) {
    return res.json({ connected: false, reason: 'No Bambu credentials configured' });
  }
  try {
    const authRes = await fetch('https://bambulab.com/api/sign-in/form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: email, password, apiError: '' }),
    });
    if (!authRes.ok) {
      logger.warn({ status: authRes.status }, 'Bambu auth HTTP error');
      return res.json({ connected: false, reason: `Auth HTTP ${authRes.status}` });
    }
    const authData = await authRes.json() as any;
    const token = authData.token || authData.accessToken || authData.jwt;
    if (!token) {
      return res.json({ connected: false, reason: 'No token in auth response' });
    }
    const devRes = await fetch('https://api.bambulab.com/v1/iot-service/api/user/device', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!devRes.ok) {
      return res.json({ connected: false, reason: `Device list HTTP ${devRes.status}` });
    }
    const devData = await devRes.json() as any;
    const devices: any[] = devData.devices || devData.data?.devices || [];
    return res.json({ connected: true, devices });
  } catch (err: any) {
    logger.error({ err }, 'Bambu status check failed');
    return res.json({ connected: false, reason: err.message || 'Unknown error' });
  }
});

export default router;
