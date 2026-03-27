import { useMemo } from 'react';
import { useCompanionData } from '@/hooks/use-collections';
import { TrendingUp, DollarSign, ShoppingBag, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SalesTab() {
  const { data, isLoading, refetch, isFetching } = useCompanionData();
  const conventions = data?.conventions ?? [];

  const { allSales, totalRevenue, totalUnits, convTotals, topProducts } = useMemo(() => {
    const sales: { name: string; qty: number; price: number; event: string; date?: string }[] = [];
    let rev = 0;
    let units = 0;

    conventions.forEach((c: any) => {
      (c.daySales || []).forEach((s: any) => {
        const qty = Math.max(1, parseInt(s.qty || '1') || 1);
        const price = parseFloat(s.price || '0') || 0;
        rev += qty * price;
        units += qty;
        sales.push({ name: s.name || 'Unknown', qty, price, event: c.name, date: s.date });
      });
    });

    sales.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

    const totals = conventions.map((c: any) => {
      const cRev = (c.daySales || []).reduce((sum: number, s: any) =>
        sum + (parseFloat(s.price || '0') || 0) * (parseInt(s.qty || '1') || 1), 0);
      const cUnits = (c.daySales || []).reduce((sum: number, s: any) => sum + (parseInt(s.qty || '1') || 1), 0);
      return { id: c.id, name: c.name, date: c.start, revenue: cRev || c.revenue || 0, units: cUnits };
    }).filter((c: any) => c.revenue > 0 || c.units > 0)
      .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));

    const productMap: Record<string, { units: number; revenue: number }> = {};
    sales.forEach(s => {
      if (!productMap[s.name]) productMap[s.name] = { units: 0, revenue: 0 };
      productMap[s.name].units += s.qty;
      productMap[s.name].revenue += s.qty * s.price;
    });
    const top = Object.entries(productMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10);

    return { allSales: sales, totalRevenue: rev, totalUnits: units, convTotals: totals, topProducts: top };
  }, [conventions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Sales
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{allSales.length} logged sales across {convTotals.length} events</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading sales…
        </div>
      ) : allSales.length === 0 && convTotals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 text-center rounded-2xl border border-white/5 bg-card/20">
          <TrendingUp className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No sales data yet.</p>
          <p className="text-xs mt-1">Log day-of sales in Studio Manager's event manager.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Revenue</p>
              <p className="font-display text-2xl font-bold text-emerald-400 mt-1">${totalRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-card/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Units Sold</p>
              <p className="font-display text-2xl font-bold text-foreground mt-1">{totalUnits}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-card/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Events w/ Sales</p>
              <p className="font-display text-2xl font-bold text-foreground mt-1">{convTotals.length}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {convTotals.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">By Convention</h4>
                </div>
                <div className="divide-y divide-white/5">
                  {convTotals.map((c: any) => (
                    <div key={c.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        {c.date && <p className="text-xs text-muted-foreground/50">{c.date}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-400">${c.revenue.toFixed(2)}</p>
                        {c.units > 0 && <p className="text-xs text-muted-foreground/50">{c.units} units</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {topProducts.length > 0 && (
              <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-accent" />
                  <h4 className="text-sm font-semibold">Top Products</h4>
                </div>
                <div className="divide-y divide-white/5">
                  {topProducts.map(([name, stats], i) => (
                    <div key={name} className="px-5 py-3 flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground/40 w-5 shrink-0 text-right">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        <p className="text-xs text-muted-foreground/50">{stats.units} units</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-400 shrink-0">${stats.revenue.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {allSales.length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">Recent Sales</h4>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">{allSales.length}</span>
              </div>
              <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                {allSales.slice(0, 50).map((s, i) => (
                  <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground/50 truncate">{s.event}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-emerald-400">${(s.qty * s.price).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground/50">×{s.qty} @ ${s.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
