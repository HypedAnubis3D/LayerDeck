const LAN_FALLBACK_URL = process.env.EXPO_PUBLIC_PI_HUB_URL || 'http://192.168.1.183:3000';

// Pi Hub's own printerHub config in Supabase carries a Tailscale Funnel
// publicUrl — a real public HTTPS endpoint, reachable off the home WiFi,
// already used by the web app's own getPiUrl(). Set once auth resolves
// (see PrintersScreen); falls back to the LAN-only IP until then / if unset.
let publicBaseUrl: string | null = null;

export function setPiHubPublicUrl(url: string | null | undefined): void {
  publicBaseUrl = url || null;
}

function baseUrl(): string {
  return publicBaseUrl || LAN_FALLBACK_URL;
}

const REQUEST_TIMEOUT_MS = 5000;
// The Pi's local Tapo login re-authenticates from scratch on every call
// (no session reuse) and has been observed taking ~6.5s for a handful of
// plugs — well past the default timeout, which was aborting requests
// moments before they would have succeeded.
const TAPO_TIMEOUT_MS = 15000;

export class PiHubUnreachableError extends Error {
  constructor(cause?: unknown) {
    super('Pi Hub is unreachable — check you are on the same WiFi network as the Pi, or that its remote URL is reachable');
    this.name = 'PiHubUnreachableError';
    this.cause = cause;
  }
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) {
      throw new Error(`Pi Hub ${path} returned ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new PiHubUnreachableError(err);
    }
    if (err instanceof TypeError) {
      // fetch throws a plain TypeError ("Network request failed") when the
      // host is unreachable — no route, wrong WiFi, Pi powered off, etc.
      throw new PiHubUnreachableError(err);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// Field names match the raw Bambu Lab MQTT "print" report, passed through
// almost untouched by pi-hub's /status (see artifacts/pi-hub/server.js:312).
// Not a shape we invented — confirmed against how studio-manager's own
// index.html reads this same payload (e.g. line 20393-20404).
export interface PrinterStatus {
  online?: boolean;
  gcode_state?: string; // 'RUNNING' | 'PAUSE' | 'IDLE' | 'FINISH' | 'FAILED' | ...
  mc_percent?: number; // 0-100
  mc_remaining_time?: number; // minutes
  layer_num?: number;
  total_layer_num?: number;
  nozzle_temper?: number;
  bed_temper?: number;
  subtask_name?: string;
  [key: string]: unknown;
}

export type AllPrinterStatus = Record<string, PrinterStatus>;

export function getAllStatus(): Promise<AllPrinterStatus> {
  return request<AllPrinterStatus>('/status');
}

export function getPrinterStatus(name: string): Promise<PrinterStatus> {
  return request<PrinterStatus>(`/status/${encodeURIComponent(name)}`);
}

export type ControlCommand =
  | 'pause'
  | 'resume'
  | 'stop'
  | 'skip'
  | 'calibration'
  | 'light_on'
  | 'light_off';

export function sendControl(
  printer: string,
  command: ControlCommand,
  extra?: { objectId?: string; option?: string }
): Promise<unknown> {
  return request('/control', {
    method: 'POST',
    body: JSON.stringify({ printer, command, ...extra }),
  });
}

export function setAmsSlot(params: {
  printer: string;
  amsId: string | number;
  trayId: string | number;
  filamentType: string;
  color: string;
}): Promise<unknown> {
  return request('/ams/set-slot', { method: 'POST', body: JSON.stringify(params) });
}

export function loadAms(printer: string, target: string): Promise<unknown> {
  return request('/ams/load', { method: 'POST', body: JSON.stringify({ printer, target }) });
}

export function unloadAms(printer: string, target: string): Promise<unknown> {
  return request('/ams/unload', { method: 'POST', body: JSON.stringify({ printer, target }) });
}

export function setExtSpool(params: {
  printer: string;
  filamentType: string;
  color: string;
}): Promise<unknown> {
  return request('/ams/set-ext-spool', { method: 'POST', body: JSON.stringify(params) });
}

export interface TapoDevice {
  alias: string;
  ip: string;
  on: boolean | null;
  power_mw: number | null;
  error: string | null;
}

export async function getTapoDevices(): Promise<TapoDevice[]> {
  const res = await request<{ ok: boolean; devices: TapoDevice[] }>('/tapo/devices', {
    timeoutMs: TAPO_TIMEOUT_MS,
  });
  return res.devices ?? [];
}

export function setTapoPower(alias: string, on: boolean): Promise<unknown> {
  return request('/tapo/power', { method: 'POST', body: JSON.stringify({ alias, on }) });
}

// Server-side timer on Pi Hub itself — fires even if the app is closed.
export function scheduleTapoOff(alias: string, delayMs: number): Promise<unknown> {
  return request('/tapo/schedule-off', { method: 'POST', body: JSON.stringify({ alias, delayMs }) });
}

export function cancelTapoOff(alias: string): Promise<unknown> {
  return request(`/tapo/schedule-off/${encodeURIComponent(alias)}`, { method: 'DELETE' });
}

// Mirrors studio-manager's _aliasMatchesPrinter(): strips plug/outlet/socket/smart
// from the alias, then checks every remaining word appears in the printer name
// (e.g. "P1S Room Plug" -> matches printer "P1S (Room)").
export function matchTapoDevice(printerName: string, devices: TapoDevice[]): TapoDevice | undefined {
  const p = printerName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  return devices.find((d) => {
    const core = (d.alias || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\b(plug|outlet|socket|smart)\b/g, '')
      .trim();
    if (!core) return false;
    const tokens = core.split(/\s+/).filter((t) => t.length > 1);
    return tokens.length > 0 && tokens.every((t) => p.includes(t));
  });
}
