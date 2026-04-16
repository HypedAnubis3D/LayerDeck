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

// ── POST /api/tapo/schedule-off ──────────────────────────────────────────────
// Schedules a server-side power-off after a delay (delayMs, default 10 min).
// Called by the client when a print finishes, so the plug turns off even if
// the browser tab is closed before the countdown expires.
// DELETE /api/tapo/schedule-off/:deviceId cancels a pending timer ("Keep ON").
const _pendingOff: Map<string, ReturnType<typeof setTimeout>> = new Map();

// Shared power-off executor — resolves deviceId → target device then powers off,
// falling back to Pi Hub local control if the Tapo cloud reports the device offline.
async function _execPowerOff(opts: {
  deviceId?: string; alias?: string; hubUrl?: string; logCtx?: Record<string, unknown>;
}): Promise<void> {
  const { deviceId, alias, hubUrl, logCtx = {} } = opts;
  const token   = await tapoLogin();
  const devices = await tapoGetDevices(token);
  let target = deviceId
    ? devices.find(d => d.deviceId === deviceId)
    : devices.find(d => d.alias?.toLowerCase() === alias?.toLowerCase().trim());
  if (!target) {
    const fresh = await tapoGetDevices(token, true);
    target = deviceId
      ? fresh.find(d => d.deviceId === deviceId)
      : fresh.find(d => d.alias?.toLowerCase() === alias?.toLowerCase().trim());
  }
  if (!target) {
    logger.warn({ ...logCtx, deviceId, alias }, '[Tapo] _execPowerOff: device not found');
    return;
  }
  try {
    await tapoPass(token, target.deviceId, target.appServerUrl, 'set_device_info', { device_on: false });
    logger.info({ ...logCtx, alias: target.alias, via: 'cloud' }, '[Tapo] Power-off sent');
  } catch (cloudErr) {
    const cloudMsg = (cloudErr as Error).message ?? '';
    if (hubUrl && (cloudMsg.includes('-20571') || cloudMsg.toLowerCase().includes('offline'))) {
      const fbRes  = await fetch(`${hubUrl}/tapo/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: target.alias, on: false }),
        signal: AbortSignal.timeout(8000),
      });
      const fbJson = await fbRes.json() as any;
      if (!fbJson?.ok) throw new Error(`Pi Hub Tapo power-off failed: ${fbJson?.error ?? JSON.stringify(fbJson)}`);
      logger.info({ ...logCtx, alias: target.alias, via: 'pihub' }, '[Tapo] Power-off sent via Pi Hub');
    } else {
      throw cloudErr;
    }
  }
}

router.post('/schedule-off', async (req, res) => {
  const { deviceId, alias, delayMs = 10 * 60 * 1000, hubUrl } = req.body as {
    deviceId?: string; alias?: string; delayMs?: number; hubUrl?: string;
  };
  if (!deviceId && !alias) return res.status(400).json({ ok: false, error: 'deviceId or alias required' });

  const key = deviceId ?? alias!;

  // Cancel any existing timer for this device before scheduling a fresh one
  const existing = _pendingOff.get(key);
  if (existing) { clearTimeout(existing); _pendingOff.delete(key); }

  const delay = Math.max(0, Math.min(Number(delayMs) || 10 * 60 * 1000, 120 * 60 * 1000));
  logger.info({ key, delayMs: delay, via: 'server-schedule' }, '[Tapo] Scheduling server-side power-off');

  const timer = setTimeout(async () => {
    _pendingOff.delete(key);
    try {
      await _execPowerOff({ deviceId, alias, hubUrl, logCtx: { key, via: 'server-schedule' } });
    } catch (e) {
      logger.warn({ err: (e as Error).message, key }, '[Tapo] Server-scheduled power-off failed');
    }
  }, delay);

  _pendingOff.set(key, timer);
  return res.json({ ok: true, key, delayMs: delay, firesAt: Date.now() + delay });
});

router.delete('/schedule-off/:key', (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const timer = _pendingOff.get(key);
  if (timer) {
    clearTimeout(timer);
    _pendingOff.delete(key);
    logger.info({ key }, '[Tapo] Server-scheduled power-off cancelled (Keep ON)');
    return res.json({ ok: true, cancelled: true, key });
  }
  return res.json({ ok: true, cancelled: false, key, note: 'No pending timer found' });
});

// ── Printer monitor config + server-side polling ─────────────────────────────
// Accepts printer-to-plug mappings from the client so the server can watch Pi Hub
// printer states independently and schedule power-off even when the browser is closed.

interface PrinterMonitorConfig {
  piHubUrl: string;
  printerName: string;  // key used by Pi Hub (hubName || display name)
  deviceId: string;
  autoOffEnabled: boolean;
}

// key: `${piHubUrl}|${printerName}`
const _monitorConfigs: Map<string, PrinterMonitorConfig> = new Map();
// Last known gcode_state per printer — key: `${piHubUrl}|${printerName}`
const _monitorPrevStates: Map<string, string> = new Map();

// Validate that a URL is safe to use as a Pi Hub address.
// Must be http: or https: to prevent protocol-level SSRF.
function _validateHubUrl(raw: string): string {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new Error(`Invalid piHubUrl: "${raw}"`); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`piHubUrl must use http or https, got "${parsed.protocol}"`);
  }
  return parsed.origin; // strip trailing path/query to get a clean base URL
}

router.post('/printer-monitor-config', (req, res) => {
  const { piHubUrl, configs } = req.body as { piHubUrl: string; configs: PrinterMonitorConfig[] };
  if (!piHubUrl || !Array.isArray(configs)) {
    return res.status(400).json({ ok: false, error: 'piHubUrl and configs[] required' });
  }

  let safeHubUrl: string;
  try { safeHubUrl = _validateHubUrl(piHubUrl); } catch (e) {
    return res.status(400).json({ ok: false, error: (e as Error).message });
  }

  // Build a set of deviceIds that will be active after this update
  const activeDeviceIds = new Set(configs.filter(c => c.autoOffEnabled && c.deviceId).map(c => c.deviceId));

  // Cancel any pending poll-scheduled timers for deviceIds that are now disabled or removed
  for (const [k, existing] of _monitorConfigs) {
    if (!k.startsWith(safeHubUrl + '|')) continue;
    if (!activeDeviceIds.has(existing.deviceId) && _pendingOff.has(existing.deviceId)) {
      clearTimeout(_pendingOff.get(existing.deviceId)!);
      _pendingOff.delete(existing.deviceId);
      logger.info({ deviceId: existing.deviceId, printer: existing.printerName }, '[Tapo] Cancelled pending poll-scheduled timer (auto-off disabled or plug removed)');
    }
  }

  // Replace all entries for this piHubUrl with fresh data from the client
  for (const [k] of _monitorConfigs) {
    if (k.startsWith(safeHubUrl + '|')) _monitorConfigs.delete(k);
  }
  for (const c of configs) {
    if (!c.printerName || !c.deviceId) continue;
    _monitorConfigs.set(`${safeHubUrl}|${c.printerName}`, { ...c, piHubUrl: safeHubUrl });
  }

  logger.info({ piHubUrl: safeHubUrl, count: configs.length, total: _monitorConfigs.size }, '[Tapo] Printer monitor config updated');
  // Trigger an immediate poll so any in-progress FINISH state is caught right away
  // (rather than waiting up to 30 s for the next scheduled tick).
  setImmediate(() => _pollPrinterStates().catch(() => {}));
  return res.json({ ok: true, monitored: _monitorConfigs.size });
});

// Schedule a power-off in the polling loop, deduplicating against pending timers.
function _pollScheduleOff(cfg: PrinterMonitorConfig, reason: string): void {
  const schedKey = cfg.deviceId;
  if (_pendingOff.has(schedKey)) {
    logger.info({ printer: cfg.printerName, deviceId: cfg.deviceId, reason }, '[Tapo] Poll: schedule-off already pending — skipping');
    return;
  }
  logger.info({ printer: cfg.printerName, deviceId: cfg.deviceId, hubUrl: cfg.piHubUrl, reason }, '[Tapo] Poll: scheduling auto power-off (10 min)');
  const DELAY_MS = 10 * 60 * 1000;
  const timer = setTimeout(async () => {
    _pendingOff.delete(schedKey);
    try {
      await _execPowerOff({ deviceId: cfg.deviceId, hubUrl: cfg.piHubUrl, logCtx: { printer: cfg.printerName, via: 'poll' } });
    } catch (e) {
      logger.warn({ err: (e as Error).message, printer: cfg.printerName }, '[Tapo] Poll auto-off: power-off failed');
    }
  }, DELAY_MS);
  _pendingOff.set(schedKey, timer);
}

// Background polling — every 30 s, fetch Pi Hub printer states and schedule power-off
// on FINISH or missed-FINISH (RUNNING→IDLE) transitions for printers with auto-off enabled.
async function _pollPrinterStates(): Promise<void> {
  if (_monitorConfigs.size === 0) return;

  // Group configs by piHubUrl so we make one request per hub
  const byHub = new Map<string, PrinterMonitorConfig[]>();
  for (const c of _monitorConfigs.values()) {
    const arr = byHub.get(c.piHubUrl) ?? [];
    arr.push(c);
    byHub.set(c.piHubUrl, arr);
  }

  for (const [hubUrl, printers] of byHub) {
    try {
      const res = await fetch(`${hubUrl}/status`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        logger.warn({ hubUrl, status: res.status }, '[Tapo] Poll: Pi Hub returned non-200');
        continue;
      }
      const data = await res.json() as Record<string, any>;

      for (const cfg of printers) {
        if (!cfg.autoOffEnabled) continue;
        const state = data[cfg.printerName];
        if (!state) continue;

        const gcodeState: string = state.online === false ? 'OFFLINE' : (state.gcode_state ?? 'IDLE');
        const stateKey = `${hubUrl}|${cfg.printerName}`;
        const prevState = _monitorPrevStates.get(stateKey) ?? 'OFFLINE';
        _monitorPrevStates.set(stateKey, gcodeState);

        const wasActive = prevState === 'RUNNING' || prevState === 'PAUSE' || prevState === 'PAUSED';
        // FINISH transition — printer completed a job cleanly
        if (gcodeState === 'FINISH' && wasActive) {
          _pollScheduleOff(cfg, 'FINISH');
        }
        // Missed-FINISH fallback — Bambu sometimes skips FINISH and goes RUNNING→IDLE
        // Mirror the same recovery the client does so the server catches it too.
        else if (gcodeState === 'IDLE' && prevState === 'RUNNING') {
          _pollScheduleOff(cfg, 'RUNNING→IDLE (missed FINISH)');
        }
      }
    } catch (e) {
      logger.warn({ err: (e as Error).message, hubUrl }, '[Tapo] Poll: failed to fetch Pi Hub status');
    }
  }
}

// Start background poll and repeat every 30 s
setInterval(_pollPrinterStates, 30_000);

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
