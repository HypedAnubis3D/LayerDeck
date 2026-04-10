import { useState, useMemo } from 'react';
import {
  useLibrary, usePullLibrary, usePushLibrary,
  useRemoveFromLibrary, useRemoveManyFromLibrary,
} from '@/hooks/use-collections';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Library, RefreshCw, UploadCloud, DownloadCloud, Box, Clock,
  Trash2, CheckSquare, Square, X, Search, FolderOpen,
} from 'lucide-react';

export function LibraryTab() {
  const { data: libraryItems = [], isLoading } = useLibrary();
  const { mutate: pullLibrary, isPending: isPulling } = usePullLibrary();
  const { mutate: pushLibrary, isPending: isPushing } = usePushLibrary();
  const { mutate: removeOne, isPending: isRemoving } = useRemoveFromLibrary();
  const { mutate: removeMany, isPending: isRemovingMany } = useRemoveManyFromLibrary();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [filterPrinter, setFilterPrinter] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const printers = useMemo(() => {
    const s = new Set<string>();
    (libraryItems as any[]).forEach(i => { if (i.printer) s.add(i.printer); });
    return [...s];
  }, [libraryItems]);

  const filamentTypes = useMemo(() => {
    const s = new Set<string>();
    (libraryItems as any[]).forEach(i => {
      (i.filamentTypes || []).forEach((t: string) => { if (t) s.add(t); });
    });
    return [...s];
  }, [libraryItems]);

  const filtered = useMemo(() => {
    return (libraryItems as any[]).filter(item => {
      if (search) {
        const q = search.toLowerCase();
        if (!(item.name || '').toLowerCase().includes(q) && !(item.filename || '').toLowerCase().includes(q)) return false;
      }
      if (filterPrinter && item.printer !== filterPrinter) return false;
      if (filterType && !(item.filamentTypes || []).includes(filterType)) return false;
      return true;
    });
  }, [libraryItems, search, filterPrinter, filterType]);

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((i: any) => i.id)));
  };

  const exitSelect = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const handlePull = () => pullLibrary(undefined, {
    onSuccess: (d) => toast({ title: 'Library pulled', description: `${d.length} files synced.` }),
    onError: (e) => toast({ title: 'Pull failed', description: e.message, variant: 'destructive' }),
  });

  const handlePush = () => pushLibrary(libraryItems, {
    onSuccess: () => toast({ title: 'Library pushed', description: `${libraryItems.length} files saved.` }),
    onError: (e) => toast({ title: 'Push failed', description: e.message, variant: 'destructive' }),
  });

  const handleRemoveOne = (id: string) => removeOne(id, {
    onSuccess: () => toast({ title: 'Removed from library' }),
    onError: (e) => toast({ title: 'Remove failed', description: e.message, variant: 'destructive' }),
  });

  const handleRemoveSelected = () => removeMany([...selectedIds], {
    onSuccess: (count) => { toast({ title: `Removed ${count} files` }); exitSelect(); },
    onError: (e) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
      <div className="p-5 border-b border-white/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
              <Library className="h-4 w-4 text-primary" />
              3MF Library
              {libraryItems.length > 0 && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                  {filtered.length}{filtered.length !== libraryItems.length ? `/${libraryItems.length}` : ''}
                </span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">Files synced to your cloud workspace</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectMode ? (
              <>
                <Button variant="outline" size="sm" onClick={toggleSelectAll} className="gap-1.5 border-white/10 text-xs">
                  {allSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Button>
                {selectedIds.size > 0 && (
                  <Button size="sm" onClick={handleRemoveSelected} disabled={isRemovingMany}
                    className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isRemovingMany ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete ({selectedIds.size})
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={exitSelect} className="text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                {libraryItems.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectMode(true)}
                    className="gap-1.5 text-muted-foreground border border-white/5 hover:border-white/10">
                    <CheckSquare className="h-3.5 w-3.5" /> Select
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handlePull} disabled={isPulling}
                  className="gap-2 border-white/10 hover:border-primary/40">
                  {isPulling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />}
                  Pull
                </Button>
                <Button size="sm" onClick={handlePush} disabled={isPushing || libraryItems.length === 0}
                  className="gap-2 bg-primary hover:bg-primary/90">
                  {isPushing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                  Push
                </Button>
              </>
            )}
          </div>
        </div>

        {libraryItems.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input type="text" placeholder="Search by name or filename…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border border-white/10 bg-background/50 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {printers.map(p => (
                <button key={p} onClick={() => setFilterPrinter(filterPrinter === p ? '' : p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                    ${filterPrinter === p ? 'bg-primary/15 text-primary border-primary/20' : 'border-white/10 text-muted-foreground hover:border-white/20'}`}>
                  {p}
                </button>
              ))}
              {filamentTypes.map(t => (
                <button key={t} onClick={() => setFilterType(filterType === t ? '' : t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                    ${filterType === t ? 'bg-accent/15 text-accent border-accent/20' : 'border-white/10 text-muted-foreground hover:border-white/20'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading library…
          </div>
        ) : libraryItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground/60">
            <Library className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No files in library yet.</p>
            <p className="text-xs mt-1">Go to Home, upload a 3MF file, and click "Add to Library".</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground/60">
            <Search className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No files match your filters.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {filtered.map((item: any) => {
                const isSelected = selectedIds.has(item.id);
                const colors: string[] = Array.isArray(item.filamentColors) ? item.filamentColors : [];
                const grams: number[] = Array.isArray(item.filamentGramsPerColor) ? item.filamentGramsPerColor : [];
                return (
                  <motion.div key={item.id}
                    initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => selectMode && toggleSelect(item.id)}
                    className={`group relative flex items-start gap-3 rounded-xl border p-4 transition-all duration-200
                      ${selectMode ? 'cursor-pointer' : ''}
                      ${isSelected ? 'border-destructive/50 bg-destructive/10' : 'border-white/5 bg-card/50 hover:border-primary/20 hover:bg-card/80'}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      {selectMode
                        ? isSelected ? <CheckSquare className="h-4 w-4 text-destructive" /> : <Square className="h-4 w-4 text-muted-foreground/50" />
                        : <Library className="h-4 w-4 text-primary/70" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{item.name || item.filename}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{item.filename}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {item.printer && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground/60">
                            {item.printer}
                          </span>
                        )}
                        {item.folderName && (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/15">
                            <FolderOpen className="h-2.5 w-2.5" />
                            {item.folderName}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/60">
                        {Array.isArray(item.objects) && item.objects.length > 0 && (
                          <span className="flex items-center gap-1"><Box className="h-3 w-3" />{item.objects.length} obj</span>
                        )}
                        {item.hrs && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />~{item.hrs}h</span>}
                        {item.supportGrams > 0 && <span className="text-amber-500/60">{item.supportGrams}g support</span>}
                        <span className="ml-auto">{new Date(item.uploadedAt).toLocaleDateString()}</span>
                      </div>
                      {colors.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {colors.map((color, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <div className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: color }} />
                              {grams[i] != null && <span className="text-[10px] font-mono text-muted-foreground/50">{grams[i]}g</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {!selectMode && (
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveOne(item.id); }}
                        disabled={isRemoving}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground/40 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
