import { useState, useCallback } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { StatCard } from '@/components/dashboard/StatCard';
import { DropZone } from '@/components/upload/DropZone';
import { PreviewList } from '@/components/upload/PreviewList';
import { useDashboardMetrics, useLibrary, usePullLibrary, usePushLibrary } from '@/hooks/use-collections';
import { parse3MFFile, Parsed3MF } from '@/lib/3mf-parser';
import {
  Database, PackageOpen, Printer, Disc, Calendar, Layers,
  Library, RefreshCw, UploadCloud, DownloadCloud, Box, Clock, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: metrics, isLoading } = useDashboardMetrics();
  const { data: libraryItems = [], isLoading: isLibraryLoading } = useLibrary();
  const { mutate: pullLibrary, isPending: isPulling } = usePullLibrary();
  const { mutate: pushLibrary, isPending: isPushing } = usePushLibrary();
  const { toast } = useToast();
  const [parsedFiles, setParsedFiles] = useState<Parsed3MF[]>([]);

  const handleFilesAccepted = useCallback(async (files: File[]) => {
    const initialEntries = files.map(file => ({
      id: crypto.randomUUID(),
      filename: file.name,
      file,
      modelName: file.name.replace(/\.3mf$/i, ''),
      objectsCount: 0,
      status: 'parsing' as const
    }));

    setParsedFiles(prev => [...initialEntries, ...prev]);

    for (const entry of initialEntries) {
      const parsed = await parse3MFFile(entry.file);
      parsed.id = entry.id;
      setParsedFiles(prev => prev.map(p => p.id === entry.id ? parsed : p));
    }
  }, []);

  const handleFileUpdated = useCallback((id: string, updates: Partial<Parsed3MF>) => {
    setParsedFiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const handlePull = () => {
    pullLibrary(undefined, {
      onSuccess: (data) => {
        toast({ title: "Library pulled", description: `${data.length} file${data.length !== 1 ? 's' : ''} synced from cloud.` });
      },
      onError: (err) => {
        toast({ title: "Pull failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handlePush = () => {
    pushLibrary(libraryItems, {
      onSuccess: () => {
        toast({ title: "Library pushed to cloud", description: `${libraryItems.length} file${libraryItems.length !== 1 ? 's' : ''} saved.` });
      },
      onError: (err) => {
        toast({ title: "Push failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleRemoveFromLibrary = async (itemId: string) => {
    if (!user) return;
    const updated = libraryItems.filter((item: any) => item.id !== itemId);
    const { error } = await supabase
      .from('ha3d_user_data')
      .upsert({
        user_id: user.id,
        collection: 'library3mf',
        payload: JSON.stringify(updated),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,collection' });

    if (error) {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ['library3mf'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      toast({ title: "Removed from library" });
    }
  };

  const containerVars = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

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
            <StatCard title="3MF Library" value={isLoading ? "-" : metrics?.libraryCount ?? 0} icon={Library} accentColor="primary" />
            <StatCard title="Catalog Items" value={isLoading ? "-" : metrics?.catalogCount ?? 0} icon={Layers} accentColor="accent" />
            <StatCard title="Open Orders" value={isLoading ? "-" : metrics?.openOrdersCount ?? 0} icon={PackageOpen} accentColor="accent" />
            <StatCard title="Print Queue" value={isLoading ? "-" : metrics?.activePrintJobs ?? 0} icon={Printer} accentColor="primary" />
            <StatCard title="Spool Stock" value={isLoading ? "-" : metrics?.spoolCount ?? 0} icon={Disc} accentColor="muted" />
            <StatCard title="Conventions" value={isLoading ? "-" : metrics?.upcomingConventions ?? 0} icon={Calendar} accentColor="muted" />
          </motion.div>
        </div>

        {/* 3MF LIBRARY LIST */}
        <div className="rounded-2xl border border-white/5 bg-card/30 backdrop-blur-sm overflow-hidden">
          {/* Library header + sync controls */}
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
                  {(libraryItems as any[]).map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group relative flex items-start gap-3 rounded-xl border border-white/5 bg-card/50 p-4 hover:border-primary/20 hover:bg-card/80 transition-all"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Library className="h-4 w-4 text-primary/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate" title={item.name}>
                          {item.name || item.filename}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate" title={item.filename}>
                          {item.filename}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground/60">
                          {item.objects > 0 && (
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
                      </div>
                      <button
                        onClick={() => handleRemoveFromLibrary(item.id)}
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground/40 hover:text-destructive"
                        title="Remove from library"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
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
