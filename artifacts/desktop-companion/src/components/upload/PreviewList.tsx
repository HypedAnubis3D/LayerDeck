import { Parsed3MF } from '@/lib/3mf-parser';
import { useAddToLibrary, useAddAllToLibrary } from '@/hooks/use-collections';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, FileBox, CheckCircle, Clock, Loader2, AlertCircle, Plus, Library, Layers, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PreviewListProps {
  files: Parsed3MF[];
  onFileUpdated: (fileId: string, updates: Partial<Parsed3MF>) => void;
  onRemoveCard?: (fileId: string) => void;
}

export function PreviewList({ files, onFileUpdated, onRemoveCard }: PreviewListProps) {
  const { mutate: addToLibrary, isPending: isAddingOne } = useAddToLibrary();
  const { mutate: addAll, isPending: isAddingAll } = useAddAllToLibrary();
  const { toast } = useToast();

  const readyFiles = files.filter(f => f.status === 'ready');

  const handleAdd = (file: Parsed3MF) => {
    addToLibrary(file, {
      onSuccess: () => {
        onFileUpdated(file.id, { status: 'added' });
        toast({ title: 'Added to 3MF Library', description: file.modelName });
      },
      onError: (err) => {
        toast({ title: 'Failed to add', description: err.message, variant: 'destructive' });
      },
    });
  };

  const handleSyncAll = () => {
    addAll(files, {
      onSuccess: (result) => {
        if (!result) return;
        files.filter(f => f.status === 'ready').forEach(f => onFileUpdated(f.id, { status: 'added' }));
        toast({
          title: `Synced ${result.added} file${result.added !== 1 ? 's' : ''} to 3MF Library`,
          description: result.added === 0 ? 'All files already in library.' : undefined,
        });
      },
      onError: (err) => {
        toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
      },
    });
  };

  if (files.length === 0) return null;

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold tracking-wide text-foreground/80 flex items-center gap-2">
          <FileBox className="h-5 w-5 text-primary" />
          Parsed Files ({files.length})
        </h3>
        {readyFiles.length > 0 && (
          <Button
            onClick={handleSyncAll}
            disabled={isAddingAll}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            {isAddingAll
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Library className="h-4 w-4" />}
            Sync All to Library ({readyFiles.length})
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        <AnimatePresence>
          {files.map((file, idx) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              className={`
                relative overflow-hidden rounded-xl border bg-card/60 p-5 backdrop-blur-sm
                transition-all duration-300 hover:border-white/10 hover:bg-card/80
                ${file.status === 'added' ? 'border-primary/20 bg-primary/5' : 'border-white/5'}
                ${file.status === 'error' ? 'border-destructive/30 bg-destructive/5' : ''}
              `}
            >
              {/* Status bar */}
              <div className={`absolute left-0 top-0 h-full w-1
                ${file.status === 'ready' ? 'bg-accent' : ''}
                ${file.status === 'added' ? 'bg-primary' : ''}
                ${file.status === 'error' ? 'bg-destructive' : ''}
                ${file.status === 'parsing' ? 'bg-muted animate-pulse' : ''}
              `} />

              {/* Dismiss card button */}
              {onRemoveCard && file.status !== 'parsing' && (
                <button
                  onClick={() => onRemoveCard(file.id)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground/30 hover:text-muted-foreground/80"
                  title="Remove from session"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              <div className="pl-2 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground truncate" title={file.modelName}>
                        {file.modelName}
                      </h4>
                      {file.status === 'added' && (
                        <span className="flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
                          In Library
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5" title={file.filename}>
                      {file.filename}
                    </p>
                  </div>

                  {/* Action button */}
                  <div className="shrink-0">
                    {file.status === 'parsing' && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                    {file.status === 'error' && <AlertCircle className="h-6 w-6 text-destructive" title={file.errorMessage} />}
                    {file.status === 'added' && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                    )}
                    {file.status === 'ready' && (
                      <Button
                        size="sm"
                        onClick={() => handleAdd(file)}
                        disabled={isAddingOne}
                        className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20"
                      >
                        {isAddingOne ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                        Add to Library
                      </Button>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                {file.status !== 'parsing' && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground/80">
                    {file.objectsCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Box className="h-3.5 w-3.5" />
                        {file.objectsCount} object{file.objectsCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {file.printTimeEstimate && (
                      <span className="flex items-center gap-1 text-accent/90">
                        <Clock className="h-3.5 w-3.5" />
                        {file.printTimeEstimate}
                      </span>
                    )}
                    {file.layerHeight && (
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        {file.layerHeight}mm
                      </span>
                    )}
                    {file.nozzleDiam && (
                      <span className="text-muted-foreground/60">⌀{file.nozzleDiam}mm</span>
                    )}
                    {file.printer && (
                      <span className="text-muted-foreground/60 truncate">{file.printer}</span>
                    )}
                  </div>
                )}

                {/* Filament color swatches + grams */}
                {file.status !== 'parsing' && file.filamentColors.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {file.filamentColors.map((color, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div
                          className="h-4 w-4 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: color }}
                          title={`${file.filamentTypes[i] || 'Filament'} — ${color}`}
                        />
                        {file.filamentGramsPerColor[i] != null && (
                          <span className="text-[10px] font-mono text-muted-foreground/70">
                            {file.filamentGramsPerColor[i]}g
                          </span>
                        )}
                        {file.filamentTypes[i] && (
                          <span className="text-[10px] text-muted-foreground/50">
                            {file.filamentTypes[i]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
