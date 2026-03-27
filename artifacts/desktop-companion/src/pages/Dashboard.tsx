import { useState, useCallback, useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { StatCard } from '@/components/dashboard/StatCard';
import { DropZone } from '@/components/upload/DropZone';
import { PreviewList } from '@/components/upload/PreviewList';
import {
  useDashboardMetrics, useLibrary, usePullLibrary, usePushLibrary,
  useRemoveFromLibrary, useRemoveManyFromLibrary,
} from '@/hooks/use-collections';
import { parse3MFFile, Parsed3MF } from '@/lib/3mf-parser';
import {
  Database, PackageOpen, Printer, Disc, Calendar, Layers,
  Library, RefreshCw, UploadCloud, DownloadCloud, Box, Clock,
  Trash2, CheckSquare, Square, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { data: metrics, isLoading } = useDashboardMetrics();
  const { data: libraryItems = [], isLoading: isLibraryLoading } = useLibrary();
  const { mutate: pullLibrary, isPending: isPulling } = usePullLibrary();
  const { mutate: pushLibrary, isPending: isPushing } = usePushLibrary();
  const { mutate: removeOne, isPending: isRemoving } = useRemoveFromLibrary();
  const { mutate: removeMany, isPending: isRemovingMany } = useRemoveManyFromLibrary();
  const { toast } = useToast();

  const [parsedFiles, setParsedFiles] = useState<Parsed3MF[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // When the library changes (pull or delete from either app), reset any
  // parsed files that are no longer in the library back to 'ready' so the
  // "Add to Library" button becomes active again.
  useEffect(() => {
    if (!libraryItems.length && parsedFiles.length === 0) return;
    const libraryFilenames = new Set((libraryItems as any[]).map((i: any) => i.filename));
    setParsedFiles(prev =>
      prev.map(f =>
        f.status === 'added' && !libraryFilenames.has(f.filename)
          ? { ...f, status: 'ready' }
          : f
      )
    );
  }, [libraryItems]);

  const handleFilesAccepted = useCallback(async (files: File[]) => {
    const initialEntries: Parsed3MF[] = files.map(file => ({
      id: crypto.randomUUID(),
      filename: file.name,
      file,
      modelName: file.name.replace(/\.3mf$/i, ''),
      objectsCount: 0,
      objects: [],
      filamentColors: [],
      filamentTypes: [],
      filamentGramsPerColor: [],
      status: 'parsing',
    }));

    setParsedFiles(prev => [...initialEntries, ...prev]);

    for (const entry of initialEntries) {
      const parsed = await parse3MFFile(entry.file);
      parsed.id = entry.id;
      // Mark as already-added if filename is in the current library
      const libraryFilenames = new Set((libraryItems as any[]).map((i: any) => i.filename));
      if (libraryFilenames.has(parsed.filename)) parsed.status = 'added';
      setParsedFiles(prev => prev.map(p => p.id === entry.id ? parsed : p));
    }
  }, [libraryItems]);

  const handleFileUpdated = useCallback((id: string, updates: Partial<Parsed3MF>) => {
    setParsedFiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const handlePull = () => {
    pullLibrary(undefined, {
      onSuccess: (data) => {
        toast({ title: 'Library pulled', description: `${data.length} file${data.length !== 1 ? 's' : ''} synced from cloud.` });
      },
      onError: (err) => {
        toast({ title: 'Pull failed', description: err.message, variant: 'destructive' });
      },
    });
  };

  const handlePush = () => {
    pushLibrary(libraryItems, {
      onSuccess: () => {
        toast({ title: 'Library pushed to cloud', description: `${libraryItems.length} file${libraryItems.length !== 1 ? 's' : ''} saved.` });
      },
      onError: (err) => {
        toast({ title: 'Push failed', description: err.message, variant: 'destructive' });
      },
    });
  };

  const handleRemoveOne = (itemId: string) => {
    removeOne(itemId, {
      onSuccess: () => toast({ title: 'Removed from library' }),
      onError: (err) => toast({ title: 'Failed to remove', description: err.message, variant: 'destructive' }),
    });
  };

  const handleRemoveSelected = () => {
    const ids = [...selectedIds];
    removeMany(ids, {
      onSuccess: (count) => {
        toast({ title: `Removed ${count} file${count !== 1 ? 's' : ''} from library` });
        setSelectedIds(new Set());
        setSelectMode(false);
      },
      onError: (err) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === libraryItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((libraryItems as any[]).map((i: any) => i.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const containerVars = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const allSelected = libraryItems.length > 0 && selectedIds.size === libraryItems.length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      <div className="absolute top-0 left-[20%] w-[60%] h-[300px] bg-primary/5 rounded-[100%] blur-[120px] pointer-events-none" />

      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10 space-y-8">

        {/* DASHBOARD METRICS */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Database className="h-5 w-5 text-accent" />
            <h2 className="font-display text-xl font-semibold tracking-wide">Business Overview</h2>
          </div>
          <motion.div
            variants={containerVars}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
          >
            <StatCard title="3MF Library" value={isLoading ? '-' : metrics?.libraryCount ?? 0} icon={Library} accentColor="primary" />
            <StatCard title="Catalog Items" value={isLoading ? '-' : metrics?.catalogCount ?? 0} icon={Layers} accentColor="accent" />
            <StatCard title="Open Orders" value={isLoading ? '-' : metrics?.openOrdersCount ?? 0} icon={PackageOpen} accentColor="accent" />
            <StatCard title="Print Queue" value={isLoading ? '-' : metrics?.activePrintJobs ?? 0} icon={Printer} accentColor="primary" />
            <StatCard title="Spool Stock" value={isLoading ? '-' : metrics?.spoolCount ?? 0} icon={Disc} accentColor="muted" />
            <StatCard title="Conventions" value={isLoading ? '-' : metrics?.upcomingConventions ?? 0} icon={Calendar} accentColor="muted" />
          </motion.div>
        </div>

        {/* 3MF LIBRARY */}
        <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-b border-white/5">
            <div>
              <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
                <Library className="h-4 w-4 text-primary" />
                3MF Library
                {libraryItems.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                    {libraryItems.length}
                  </span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Files saved here are synced to your cloud workspace
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Select mode toolbar */}
              {selectMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="gap-1.5 border-white/10 hover:border-primary/40 text-xs"
                  >
                    {allSelected
                      ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                      : <Square className="h-3.5 w-3.5" />}
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button
                      size="sm"
                      onClick={handleRemoveSelected}
                      disabled={isRemovingMany}
                      className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isRemovingMany
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                      Delete ({selectedIds.size})
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exitSelectMode}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </>
              ) : (
                <>
                  {libraryItems.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectMode(true)}
                      className="gap-1.5 text-muted-foreground hover:text-foreground border border-white/5 hover:border-white/10"
                    >
                      <CheckSquare className="h-3.5 w-3.5" /> Select
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePull}
                    disabled={isPulling}
                    className="gap-2 border-white/10 hover:border-primary/40"
                  >
                    {isPulling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <DownloadCloud className="h-3.5 w-3.5" />}
                    Pull
                  </Button>
                  <Button
                    size="sm"
                    onClick={handlePush}
                    disabled={isPushing || libraryItems.length === 0}
                    className="gap-2 bg-primary hover:bg-primary/90"
                  >
                    {isPushing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                    Push
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Library items */}
          <div className="p-5">
            {isLibraryLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading library…
              </div>
            ) : libraryItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground/60">
                <Library className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No files in library yet.</p>
                <p className="text-xs mt-1">Upload a 3MF below and click "Add to Library".</p>
              </div>
            ) : (
              <motion.div
                variants={containerVars}
                initial="hidden"
                animate="show"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                <AnimatePresence>
                  {(libraryItems as any[]).map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    const colors: string[] = Array.isArray(item.filamentColors) ? item.filamentColors : [];
                    const grams: number[] = Array.isArray(item.filamentGramsPerColor) ? item.filamentGramsPerColor : [];

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => selectMode && toggleSelect(item.id)}
                        className={`
                          group relative flex items-start gap-3 rounded-xl border p-4
                          transition-all duration-200
                          ${selectMode ? 'cursor-pointer' : ''}
                          ${isSelected
                            ? 'border-destructive/50 bg-destructive/10'
                            : 'border-white/5 bg-card/50 hover:border-primary/20 hover:bg-card/80'
                          }
                        `}
                      >
                        {/* Checkbox / icon */}
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          {selectMode ? (
                            isSelected
                              ? <CheckSquare className="h-4 w-4 text-destructive" />
                              : <Square className="h-4 w-4 text-muted-foreground/50" />
                          ) : (
                            <Library className="h-4 w-4 text-primary/70" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate" title={item.name}>
                            {item.name || item.filename}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono truncate" title={item.filename}>
                            {item.filename}
                          </p>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/60">
                            {Array.isArray(item.objects) ? item.objects.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Box className="h-3 w-3" />{item.objects.length} obj
                              </span>
                            ) : item.objects > 0 && (
                              <span className="flex items-center gap-1">
                                <Box className="h-3 w-3" />{item.objects} obj
                              </span>
                            )}
                            {item.hrs && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />~{item.hrs}h
                              </span>
                            )}
                            <span className="ml-auto">
                              {new Date(item.uploadedAt).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Color swatches */}
                          {colors.length > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                              {colors.map((color, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <div
                                    className="h-3.5 w-3.5 rounded-full border border-white/20"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                  />
                                  {grams[i] != null && (
                                    <span className="text-[10px] font-mono text-muted-foreground/50">{grams[i]}g</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Single delete — hidden in select mode */}
                        {!selectMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveOne(item.id); }}
                            disabled={isRemoving}
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground/40 hover:text-destructive"
                            title="Remove from library"
                          >
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

        {/* UPLOAD SECTION */}
        <div className="bg-card/30 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl">
          <div className="max-w-4xl mx-auto">
            <DropZone onFilesAccepted={handleFilesAccepted} />
            <PreviewList files={parsedFiles} onFileUpdated={handleFileUpdated} />
          </div>
        </div>

      </main>
    </div>
  );
}
