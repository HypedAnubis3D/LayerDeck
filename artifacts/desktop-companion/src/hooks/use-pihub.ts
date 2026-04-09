import { useState, useEffect, useCallback, useRef } from 'react';

export const PI_HUB_URL_KEY  = 'layerdeck_companion_pihub_url';
export const DEFAULT_HUB_URL = 'https://layerdeck-hub.tail5636e6.ts.net';

function getHubApiUrl(piBaseUrl: string) {
  return `${piBaseUrl.replace(/\/$/, '')}/hub`;
}

export function useStoredPiHubUrl() {
  const [url, setUrl] = useState<string>(
    () => localStorage.getItem(PI_HUB_URL_KEY) || DEFAULT_HUB_URL,
  );
  const save = (raw: string) => {
    const trimmed = raw.trim().replace(/\/$/, '') || DEFAULT_HUB_URL;
    localStorage.setItem(PI_HUB_URL_KEY, trimmed);
    setUrl(trimmed);
  };
  return { url, save };
}

export interface PiPrinterState {
  gcode_state?: string;
  subtask_name?: string;
  mc_percent?: number;
  mc_remaining_time?: number;
  nozzle_temper?: number;
  nozzle_target_temper?: number;
  bed_temper?: number;
  bed_target_temper?: number;
  online?: boolean;
  lastUpdated?: number;
  failureSnapshot?: string | null;
  failReason?: string | null;
  lastCompletedDurationMins?: number;
  [key: string]: any;
}

export interface PiHubLiveResult {
  data: Record<string, PiPrinterState> | null;
  isOffline: boolean;
  lastSeen: number | null;
  error: string | null;
  refetch: () => void;
}

export function usePiHubLive(piBaseUrl: string): PiHubLiveResult {
  const [data, setData]       = useState<Record<string, PiPrinterState> | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSeen, setLastSeen]   = useState<number | null>(null);
  const [error, setError]         = useState<string | null>(null);

  // Keep a stable ref so the setInterval callback always sees the latest hubUrl
  const hubUrlRef = useRef('');
  hubUrlRef.current = piBaseUrl ? getHubApiUrl(piBaseUrl) : '';

  const fetchStatus = useCallback(async () => {
    const hubUrl = hubUrlRef.current;
    if (!hubUrl) return;
    try {
      const res = await fetch(
        `/api/pihub/status?hub=${encodeURIComponent(hubUrl)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.hint || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setIsOffline(false);
      setLastSeen(Date.now());
      setError(null);
    } catch (e: any) {
      setIsOffline(true);
      setError(e?.message || 'Unreachable');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') fetchStatus();
    }, 5000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchStatus();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchStatus]);

  return { data, isOffline, lastSeen, error, refetch: fetchStatus };
}

export async function piControl(
  piBaseUrl: string,
  printerName: string,
  command: 'pause' | 'resume' | 'stop',
): Promise<{ ok?: boolean; error?: string }> {
  const hubUrl = getHubApiUrl(piBaseUrl);
  const res = await fetch(`/api/pihub/control?hub=${encodeURIComponent(hubUrl)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer: printerName, command }),
  });
  return res.json().catch(() => ({ ok: true }));
}
