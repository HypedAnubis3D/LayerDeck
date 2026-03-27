import { useCompanionData } from '@/hooks/use-collections';
import { useQuery } from '@tanstack/react-query';
import { Printer, RefreshCw, Cpu, Zap, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function useBambuStatus() {
  return useQuery({
    queryKey: ['bambu-status'],
    queryFn: async () => {
      const res = await fetch('/api/bambu/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ connected: boolean; reason?: string; devices?: any[] }>;
    },
    retry: false,
    staleTime: 120_000,
  });
}

function nozzleWear(hrs: number, type: string): { color: string; label: string; pct: number } {
  const isAbrasive = /hardened|stainless|steel/i.test(type || '');
  const limit = isAbrasive ? 500 : 200;
  const pct = Math.min(100, (hrs / limit) * 100);
  if (pct < 50) return { color: '#10b981', label: 'Good', pct };
  if (pct < 80) return { color: '#f59e0b', label: 'Worn', pct };
  return { color: '#ef4444', label: 'Replace Soon', pct };
}

export function PrintersTab() {
  const { data, isLoading, refetch, isFetching } = useCompanionData();
  const { data: bambu, isLoading: bambuLoading } = useBambuStatus();
  const printers = data?.printers ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            Printers
            {printers.length > 0 && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">{printers.length}</span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">Nozzle wear and Bambu cloud status</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className={`rounded-xl border p-4 flex items-center gap-4 transition-all
        ${bambu?.connected ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-white/5 bg-card/20'}`}>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0
          ${bambu?.connected ? 'bg-emerald-400/10' : 'bg-white/5'}`}>
          <Zap className={`h-4 w-4 ${bambu?.connected ? 'text-emerald-400' : 'text-muted-foreground/30'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Bambu Cloud</p>
          {bambuLoading ? (
            <p className="text-xs text-muted-foreground/50 flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" /> Connecting…
            </p>
          ) : bambu?.connected ? (
            <p className="text-xs text-emerald-400">
              {bambu.devices?.length ?? 0} printer{bambu.devices?.length !== 1 ? 's' : ''} linked
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50">{bambu?.reason || 'Not connected'}</p>
          )}
        </div>
        {bambu?.connected && <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />}
      </div>

      {bambu?.connected && (bambu.devices?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-emerald-400/10 bg-card/30 backdrop-blur-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-emerald-400">Bambu Devices</h4>
          </div>
          <div className="divide-y divide-white/5">
            {bambu.devices!.map((d: any) => (
              <div key={d.dev_id || d.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{d.name || d.dev_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground/50">
                    {d.dev_model_name || d.model || ''}{d.dev_id ? ` · ${d.dev_id}` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0
                  ${d.print_status === 'running' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-white/5 text-muted-foreground/50'}`}>
                  {d.print_status || 'idle'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
              const bambuMatch = bambu?.devices?.find((d: any) => {
                const dn = (d.name || d.dev_name || '').toLowerCase();
                const pn = (p.name || '').toLowerCase();
                return dn.includes(pn) || pn.includes(dn);
              });
              return (
                <div key={p.id} className="rounded-xl border border-white/5 bg-card/50 hover:bg-card/80 hover:border-primary/20 p-4 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Printer className="h-4 w-4 text-primary/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-foreground truncate">{p.name}</p>
                        {bambuMatch && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0
                            ${bambuMatch.print_status === 'running' ? 'bg-emerald-400/15 text-emerald-400' : 'bg-white/5 text-muted-foreground/40'}`}>
                            {bambuMatch.print_status || 'idle'}
                          </span>
                        )}
                      </div>
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
    </div>
  );
}
