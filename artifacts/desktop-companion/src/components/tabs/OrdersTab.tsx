import { useCompanionData } from '@/hooks/use-collections';
import { PackageOpen, RefreshCw, ShoppingCart, CheckCircle, Clock, XCircle, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: React.ComponentType<{ className?: string }> }> = {
  pending:    { label: 'Pending',    color: 'text-amber-400',       bg: 'bg-amber-400/10',     border: 'border-amber-400/20',     Icon: Clock },
  fulfilled:  { label: 'Fulfilled',  color: 'text-emerald-400',     bg: 'bg-emerald-400/10',   border: 'border-emerald-400/20',   Icon: CheckCircle },
  shipped:    { label: 'Shipped',    color: 'text-blue-400',        bg: 'bg-blue-400/10',      border: 'border-blue-400/20',      Icon: Truck },
  cancelled:  { label: 'Cancelled',  color: 'text-muted-foreground',bg: 'bg-muted/10',         border: 'border-white/5',          Icon: XCircle },
  refunded:   { label: 'Refunded',   color: 'text-muted-foreground',bg: 'bg-muted/10',         border: 'border-white/5',          Icon: XCircle },
};

function statusCfg(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

const PLATFORM_COLORS: Record<string, string> = {
  Shopify: 'text-emerald-400/80',
  Etsy:    'text-orange-400/80',
  Direct:  'text-primary/80',
};

export function OrdersTab() {
  const { data, isLoading, refetch, isFetching } = useCompanionData();
  const orders: any[] = data?.orders ?? [];

  const sorted = [...orders].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  const openCount = orders.filter(o => !['fulfilled', 'shipped', 'cancelled', 'refunded'].includes(o.status)).length;
  const totalRevenue = orders.reduce((sum, o) => {
    if (['cancelled', 'refunded'].includes(o.status)) return sum;
    const itemTotal = (o.items || []).reduce((s: number, i: any) =>
      s + (parseFloat(i.price ?? 0) * parseInt(i.qty ?? 1)), 0);
    return sum + (o.total ?? itemTotal);
  }, 0);

  const byStatus = Object.keys(STATUS_CONFIG).reduce<Record<string, number>>((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Orders
            {openCount > 0 && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-400">
                {openCount} open
              </span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{orders.length} total orders</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 text-center rounded-2xl border border-white/5 bg-card/20">
          <PackageOpen className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No orders yet.</p>
          <p className="text-xs mt-1">Orders sync from Studio Manager automatically.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Revenue</p>
              <p className="font-display text-2xl font-bold text-emerald-400 mt-1">${totalRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Open</p>
              <p className="font-display text-2xl font-bold text-amber-400 mt-1">{openCount}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-card/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fulfilled</p>
              <p className="font-display text-2xl font-bold text-foreground mt-1">{(byStatus.fulfilled ?? 0) + (byStatus.shipped ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-card/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="font-display text-2xl font-bold text-foreground mt-1">{orders.length}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
              <PackageOpen className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Recent Orders</h4>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">{orders.length}</span>
            </div>
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {sorted.map((order: any) => {
                const cfg = statusCfg(order.status);
                const { Icon } = cfg;
                const items: any[] = order.items || [];
                const itemTotal = items.reduce((s: number, i: any) =>
                  s + (parseFloat(i.price ?? 0) * parseInt(i.qty ?? 1)), 0);
                const displayTotal = order.total ?? itemTotal;
                const platformColor = PLATFORM_COLORS[order.platform] ?? 'text-muted-foreground/50';
                return (
                  <div key={order.id} className="px-5 py-4 flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{order.customer || 'Unknown Customer'}</p>
                        {order.orderId && (
                          <span className="text-xs font-mono text-muted-foreground/40">#{order.orderId}</span>
                        )}
                        <span className={`text-xs ${platformColor}`}>{order.platform}</span>
                      </div>
                      {items.length > 0 && (
                        <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">
                          {items.map((i: any) => `${i.name || i.sku || 'Item'}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')}
                        </p>
                      )}
                      {order.notes && (
                        <p className="text-xs text-muted-foreground/40 mt-0.5 truncate">{order.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground/40 mt-0.5">{order.date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {displayTotal > 0 && (
                        <p className="text-sm font-bold text-emerald-400">${displayTotal.toFixed(2)}</p>
                      )}
                      <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
