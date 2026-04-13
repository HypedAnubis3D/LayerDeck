import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Flame, RefreshCw, Download, ExternalLink, PackageOpen, Cpu, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ForgeStudio } from './ForgeStudio';

interface ForgeExport {
  id: string;
  created_at: string;
  image_name: string | null;
  download_url: string | null;
  stl_url: string | null;
  slot_count: number | null;
  layer_height: string | null;
  print_size: string | null;
  status: string | null;
  palette: Array<{ hex: string; colorName: string; slot: number }> | null;
  layer_instructions: unknown;
}

async function fetchForgeExports(): Promise<ForgeExport[]> {
  const { data, error } = await supabase
    .from('forge_exports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ForgeExport[];
}

function PaletteStrip({ palette }: { palette: ForgeExport['palette'] }) {
  if (!palette || !palette.length) return null;
  return (
    <div className="flex rounded overflow-hidden h-3 w-full">
      {palette.map((c, i) => (
        <div key={i} className="flex-1" style={{ background: c.hex || '#888' }} title={c.colorName || `Slot ${c.slot}`} />
      ))}
    </div>
  );
}

function ExportCard({ exp, onDelete }: { exp: ForgeExport; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const downloadUrl = exp.download_url || exp.stl_url || '';
  const date = exp.created_at
    ? new Date(exp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  function handleOpen() {
    if (!downloadUrl) return;
    window.open(downloadUrl, '_blank', 'noopener');
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from('forge_exports').delete().eq('id', exp.id);
    if (error) console.error('Delete failed', error);
    else onDelete(exp.id);
    setDeleting(false);
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm p-4 space-y-3">
      <PaletteStrip palette={exp.palette} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {exp.image_name || 'Untitled Export'}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground/70">
            {exp.print_size && <span>{exp.print_size}</span>}
            {exp.slot_count != null && <span>{exp.slot_count} colors</span>}
            {exp.layer_height && <span>{exp.layer_height}mm layers</span>}
            <span>{date}</span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 text-xs font-semibold text-emerald-400 whitespace-nowrap">
          Ready
        </span>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1 gap-1.5 text-xs font-semibold" onClick={handleOpen} disabled={!downloadUrl}>
          <ExternalLink className="h-3.5 w-3.5" /> Open in Bambu Studio
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs border-white/10 hover:border-white/20"
          onClick={handleOpen} disabled={!downloadUrl} title="Save 3MF file">
          <Download className="h-3.5 w-3.5" /> Save 3MF
        </Button>
        <Button size="sm" variant="outline" className="gap-1 text-xs border-red-500/20 hover:border-red-500/50 hover:bg-red-500/10 text-red-400"
          onClick={handleDelete} disabled={deleting} title="Delete export">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

type SubTab = 'queue' | 'studio';

interface ForgeTabProps {
  onNewExportCount?: (count: number) => void;
}

export function ForgeTab({ onNewExportCount }: ForgeTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('queue');
  const lastKnownCount = useRef<number | null>(null);
  const queryClient = useQueryClient();

  function handleDelete(id: string) {
    queryClient.setQueryData<ForgeExport[]>(['forge-exports'], old => (old ?? []).filter(e => e.id !== id));
  }

  const { data: exports = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['forge-exports'],
    queryFn: fetchForgeExports,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (lastKnownCount.current === null) {
      lastKnownCount.current = exports.length;
      return;
    }
    const newCount = exports.length - lastKnownCount.current;
    if (newCount > 0 && onNewExportCount) onNewExportCount(newCount);
    lastKnownCount.current = exports.length;
  }, [exports.length, onNewExportCount]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" /> Forge
        </h3>

        {/* Sub-tab switcher */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          <button onClick={() => setSubTab('queue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
              ${subTab === 'queue' ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
            <PackageOpen className="h-3.5 w-3.5" /> Export Queue
            {exports.length > 0 && (
              <span className="ml-0.5 rounded-full bg-white/20 px-1.5 py-0 text-[10px] leading-4">{exports.length}</span>
            )}
          </button>
          <button onClick={() => setSubTab('studio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
              ${subTab === 'studio' ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
            <Cpu className="h-3.5 w-3.5" /> Forge Studio
          </button>
        </div>
      </div>

      {/* ── EXPORT QUEUE ─────────────────────────────────────────────────── */}
      {subTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {exports.length} export{exports.length !== 1 ? 's' : ''} · polled every 30 seconds
            </p>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}
              className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10">
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading exports…
            </div>
          ) : exports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50 text-center rounded-2xl border border-white/5 bg-card/20">
              <PackageOpen className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No Forge exports yet.</p>
              <p className="text-xs mt-1">Use Forge Studio above, or export from LayerDeck mobile.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {exports.map(exp => <ExportCard key={exp.id} exp={exp} onDelete={handleDelete} />)}
            </div>
          )}
        </div>
      )}

      {/* ── FORGE STUDIO ─────────────────────────────────────────────────── */}
      {subTab === 'studio' && <ForgeStudio />}
    </div>
  );
}
