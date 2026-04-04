import { Router } from 'express';
import { logger } from '../lib/logger';

const router = Router();

const TAPO_CLOUD = 'https://wap.tplinkcloud.com';
const TERM_UUID  = 'layerdeck-hub-tapo-v1';

// ── Auth token cache ────────────────────────────────────────────────────────
let _token: string | null = null;
let _tokenAt = 0;
const TOKEN_TTL = 23 * 60 * 60 * 1000;

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
      params: { appType: 'Tapo_Ios', cloudUserName: email, cloudPassword: password, terminalUUID: TERM_UUID },
    }),
  });
  const j = await res.json() as any;
  if (j.error_code !== 0) {
    _token = null;
    const hint = j.error_code === -20601 ? ' — check TAPO_EMAIL and TAPO_PASSWORD in Replit Secrets' : '';
    throw new Error(`Tapo login failed (${j.error_code}): ${j.msg ?? JSON.stringify(j)}${hint}`);
  }
  _token   = j.result.token as string;
  _tokenAt = Date.now();
  return _token;
}

// ── Alias decode ─────────────────────────────────────────────────────────────
// Tapo cloud API returns some aliases as Base64-encoded strings.
function decodeAlias(raw: string): string {
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    // Only use decoded value if it's printable ASCII/Latin text (not binary garbage)
    if (decoded && /^[\x20-\x7E\u00C0-\u024F\s]+$/.test(decoded)) return decoded.trim();
  } catch {}
  return raw;
}

// ── Device list cache ────────────────────────────────────────────────────────
interface DeviceMeta { alias: string; appServerUrl: string; model: string; }
let _devCache: Map<string, DeviceMeta> = new Map();
let _devCacheAt = 0;
const DEV_CACHE_TTL = 5 * 60 * 1000;

// Plug-type device model prefixes to include (excludes cameras, bulbs, etc.)
const PLUG_MODELS = ['P115', 'P110', 'P100', 'P105', 'P125', 'EP25', 'EP40'];
function isPlug(model: string): boolean {
  const m = model.toUpperCase();
  return PLUG_MODELS.some(p => m.startsWith(p)) || m.includes('PLUG');
}

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

  // Filter to smart plugs only
  const plugs = list.filter(d => isPlug(d.deviceModel ?? d.deviceType ?? ''));

  _devCache.clear();
  for (const d of plugs) {
    _devCache.set(d.deviceId, {
      alias:        decodeAlias(d.alias ?? d.deviceName ?? d.deviceId),
      appServerUrl: d.appServerUrl ?? TAPO_CLOUD,
      model:        d.deviceModel ?? d.deviceType ?? 'Unknown',
    });
  }
  _devCacheAt = Date.now();
  return Array.from(_devCache.entries()).map(([id, d]) => ({ deviceId: id, ...d }));
}

// ── Passthrough helper ───────────────────────────────────────────────────────
async function tapoPass(token: string, deviceId: string, serverUrl: string, method: string, params: Record<string,unknown> = {}): Promise<any> {
  const requestData = JSON.stringify({ method, params });
  // Tapo cloud passthrough endpoint: POST {appServerUrl}?token=TOKEN (no /api/v1 path)
  const url = `${serverUrl}?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'passthrough', params: { deviceId, requestData } }),
  });
  const j = await res.json() as any;
  if (j.error_code !== 0) throw new Error(`Passthrough '${method}' error (${j.error_code}): ${j.msg ?? JSON.stringify(j)}`);
  const rd = j.result?.responseData;
  const parsed: any = typeof rd === 'string' ? JSON.parse(rd) : rd;
  if (parsed?.error_code && parsed.error_code !== 0) {
    throw new Error(`Device '${method}' error (${parsed.error_code}): ${parsed.msg ?? ''}`);
  }
  return parsed;
}

// ── GET /api/tapo/devices ────────────────────────────────────────────────────
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
      } catch (e) {
        logger.warn({ deviceId: d.deviceId, alias: d.alias, err: (e as Error).message }, '[Tapo] get_device_info failed');
        return { deviceId: d.deviceId, alias: d.alias, model: d.model, on: null, power_mw: null, ip: null };
      }
    }));

    logger.info({ count: withState.length }, '[Tapo] Devices fetched');
    return res.json({ ok: true, devices: withState });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg }, '[Tapo] GET /devices failed');
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ── POST /api/tapo/power ─────────────────────────────────────────────────────
router.post('/power', async (req, res) => {
  const { deviceId, alias, on, hubUrl } = req.body as { deviceId?: string; alias?: string; on?: boolean; hubUrl?: string };
  if (typeof on !== 'boolean') return res.status(400).json({ ok: false, error: '"on" (boolean) required' });

  try {
    const token   = await tapoLogin();
    const devices = await tapoGetDevices(token);

    let target = deviceId
      ? devices.find(d => d.deviceId === deviceId)
      : devices.find(d => d.alias?.toLowerCase() === alias?.toLowerCase()?.trim());

    if (!target) {
      const fresh = await tapoGetDevices(token, true);
      target = deviceId
        ? fresh.find(d => d.deviceId === deviceId)
        : fresh.find(d => d.alias?.toLowerCase() === alias?.toLowerCase()?.trim());
    }
    if (!target) return res.status(404).json({ ok: false, error: `Device not found: ${deviceId ?? alias}` });

    try {
      // Try cloud passthrough first
      await tapoPass(token, target.deviceId, target.appServerUrl, 'set_device_info', { device_on: on });
      logger.info({ alias: target.alias, on, via: 'cloud' }, '[Tapo] Power command sent');
    } catch (cloudErr) {
      const cloudMsg = (cloudErr as Error).message ?? '';
      // If device is offline to cloud, fall back to Pi Hub local control
      if (hubUrl && (cloudMsg.includes('-20571') || cloudMsg.toLowerCase().includes('offline'))) {
        logger.warn({ alias: target.alias, on, hubUrl }, '[Tapo] Cloud offline — falling back to Pi Hub local control');
        const hubRes  = await fetch(`${hubUrl}/tapo/power`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alias: target.alias, on }),
          signal: AbortSignal.timeout(8000),
        });
        const hubJson = await hubRes.json() as any;
        if (!hubJson.ok) throw new Error(`Pi Hub Tapo error: ${hubJson.error ?? JSON.stringify(hubJson)}`);
        logger.info({ alias: target.alias, on, via: 'pihub' }, '[Tapo] Power command sent via Pi Hub');
      } else {
        throw cloudErr;
      }
    }

    return res.json({ ok: true, deviceId: target.deviceId, alias: target.alias, on });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg }, '[Tapo] POST /power failed');
    return res.status(500).json({ ok: false, error: msg });
  }
});

// ── GET /api/tapo/status ─────────────────────────────────────────────────────
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
    return res.json({ ok: true, deviceId: target.deviceId, alias: target.alias, on: !!info?.result?.device_on, power_mw: info?.result?.current_power ?? null, ip: info?.result?.ip ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
