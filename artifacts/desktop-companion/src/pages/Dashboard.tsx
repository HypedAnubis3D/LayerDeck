import { useState, useCallback } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { StatCard } from '@/components/dashboard/StatCard';
import { DropZone } from '@/components/upload/DropZone';
import { PreviewList } from '@/components/upload/PreviewList';
import { useDashboardMetrics } from '@/hooks/use-collections';
import { parse3MFFile, Parsed3MF } from '@/lib/3mf-parser';
import { Database, PackageOpen, Printer, Disc, Calendar, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data: metrics, isLoading } = useDashboardMetrics();
  const [parsedFiles, setParsedFiles] = useState<Parsed3MF[]>([]);

  const handleFilesAccepted = useCallback(async (files: File[]) => {
    // Create initial pending entries
    const initialEntries = files.map(file => ({
      id: crypto.randomUUID(),
      filename: file.name,
      file,
      modelName: file.name,
      objectsCount: 0,
      status: 'parsing' as const
    }));
    
    setParsedFiles(prev => [...initialEntries, ...prev]);

    // Process them async
    for (const entry of initialEntries) {
      const parsed = await parse3MFFile(entry.file);
      parsed.id = entry.id; // Keep the stable ID we generated
      
      setParsedFiles(prev => prev.map(p => p.id === entry.id ? parsed : p));
    }
  }, []);

  const handleFileUpdated = useCallback((id: string, updates: Partial<Parsed3MF>) => {
    setParsedFiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  // Animation variants
  const containerVars = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-[20%] w-[60%] h-[300px] bg-primary/5 rounded-[100%] blur-[120px] pointer-events-none" />
      
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">
        
        {/* DASHBOARD METRICS */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Database className="h-5 w-5 text-accent" />
            <h2 className="font-display text-xl font-semibold tracking-wide">Business Overview</h2>
          </div>
          
          <motion.div 
            variants={containerVars}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
          >
            <StatCard 
              title="Catalog Items" 
              value={isLoading ? "-" : metrics?.catalogCount ?? 0} 
              icon={Layers} 
              accentColor="primary"
            />
            <StatCard 
              title="Open Orders" 
              value={isLoading ? "-" : metrics?.openOrdersCount ?? 0} 
              icon={PackageOpen} 
              accentColor="accent"
            />
            <StatCard 
              title="Print Queue" 
              value={isLoading ? "-" : metrics?.activePrintJobs ?? 0} 
              icon={Printer} 
              accentColor="primary"
            />
            <StatCard 
              title="Spool Stock" 
              value={isLoading ? "-" : metrics?.spoolCount ?? 0} 
              icon={Disc} 
              accentColor="muted"
            />
            <StatCard 
              title="Conventions" 
              value={isLoading ? "-" : metrics?.upcomingConventions ?? 0} 
              icon={Calendar} 
              accentColor="muted"
            />
          </motion.div>
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
