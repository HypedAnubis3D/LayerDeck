import { useState, useRef, useEffect, useCallback } from 'react';
import { useCompanionData } from '@/hooks/use-collections';
import {
  usePiHubLive, useStoredPiHubUrl, piControl,
  PiPrinterState, DEFAULT_HUB_URL,
} from '@/hooks/use-pihub';
import {
  Printer, RefreshCw, Cpu, Zap, CheckCircle, AlertTriangle,
  Settings, WifiOff, PauseCircle, PlayCircle, StopCircle, X,
  Thermometer, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const PRINTER_CONFIG: Array<{ key: string; label: string; cameraStream: string }> = [
  { key: 'A1',         label: 'A1',           cameraStream: 'camera_a1'        },
  { key: 'P1S Room',   label: 'P1S (Room)',   cameraStream: 'camera_p1_room'   },
  { key: 'P1S Closet', label: 'P1S (Closet)', cameraStream: 'camera_p1_closet' },
];

type StateKey = 'RUNNING' | 'IDLE' | 'PAUSE' | 'PAUSED' | 'FAILED' | 'FINISH' | 'OFFLINE';

const STATE_STYLE: Record<StateKey, { label: string; dot: string; badge: string; border: string }> = {
  RUNNING:  { label: 'Printing',  dot: 'bg-emerald-400 animate-pulse', badge: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/25',  border: 'border-emerald-400/25' },
  IDLE:     { label: 'Idle',      dot: 'bg-white/20',                  badge: 'bg-white/5 text-muted-foreground border-white/10',           border: 'border-white/5'        },
  PAUSE:    { label: 'Paused',    dot: 'bg-amber-400',                  badge: 'bg-amber-400/15 text-amber-400 border-amber-400/25',         border: 'border-amber-400/25'   },
  PAUSED:   { label: 'Paused',    dot: 'bg-amber-400',                  badge: 'bg-amber-400/15 text-amber-400 border-amber-400/25',         border: 'border-amber-400/25'   },
  FAILED:   { label: 'Failed',    dot: 'bg-red-400',                    badge: 'bg-red-400/15 text-red-400 border-red-400/25',               border: 'border-red-400/40'     },
  FINISH:   { label: 'Done',      dot: 'bg-sky-400',                    badge: 'bg-sky-400/15 text-sky-400 border-sky-400/25',               border: 'border-sky-400/20'     },
  OFFLINE:  { label: 'Offline',   dot: 'bg-white/20',                   badge: 'bg-white/5 text-muted-foreground border-white/10',           border: 'border-white/5'        },
};

function getStateStyle(gcodeState?: string) {
  const key = (gcodeState || 'OFFLINE').toUpperCase() as StateKey;
  return STATE_STYLE[key] ?? STATE_STYLE.OFFLINE;
}

function cleanJobName(name?: string) {
  if (!name) return null;
  return name
    .replace(/\.gcode\.3mf$/i, '')
    .replace(/\.3mf$/i, '')
    .replace(/\.gcode$/i, '')
    .replace(/\.bgcode$/i, '')
    .trim() || null;
}

function completionTime(remainingMins: number) {
  const d = new Date(Date.now() + remainingMins * 60_000);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function minutesAgo(ts: number | null) {
  if (!ts) return null;
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return 'just now';
  return `${mins} min ago`;
}

function nozzleWear(hrs: number, type: string): { color: string; label: string; pct: number } {
  const isAbrasive = /hardened|stainless|steel/i.test(type || '');
  const limit = isAbrasive ? 500 : 200;
  const pct = Math.min(100, (hrs / limit) * 100);
  if (pct < 50) return { color: '#10b981', label: 'Good', pct };
  if (pct < 80) return { color: '#f59e0b', label: 'Worn', pct };
  return { color: '#ef4444', label: 'Replace Soon', pct };
}

// ── Camera iframe — lazy loads, stops when page is hidden ──
function CameraFrame({ streamUrl, active }: { streamUrl: string; active: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;
    el.src = active ? streamUrl : '';
  }, [active, streamUrl]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black/40" style={{ aspectRatio: '16/9' }}>
      {active ? (
        <iframe
          ref={iframeRef}
          title="camera"
          className="absolute inset-0 w-full h-full border-0 rounded-lg"
          allow="autoplay"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground/30">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 flex items-center justify-center">
            <Printer className="w-4 h-4" />
          </div>
          <span className="text-[10px]">Camera offline</span>
        </div>
      )}
    </div>
  );
}

// ── Single printer live card ──
function PrinterCard({
  cfg,
  state,
  isHubOffline,
  hubBaseUrl,
  camsActive,
}: {
  cfg: typeof PRINTER_CONFIG[number];
  state: PiPrinterState | null;
  isHubOffline: boolean;
  hubBaseUrl: string;
  camsActive: boolean;
}) {
  const [sending, setSending] = useState<string | null>(null);

  const gcodeState = isHubOffline ? 'OFFLINE' : (state?.gcode_state || 'OFFLINE');
  const style = getStateStyle(gcodeState);
  const isPrinting   = gcodeState === 'RUNNING';
  const isPaused     = gcodeState === 'PAUSE' || gcodeState === 'PAUSED';
  const isFailed     = gcodeState === 'FAILED';
  const isIdle       = gcodeState === 'IDLE' || gcodeState === 'FINISH' || gcodeState === 'OFFLINE';
  const jobName      = cleanJobName(state?.subtask_name);
  const pct          = state?.mc_percent ?? 0;
  const remaining    = state?.mc_remaining_time ?? 0;
  const nozzleTemp   = state?.nozzle_temper ?? 0;
  const nozzleTarget = state?.nozzle_target_temper ?? 0;
  const bedTemp      = state?.bed_temper ?? 0;
  const bedTarget    = state?.bed_target_temper ?? 0;
  const failReason   = state?.failReason || state?.fail_reason || null;

  const cameraUrl = `${hubBaseUrl}/camera/stream.html?src=${cfg.cameraStream}`;

  const sendControl = useCallback(async (cmd: 'pause' | 'resume' | 'stop') => {
    setSending(cmd);
    try {
      await piControl(hubBaseUrl, cfg.key, cmd);
    } finally {
      setSending(null);
    }
  }, [hubBaseUrl, cfg.key]);

  return (
    <div className={`rounded-2xl border bg-card/40 backdrop-blur-sm overflow-hidden flex flex-col transition-all ${style.border}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
        <span className="font-display text-sm font-semibold tracking-wide flex-1 truncate">{cfg.label}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {/* Camera */}
      <div className="px-3 pt-3">
        <CameraFrame streamUrl={cameraUrl} active={camsActive && !isHubOffline} />
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex-1 space-y-3">
        {isHubOffline ? (
          <div className="flex flex-col items-center justify-center py-3 text-center gap-1.5">
            <WifiOff className="w-5 h-5 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/50">Printer hub offline</p>
          </div>
        ) : isFailed ? (
          <div className="space-y-2">
            {jobName && (
              <p className="text-sm font-medium text-foreground truncate">{jobName}</p>
            )}
            {failReason && (
              <div className="rounded-lg bg-red-400/10 border border-red-400/20 px-3 py-2">
                <p className="text-xs text-red-400 leading-relaxed">{failReason}</p>
              </div>
            )}
            <Button size="sm" variant="ghost"
              className="w-full gap-1.5 border border-white/5 text-muted-foreground text-xs"
              onClick={() => sendControl('stop')} disabled={!!sending}>
              <X className="w-3 h-3" /> Dismiss
            </Button>
          </div>
        ) : (
          <>
            {/* Job name */}
            <div className="min-h-[18px]">
              {jobName ? (
                <p className="text-sm font-medium text-foreground truncate">{jobName}</p>
              ) : (
                <p className="text-xs text-muted-foreground/40 italic">
                  {gcodeState === 'IDLE' ? 'No active job' : gcodeState === 'FINISH' ? 'Print complete' : '—'}
                </p>
              )}
            </div>

            {/* Progress bar */}
            {(isPrinting || isPaused) && (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground/60">{pct}%</span>
                  {remaining > 0 && (
                    <span className="text-muted-foreground/60 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      Done: {completionTime(remaining)}
                    </span>
                  )}
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isPaused ? '#f59e0b' : '#10b981',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Temperatures */}
            {(nozzleTemp > 0 || bedTemp > 0) && (
              <div className="flex gap-3 text-xs">
                {nozzleTemp > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground/70">
                    <Thermometer className="w-3 h-3 text-orange-400/70" />
                    <span className="font-mono">
                      {Math.round(nozzleTemp)}°
                      {nozzleTarget > 0 && (
                        <span className="text-muted-foreground/40">/{nozzleTarget}°</span>
                      )}
                    </span>
                    <span className="text-muted-foreground/40">nozzle</span>
                  </div>
                )}
                {bedTemp > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground/70">
                    <Thermometer className="w-3 h-3 text-red-400/70" />
                    <span className="font-mono">
                      {Math.round(bedTemp)}°
                      {bedTarget > 0 && (
                        <span className="text-muted-foreground/40">/{bedTarget}°</span>
                      )}
                    </span>
                    <span className="text-muted-foreground/40">bed</span>
                  </div>
                )}
              </div>
            )}

            {/* Control buttons */}
            <div className="flex gap-2 pt-1">
              {isPrinting && (
                <Button size="sm" variant="ghost"
                  className="flex-1 gap-1.5 border border-white/5 text-amber-400 hover:border-amber-400/30 text-xs"
                  onClick={() => sendControl('pause')} disabled={!!sending}>
                  <PauseCircle className="w-3.5 h-3.5" />
                  {sending === 'pause' ? '…' : 'Pause'}
                </Button>
              )}
              {isPaused && (
                <Button size="sm" variant="ghost"
                  className="flex-1 gap-1.5 border border-white/5 text-emerald-400 hover:border-emerald-400/30 text-xs"
                  onClick={() => sendControl('resume')} disabled={!!sending}>
                  <PlayCircle className="w-3.5 h-3.5" />
                  {sending === 'resume' ? '…' : 'Resume'}
                </Button>
              )}
              {(isPrinting || isPaused) && (
                <Button size="sm" variant="ghost"
                  className="flex-1 gap-1.5 border border-white/5 text-red-400 hover:border-red-400/30 text-xs"
                  onClick={() => sendControl('stop')} disabled={!!sending}>
                  <StopCircle className="w-3.5 h-3.5" />
                  {sending === 'stop' ? '…' : 'Stop'}
                </Button>
              )}
              {isIdle && !isFailed && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground/30 italic">No active print</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Pi Hub URL settings popover ──
function HubUrlSettings({ url, onSave }: { url: string; onSave: (u: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(url);
  useEffect(() => { setDraft(url); }, [url]);

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen(v => !v)}
        className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10 text-xs">
        <Settings className="w-3.5 h-3.5" />
        Hub URL
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-80 rounded-xl border border-white/10 bg-card/95 backdrop-blur-md p-4 shadow-2xl">
          <p className="text-xs font-semibold text-foreground/80 mb-1">Pi Hub Base URL</p>
          <p className="text-[11px] text-muted-foreground/60 mb-2.5 leading-relaxed">
            Tailscale Funnel base URL — no trailing slash. Default: {DEFAULT_HUB_URL}
          </p>
          <input
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 font-mono"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={DEFAULT_HUB_URL}
            spellCheck={false}
          />
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="flex-1 text-xs" onClick={() => { onSave(draft); setOpen(false); }}>
              Save
            </Button>
            <Button size="sm" variant="ghost" className="text-xs border border-white/5"
              onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main PrintersTab
// ══════════════════════════════════════════════════════════════
export function PrintersTab() {
  const { data: companionData, isLoading, refetch, isFetching } = useCompanionData();
  const printers = companionData?.printers ?? [];
  const { url: piBaseUrl, save: savePiUrl } = useStoredPiHubUrl();
  const { data: liveData, isOffline, lastSeen, refetch: piRefetch } = usePiHubLive(piBaseUrl);

  // Track window visibility to stop/resume camera streams
  const [camsActive, setCamsActive] = useState(document.visibilityState === 'visible');
  useEffect(() => {
    const handler = () => setCamsActive(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('beforeunload', () => setCamsActive(false));
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return (
    <div className="space-y-8">
      {/* ── Live Monitoring ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              Live Monitoring
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isOffline
                ? <span className="text-red-400/80 flex items-center gap-1 text-xs mt-0.5">
                    <WifiOff className="w-3 h-3" /> Hub offline
                    {lastSeen && <span className="text-muted-foreground/50"> · Last seen {minutesAgo(lastSeen)}</span>}
                  </span>
                : <span className="text-emerald-400/70 text-xs">Polling every 5 s</span>
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={piRefetch}
              className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10 text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <HubUrlSettings url={piBaseUrl} onSave={savePiUrl} />
          </div>
        </div>

        {/* 3 printer cards side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {PRINTER_CONFIG.map(cfg => {
            // Try exact match first, then case-insensitive partial
            const state = liveData
              ? (liveData[cfg.key] ?? Object.entries(liveData).find(([k]) =>
                  k.toLowerCase().includes(cfg.key.toLowerCase()) ||
                  cfg.key.toLowerCase().includes(k.toLowerCase())
                )?.[1] ?? null)
              : null;
            return (
              <PrinterCard
                key={cfg.key}
                cfg={cfg}
                state={state}
                isHubOffline={isOffline}
                hubBaseUrl={piBaseUrl}
                camsActive={camsActive}
              />
            );
          })}
        </div>
      </section>

      {/* ── Nozzle Wear (existing) ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              Nozzle Wear
              {printers.length > 0 && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">{printers.length}</span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">Per-printer nozzle health</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
            className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading printers…
          </div>
        ) : printers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50 text-center rounded-2xl border border-white/5 bg-card/20">
            <Printer className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No printers configured.</p>
            <p className="text-xs mt-1">Add printers in Studio Manager → Nozzle Wear.</p>
          </div>
        ) : (
          <>
            {printers.some((p: any) => {
              const hrs = p.nozzleHrs ?? p.totalHours ?? p.nozzleHours ?? 0;
              return nozzleWear(hrs, p.nozzleType ?? p.nozzle ?? '').label === 'Replace Soon';
            }) && (
              <div className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-400">One or more printers need a nozzle replacement.</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {printers.map((p: any) => {
                const hrs = p.nozzleHrs ?? p.totalHours ?? p.nozzleHours ?? 0;
                const nozzleType = p.nozzleType ?? p.nozzle ?? '';
                const wear = nozzleWear(hrs, nozzleType);
                return (
                  <div key={p.id} className="rounded-xl border border-white/5 bg-card/50 hover:bg-card/80 hover:border-primary/20 p-4 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Printer className="h-4 w-4 text-primary/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{p.name}</p>
                        {p.model && <p className="text-xs text-muted-foreground/60 mt-0.5">{p.model}</p>}
                        <div className="mt-2 space-y-1.5">
                          {nozzleType && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground/60">Nozzle</span>
                              <span className="text-foreground/80">{nozzleType}{p.nozzleDiam ? ` ⌀${p.nozzleDiam}mm` : ''}</span>
                            </div>
                          )}
                          {hrs > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground/60">Hours</span>
                              <span style={{ color: wear.color }}>{hrs}h — {wear.label}</span>
                            </div>
                          )}
                          {p.nozzleChangedAt && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground/60">Last changed</span>
                              <span className="text-muted-foreground/60">{p.nozzleChangedAt}</span>
                            </div>
                          )}
                        </div>
                        {hrs > 0 && (
                          <div className="mt-2.5 h-1 rounded-full bg-white/10">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${wear.pct}%`, backgroundColor: wear.color }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
