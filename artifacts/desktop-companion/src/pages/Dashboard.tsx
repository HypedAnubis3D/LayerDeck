import { useState, useCallback } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { StatCard } from '@/components/dashboard/StatCard';
import { DropZone } from '@/components/upload/DropZone';
import { PreviewList } from '@/components/upload/PreviewList';
import { useDashboardMetrics, useLibrary, usePullLibrary, usePushLibrary } from '@/hooks/use-collections';
import { parse3MFFile, Parsed3MF } from '@/lib/3mf-parser';
import { Database, PackageOpen, Printer, Disc, Calendar, Layers, Library, RefreshCw, UploadCloud, DownloadCloud } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { data: metrics, isLoading } = useDashboardMetrics();
  const { data: libraryItems = [] } = useLibrary();
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

  const containerVars = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      <div className="absolute top-0 left-[20%] w-[60%] h-[300px] bg-primary/5 rounded-[100%] blur-[120px] pointer-events-none" />

      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">

        {/* DASHBOARD METRICS */}
        <div className="mb-8">
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

        {/* SYNC CONTROLS */}
        <div className="mb-8 rounded-2xl border border-white/5 bg-card/30 p-5 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold tracking-wide flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                3MF Library Sync
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {libraryItems.length} file{libraryItems.length !== 1 ? 's' : ''} in library — stay in sync with Studio Manager
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handlePull}
                disabled={isPulling}
                className="gap-2 border-white/10 hover:border-primary/40"
              >
                {isPulling
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : <DownloadCloud className="h-4 w-4" />
                }
                Pull from Cloud
              </Button>
              <Button
                onClick={handlePush}
                disabled={isPushing || libraryItems.length === 0}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                {isPushing
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : <UploadCloud className="h-4 w-4" />
                }
                Push to Cloud
              </Button>
            </div>
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
