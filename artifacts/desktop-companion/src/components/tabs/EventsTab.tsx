import { useCompanionData } from '@/hooks/use-collections';
import { Calendar, MapPin, CheckSquare, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function EventsTab() {
  const { data, isLoading, refetch, isFetching } = useCompanionData();
  const conventions = data?.conventions ?? [];
  const today = new Date().toISOString().split('T')[0];

  const upcoming = conventions
    .filter((c: any) => c.start && c.start >= today && c.status !== 'potential')
    .sort((a: any, b: any) => a.start.localeCompare(b.start));

  const potentials = conventions
    .filter((c: any) => c.status === 'potential')
    .sort((a: any, b: any) => (a.start || '').localeCompare(b.start || ''));

  const past = conventions
    .filter((c: any) => c.start && c.start < today && c.status !== 'potential')
    .sort((a: any, b: any) => b.start.localeCompare(a.start));

  const next = upcoming[0];
  const nextDays = next ? daysUntil(next.start) : null;
  const checkDone = next ? (next.checklist || []).filter((x: any) => x.done).length : 0;
  const checkTotal = next ? (next.checklist || []).length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Events
          {upcoming.length > 0 && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">{upcoming.length} upcoming</span>
          )}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
          className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading events…
        </div>
      ) : conventions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 text-center rounded-2xl border border-white/5 bg-card/20">
          <Calendar className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No events yet.</p>
          <p className="text-xs mt-1">Add conventions from Studio Manager.</p>
        </div>
      ) : (
        <>
          {next && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60 mb-4">Next Event</p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="text-center shrink-0 min-w-[80px]">
                  {nextDays === 0 ? (
                    <div className="font-display text-4xl font-bold text-emerald-400">🟢</div>
                  ) : (
                    <div className="font-display text-6xl font-bold text-primary leading-none">{nextDays}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">
                    {nextDays === 0 ? 'Today!' : nextDays === 1 ? 'day away' : 'days away'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-xl font-bold text-foreground">{next.name}</h2>
                  {next.loc && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {next.loc}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {next.start}{next.end && next.end !== next.start ? ` → ${next.end}` : ''}
                  </div>
                  {checkTotal > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span className="flex items-center gap-1"><CheckSquare className="h-3 w-3" /> Checklist</span>
                        <span>{checkDone}/{checkTotal}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${checkTotal > 0 ? (checkDone / checkTotal) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                {(next.cost > 0 || next.target > 0) && (
                  <div className="flex flex-col gap-1 shrink-0 text-sm text-right">
                    {next.cost > 0 && <div><span className="text-muted-foreground">Booth </span><span className="text-red-400">${next.cost}</span></div>}
                    {next.target > 0 && <div><span className="text-muted-foreground">Target </span><span className="text-amber-400">${next.target}</span></div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {upcoming.length > 1 && (
            <EventSection title="Upcoming" count={upcoming.length - 1}>
              {upcoming.slice(1).map((c: any) => <EventRow key={c.id} c={c} />)}
            </EventSection>
          )}

          {potentials.length > 0 && (
            <EventSection title="Potential" count={potentials.length} accent="amber">
              {potentials.map((c: any) => <EventRow key={c.id} c={c} />)}
            </EventSection>
          )}

          {past.length > 0 && (
            <EventSection title="Past" count={past.length} muted>
              {past.map((c: any) => <EventRow key={c.id} c={c} />)}
            </EventSection>
          )}
        </>
      )}
    </div>
  );
}

function EventSection({ title, count, children, accent, muted }: {
  title: string; count: number; children: React.ReactNode; accent?: string; muted?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
        <h4 className={`text-sm font-semibold ${muted ? 'text-muted-foreground/40' : accent === 'amber' ? 'text-amber-400' : 'text-foreground'}`}>
          {title}
        </h4>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-bold text-muted-foreground">{count}</span>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function EventRow({ c }: { c: any }) {
  const days = c.start ? daysUntil(c.start) : null;
  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground/60 flex-wrap">
          {c.loc && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.loc}</span>}
          {c.start && <span>{c.start}</span>}
        </div>
        {c.status === 'potential' && c.vendorDeadline && c.vendorDeadline !== 'Unknown' && (
          <p className="text-xs text-amber-400/70 mt-0.5">Deadline: {c.vendorDeadline}</p>
        )}
      </div>
      {days !== null && days >= 0 && c.status !== 'potential' && (
        <span className="shrink-0 text-xs font-mono text-muted-foreground/50">
          {days === 0 ? 'Today' : `${days}d`}
        </span>
      )}
    </div>
  );
}
