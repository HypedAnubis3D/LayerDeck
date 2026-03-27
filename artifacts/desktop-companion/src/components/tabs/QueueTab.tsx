import { useCompanionData } from '@/hooks/use-collections';
import { Printer, RefreshCw, Clock, AlertCircle, CheckCircle, ListOrdered, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; Icon: React.ComponentType<{ className?: string }> }> = {
  inprogress: { label: 'Printing',  color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', Icon: Printer },
  queued:     { label: 'Queued',    color: 'text-primary',     bg: 'bg-primary/10',      border: 'border-primary/20',    Icon: Clock },
  done:       { label: 'Done',      color: 'text-muted-foreground', bg: 'bg-muted/20',   border: 'border-white/5',       Icon: CheckCircle },
};

const STATUS_ORDER = ['inprogress', 'queued', 'done'];

export function QueueTab() {
  const { data, isLoading, refetch, isFetching } = useCompanionData();
  const queue = data?.printQueue ?? [];

  const grouped = STATUS_ORDER.reduce<Record<string, any[]>>((acc, s) => {
    acc[s] = queue.filter((j: any) => (j.stage ?? 'queued') === s);
    return acc;
  }, {});

  const activeCount = (grouped.inprogress?.length ?? 0) + (grouped.queued?.length ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-primary" />
            Print Queue
            {activeCount > 0 && (
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
                {activeCount} active
              </span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{queue.length} total jobs</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading queue…
        </div>
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 text-center rounded-2xl border border-white/5 bg-card/20">
          <ListOrdered className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">Print queue is empty.</p>
          <p className="text-xs mt-1">Add jobs from Studio Manager.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {STATUS_ORDER.map(status => {
            const jobs = grouped[status] ?? [];
            if (jobs.length === 0) return null;
            const cfg = STATUS_CONFIG[status];
            const { Icon } = cfg;
            return (
              <div key={status} className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
                <div className={`px-4 py-3 border-b border-white/5 flex items-center gap-2 ${cfg.bg}`}>
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                  <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                    {jobs.length}
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {jobs.map((job: any) => {
                    const succeeded = job.stage === 'done' && job.outcome === 'done';
                    const failed    = job.stage === 'done' && job.outcome === 'failed';
                    return (
                      <div key={job.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{job.name || 'Unnamed job'}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground/60">
                            {job.printer && <span className="flex items-center gap-1"><Printer className="h-3 w-3" />{job.printer}</span>}
                            {job.hrs > 0 && <span>{job.hrs}h</span>}
                            {job.orderId && <span className="truncate max-w-[100px]">{job.orderId}</span>}
                          </div>
                          {(succeeded || failed) && (
                            <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${failed ? 'text-destructive' : 'text-emerald-400'}`}>
                              {failed
                                ? <><XCircle className="h-3 w-3" /> Failed</>
                                : <><CheckCircle className="h-3 w-3" /> Succeeded</>
                              }
                            </div>
                          )}
                        </div>
                        {job.qty > 1 && (
                          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                            ×{job.qty}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
