import { Router } from 'express';
import { logger } from '../lib/logger';

const router = Router();

const TAPO_CLOUD = 'https://wap.tplinkcloud.com';
const TERM_UUID  = 'layerdeck-hub-tapo-v1';

// ── Auth token cache ────────────────────────────────────────────────────────
let _token: string | null = null;
let _tokenAt = 0;
const TOKEN_TTL = 23 * 60 * 60 * 1000; // 23 h

async function tapoLogin(force = false): Promise<string> {
  const email    = process.env.TAPO_EMAIL;
  const password = process.env.TAPO_PASSWORD;
  if (!email || !password) throw new Error('TAPO_EMAIL and TAPO_PASSWORD env vars are not set');

  if (!force && _token && Date.now() - _tokenAt < TOKEN_TTL) return _token;

  const res = await fetch(TAPO_CLOUD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'login',
      params: {
        appType:      'Tapo_Ios',
        cloudUserName: email,
        cloudPassword: password,
        terminalUUID: TERM_UUID,
      },
    }),
  });
  const j = await res.json() as any;
  if (j.error_code !== 0) throw new Error(`Tapo login failed (${j.error_code}): ${j.msg ?? JSON.stringify(j)}`);
  _token   = j.result.token as string;
  _tokenAt = Date.now();
  return _token;
}

// ── Device list cache ───────────────────────────────────────────────────────
interface DeviceMeta { alias: string; appServerUrl: string; model: string; }
let _devCache: Map<string, DeviceMeta> = new Map();
let _devCacheAt = 0;
const DEV_CACHE_TTL = 5 * 60 * 1000; // 5 min

async function tapoGetDevices(token: string, force = false): Promise<Array<{ deviceId: string } & DeviceMeta>> {
  if (!force && _devCache.size > 0 && Date.now() - _devCacheAt < DEV_CACHE_TTL) {
    return Array.from(_devCache.entries()).map(([id, d]) => ({ deviceId: id, ...d }));
  }

  const res = await fetch(`${TAPO_CLOUD}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'getDeviceList', params: {} }),
  });
  const j = await res.json() as any;
  if (j.error_code !== 0) throw new Error(`getDeviceList failed (${j.error_code}): ${j.msg}`);

  const list: any[] = j.result?.deviceList ?? [];
  _devCache.clear();
  for (const d of list) {
    _devCache.set(d.deviceId, {
      alias:        d.alias ?? d.deviceName ?? d.deviceId,
      appServerUrl: d.appServerUrl ?? TAPO_CLOUD,
      model:        d.deviceModel ?? d.deviceType ?? 'Unknown',
    });
  }
  _devCacheAt = Date.now();
  return list.map(d => ({ deviceId: d.deviceId, alias: d.alias ?? d.deviceName ?? d.deviceId, appServerUrl: d.appServerUrl ?? TAPO_CLOUD, model: d.deviceModel ?? d.deviceType ?? 'Unknown' }));
}

// ── Passthrough helper ──────────────────────────────────────────────────────
async function tapoPass(token: string, deviceId: string, serverUrl: string, method: string, params: Record<string,unknown> = {}): Promise<any> {
  const requestData = JSON.stringify({ method, params });
  const res = await fetch(`${serverUrl}/api/v1?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'passthrough', params: { deviceId, requestData } }),
  });
  const j = await res.json() as any;
  if (j.error_code !== 0) throw new Error(`Tapo passthrough '${method}' failed (${j.error_code}): ${j.msg}`);
  const rd = j.result?.responseData;
  const parsed: any = typeof rd === 'string' ? JSON.parse(rd) : rd;
  if (parsed?.error_code && parsed.error_code !== 0) {
    throw new Error(`Device ${method} error (${parsed.error_code}): ${parsed.msg ?? ''}`);
  }
  return parsed;
}

// ── GET /api/tapo/devices ───────────────────────────────────────────────────
// Returns all Tapo devices (any model) with live on/off state.
router.get('/devices', async (req, res) => {
  try {
    const token   = await tapoLogin();
    const devices = await tapoGetDevices(token);

    const withState = await Promise.all(devices.map(async d => {
      try {
        const info = await tapoPass(token, d.deviceId, d.appServerUrl, 'get_device_info');
        return {
          deviceId:  d.deviceId,
          alias:     d.alias,
          model:     d.model,
          on:        !!info?.result?.device_on,
          power_mw:  info?.result?.current_power ?? null,
          ip:        info?.result?.ip ?? null,
        };
      } catch {
        return { deviceId: d.deviceId, alias: d.alias, model: d.model, on: null, power_mw: null, ip: null };
      }
    }));

    return res.json({ ok: true, devices: withState });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg }, '[Tapo] GET /devices failed');
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ── POST /api/tapo/power ────────────────────────────────────────────────────
// Body: { deviceId: string, on: boolean }
//    OR { alias: string, on: boolean }
router.post('/power', async (req, res) => {
  const { deviceId, alias, on } = req.body as { deviceId?: string; alias?: string; on?: boolean };
  if (typeof on !== 'boolean') return res.status(400).json({ ok: false, error: '"on" (boolean) required' });

  try {
    const token   = await tapoLogin();
    const devices = await tapoGetDevices(token);

    let target = deviceId
      ? devices.find(d => d.deviceId === deviceId)
      : devices.find(d => d.alias?.toLowerCase() === alias?.toLowerCase()?.trim());

    if (!target) {
      // Bust device cache once and retry — alias may have changed
      const fresh = await tapoGetDevices(token, true);
      target = deviceId
        ? fresh.find(d => d.deviceId === deviceId)
        : fresh.find(d => d.alias?.toLowerCase() === alias?.toLowerCase()?.trim());
    }
    if (!target) return res.status(404).json({ ok: false, error: `Device not found: ${deviceId ?? alias}` });

    await tapoPass(token, target.deviceId, target.appServerUrl, 'set_device_info', { device_on: on });

    logger.info({ alias: target.alias, deviceId: target.deviceId, on }, '[Tapo] Power command sent');
    return res.json({ ok: true, deviceId: target.deviceId, alias: target.alias, on });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg }, '[Tapo] POST /power failed');
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ── GET /api/tapo/status ────────────────────────────────────────────────────
// Quick on/off state for one device by ID or alias.
router.get('/status', async (req, res) => {
  const { deviceId, alias } = req.query as { deviceId?: string; alias?: string };
  if (!deviceId && !alias) return res.status(400).json({ ok: false, error: 'deviceId or alias required' });

  try {
    const token   = await tapoLogin();
    const devices = await tapoGetDevices(token);
    const target  = deviceId
      ? devices.find(d => d.deviceId === deviceId)
      : devices.find(d => d.alias?.toLowerCase() === (alias as string).toLowerCase());
    if (!target) return res.status(404).json({ ok: false, error: 'Device not found' });

    const info = await tapoPass(token, target.deviceId, target.appServerUrl, 'get_device_info');
    return res.json({ ok: true, deviceId: target.deviceId, alias: target.alias, on: !!info?.result?.device_on, power_mw: info?.result?.current_power ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
