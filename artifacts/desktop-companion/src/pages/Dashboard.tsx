import { useState, useCallback, useEffect, useRef } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { StatCard } from '@/components/dashboard/StatCard';
import { DropZone } from '@/components/upload/DropZone';
import { PreviewList } from '@/components/upload/PreviewList';
import { useDashboardMetrics, useLibrary } from '@/hooks/use-collections';
import { parse3MFFile, Parsed3MF } from '@/lib/3mf-parser';
import {
  Database, PackageOpen, Printer, Disc, Calendar,
  Library, LayoutDashboard, ListOrdered, Wrench, TrendingUp, Cpu, X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { LibraryTab } from '@/components/tabs/LibraryTab';
import { QueueTab } from '@/components/tabs/QueueTab';
import { EventsTab } from '@/components/tabs/EventsTab';
import { WorkshopTab } from '@/components/tabs/WorkshopTab';
import { SalesTab } from '@/components/tabs/SalesTab';
import { PrintersTab } from '@/components/tabs/PrintersTab';

const PARSED_STORAGE_KEY = 'layerstack_companion_parsed_files';

type TabId = 'home' | 'library' | 'queue' | 'events' | 'workshop' | 'sales' | 'printers';

const TABS: { id: TabId; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home',     label: 'Home',     Icon: LayoutDashboard },
  { id: 'library',  label: 'Library',  Icon: Library },
  { id: 'queue',    label: 'Queue',    Icon: ListOrdered },
  { id: 'events',   label: 'Events',   Icon: Calendar },
  { id: 'workshop', label: 'Workshop', Icon: Wrench },
  { id: 'sales',    label: 'Sales',    Icon: TrendingUp },
  { id: 'printers', label: 'Printers', Icon: Cpu },
];

function saveParsedToStorage(files: Parsed3MF[]) {
  const serialisable = files
    .filter(f => f.status !== 'parsing')
    .map(({ file: _file, ...rest }) => rest);
  try { localStorage.setItem(PARSED_STORAGE_KEY, JSON.stringify(serialisable)); } catch { }
}

function loadParsedFromStorage(): Parsed3MF[] {
  try {
    const raw = localStorage.getItem(PARSED_STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as Parsed3MF[];
    return items.map(f => ({ ...f, file: null, status: f.status === 'error' ? 'error' : 'ready' }));
  } catch { return []; }
}

export default function Dashboard() {
  const { data: metrics, isLoading } = useDashboardMetrics();
  const { data: libraryItems = [] } = useLibrary();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabId>('home');
  const [parsedFiles, setParsedFiles] = useState<Parsed3MF[]>(() => loadParsedFromStorage());

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    saveParsedToStorage(parsedFiles);
  }, [parsedFiles]);

  useEffect(() => {
    if (parsedFiles.length === 0) return;
    const libNames = new Set((libraryItems as any[]).map((i: any) => i.filename));
    setParsedFiles(prev =>
      prev.map(f => {
        if (f.status === 'added' && !libNames.has(f.filename)) return { ...f, status: 'ready' };
        if (f.status === 'ready' && libNames.has(f.filename)) return { ...f, status: 'added' };
        return f;
      })
    );
  }, [libraryItems]);

  const handleFilesAccepted = useCallback(async (newFiles: File[]) => {
    const existingFilenames = new Set(parsedFiles.map(f => f.filename));
    const fresh = newFiles.filter(f => !existingFilenames.has(f.name));
    if (!fresh.length) {
      toast({ title: 'Already loaded', description: 'All dropped files are already in your session.' });
      return;
    }
    const initialEntries: Parsed3MF[] = fresh.map(file => ({
      id: crypto.randomUUID(), filename: file.name, file,
      modelName: file.name.replace(/\.3mf$/i, ''), objectsCount: 0, objects: [],
      filamentColors: [], filamentTypes: [], filamentGramsPerColor: [], status: 'parsing',
    }));
    setParsedFiles(prev => [...initialEntries, ...prev]);
    for (const entry of initialEntries) {
      const parsed = await parse3MFFile(entry.file!);
      parsed.id = entry.id;
      setParsedFiles(prev => prev.map(p => p.id === entry.id ? parsed : p));
    }
  }, [parsedFiles, toast]);

  const handleFileUpdated = useCallback((id: string, updates: Partial<Parsed3MF>) => {
    setParsedFiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const handleClearSession = () => {
    setParsedFiles([]);
    localStorage.removeItem(PARSED_STORAGE_KEY);
    toast({ title: 'Session cleared' });
  };

  const handleRemoveCard = (id: string) => setParsedFiles(prev => prev.filter(p => p.id !== id));

  const containerVars = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      <div className="absolute top-0 left-[20%] w-[60%] h-[300px] bg-primary/5 rounded-[100%] blur-[120px] pointer-events-none" />

      <Navbar />

      <div className="sticky top-16 z-40 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-0.5 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border
                  ${tab === id
                    ? 'bg-primary/15 text-primary border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border-transparent'}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">
        {tab === 'home' && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Database className="h-5 w-5 text-accent" />
                <h2 className="font-display text-xl font-semibold tracking-wide">Business Overview</h2>
              </div>
              <motion.div variants={containerVars} initial="hidden" animate="show"
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard title="3MF Library"   value={isLoading ? '-' : metrics?.libraryCount ?? 0}     icon={Library}     accentColor="primary" />
                <StatCard title="Catalog Items"  value={isLoading ? '-' : metrics?.catalogCount ?? 0}     icon={Database}    accentColor="accent" />
                <StatCard title="Open Orders"    value={isLoading ? '-' : metrics?.openOrdersCount ?? 0}  icon={PackageOpen} accentColor="accent" />
                <StatCard title="Print Queue"    value={isLoading ? '-' : metrics?.activePrintJobs ?? 0}  icon={Printer}     accentColor="primary" />
                <StatCard title="Spool Stock"    value={isLoading ? '-' : metrics?.spoolCount ?? 0}       icon={Disc}        accentColor="muted" />
                <StatCard title="Conventions"    value={isLoading ? '-' : metrics?.upcomingConventions ?? 0} icon={Calendar} accentColor="muted" />
              </motion.div>
            </div>

            <div className="bg-card/30 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display text-base font-semibold tracking-wide text-foreground/80">3MF Files</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Files persist between sessions — drop new ones to add them</p>
                  </div>
                  {parsedFiles.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleClearSession}
                      className="gap-1.5 text-muted-foreground/60 hover:text-destructive text-xs">
                      <X className="h-3.5 w-3.5" /> Clear all
                    </Button>
                  )}
                </div>
                <DropZone onFilesAccepted={handleFilesAccepted} />
                <PreviewList files={parsedFiles} onFileUpdated={handleFileUpdated} onRemoveCard={handleRemoveCard} />
              </div>
            </div>
          </div>
        )}

        {tab === 'library'  && <LibraryTab />}
        {tab === 'queue'    && <QueueTab />}
        {tab === 'events'   && <EventsTab />}
        {tab === 'workshop' && <WorkshopTab />}
        {tab === 'sales'    && <SalesTab />}
        {tab === 'printers' && <PrintersTab />}
      </main>
    </div>
  );
}
