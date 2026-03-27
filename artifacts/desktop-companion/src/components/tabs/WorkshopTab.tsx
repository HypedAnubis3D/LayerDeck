import { useCompanionData } from '@/hooks/use-collections';
import { AlertTriangle, Disc, Package, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LOW_SPOOL_THRESHOLD = 250;

export function WorkshopTab() {
  const { data, isLoading, refetch, isFetching } = useCompanionData();
  const spools = data?.spools ?? [];
  const catalog = data?.catalog ?? [];

  const lowSpools = spools.filter((s: any) => {
    const rem = s.remaining ?? s.grams ?? null;
    return rem !== null && typeof rem === 'number' && rem < LOW_SPOOL_THRESHOLD;
  });

  const outOfStock = catalog.filter((c: any) => typeof c.stock === 'number' && c.stock === 0);
  const lowStock = catalog.filter((c: any) => typeof c.stock === 'number' && c.stock > 0 && c.stock <= 3);
  const alertCount = lowSpools.length + outOfStock.length + lowStock.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
            Workshop Status
            {alertCount > 0 && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-400">
                {alertCount} alert{alertCount !== 1 ? 's' : ''}
              </span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {spools.length} spool{spools.length !== 1 ? 's' : ''} · {catalog.length} catalog item{catalog.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : alertCount === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-emerald-400/80 text-center rounded-2xl border border-emerald-400/10 bg-emerald-400/5">
          <CheckCircle className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm font-semibold">All clear!</p>
          <p className="text-xs mt-1 text-muted-foreground">Spools and stock are in good shape.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2 bg-amber-400/5">
              <Disc className="h-4 w-4 text-amber-400" />
              <h4 className="text-sm font-semibold text-amber-400">Low Spools</h4>
              <span className="ml-auto text-xs text-amber-400/70">&lt;{LOW_SPOOL_THRESHOLD}g remaining</span>
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-400">
                {lowSpools.length}
              </span>
            </div>
            {lowSpools.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground/50 text-center">All spools are well-stocked.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {lowSpools.map((s: any) => {
                  const rem = s.remaining ?? s.grams ?? 0;
                  const total = s.weight ?? 1000;
                  const pct = Math.max(0, Math.min(100, (rem / total) * 100));
                  const isLow = rem < 100;
                  return (
                    <div key={s.id} className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {s.colorHex && (
                          <div className="h-4 w-4 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: s.colorHex }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {[s.brand, s.type].filter(Boolean).join(' ') || 'Filament'}
                            {s.color ? ` — ${s.color}` : ''}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/10">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: isLow ? '#ef4444' : '#f59e0b' }} />
                            </div>
                            <span className={`text-xs font-mono shrink-0 ${isLow ? 'text-red-400' : 'text-amber-400'}`}>
                              {rem}g
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2 bg-red-400/5">
              <Package className="h-4 w-4 text-red-400" />
              <h4 className="text-sm font-semibold text-red-400">Low Stock</h4>
              <span className="ml-auto rounded-full bg-red-400/15 px-2 py-0.5 text-xs font-bold text-red-400">
                {outOfStock.length + lowStock.length}
              </span>
            </div>
            {outOfStock.length === 0 && lowStock.length === 0 ? (
              <div className="px-5 py-8 text-sm text-muted-foreground/50 text-center">All products are stocked.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {outOfStock.map((item: any) => (
                  <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="shrink-0 rounded bg-red-400/15 px-1.5 py-0.5 text-xs font-bold text-red-400 w-8 text-center">OUT</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      {item.sku && <p className="text-xs text-muted-foreground/50 font-mono">{item.sku}</p>}
                    </div>
                  </div>
                ))}
                {lowStock.map((item: any) => (
                  <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="shrink-0 rounded bg-amber-400/15 px-1.5 py-0.5 text-xs font-bold text-amber-400 w-8 text-center">
                      {item.stock}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      {item.sku && <p className="text-xs text-muted-foreground/50 font-mono">{item.sku}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
