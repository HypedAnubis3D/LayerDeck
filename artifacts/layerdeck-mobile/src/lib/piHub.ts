const BASE_URL = process.env.EXPO_PUBLIC_PI_HUB_URL || 'http://192.168.1.183:3000';

const REQUEST_TIMEOUT_MS = 5000;

export class PiHubUnreachableError extends Error {
  constructor(cause?: unknown) {
    super('Pi Hub is unreachable — check you are on the same WiFi network as the Pi');
    this.name = 'PiHubUnreachableError';
    this.cause = cause;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
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
