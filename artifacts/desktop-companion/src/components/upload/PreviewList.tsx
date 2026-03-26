import { Parsed3MF } from '@/lib/3mf-parser';
import { useAddToCatalog } from '@/hooks/use-collections';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, FileBox, CheckCircle, Clock, Loader2, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PreviewListProps {
  files: Parsed3MF[];
  onFileUpdated: (fileId: string, updates: Partial<Parsed3MF>) => void;
}

export function PreviewList({ files, onFileUpdated }: PreviewListProps) {
  const { mutate: addToCatalog, isPending } = useAddToCatalog();
  const { toast } = useToast();

  const handleAdd = (file: Parsed3MF) => {
    addToCatalog(
      {
        name: file.modelName || file.filename,
        file3mf: file.filename,
        description: `Imported via Desktop Companion. Contains ${file.objectsCount} objects.`
      },
      {
        onSuccess: () => {
          onFileUpdated(file.id, { status: 'added' });
          toast({
            title: "Added to Catalog",
            description: `${file.filename} is now synced.`,
          });
        },
        onError: (err) => {
          toast({
            title: "Failed to add",
            description: err.message,
            variant: "destructive",
          });
        }
      }
    );
  };

  if (files.length === 0) return null;

  return (
    <div className="mt-8 space-y-4">
      <h3 className="font-display text-lg font-semibold tracking-wide text-foreground/80 flex items-center gap-2">
        <FileBox className="h-5 w-5 text-primary" />
        Processing Queue
      </h3>
      
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
              {/* Status indicator line */}
              <div className={`absolute left-0 top-0 h-full w-1 
                ${file.status === 'ready' ? 'bg-accent' : ''}
                ${file.status === 'added' ? 'bg-primary' : ''}
                ${file.status === 'error' ? 'bg-destructive' : ''}
                ${file.status === 'parsing' ? 'bg-muted' : ''}
              `} />
              
              <div className="flex items-start justify-between gap-4 pl-2">
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground truncate" title={file.modelName}>
                      {file.modelName}
                    </h4>
                    {file.status === 'added' && (
                      <span className="flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
                        Synced
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate font-mono" title={file.filename}>
                    {file.filename}
                  </p>
                  
                  <div className="mt-3 flex items-center gap-4 text-xs font-medium text-muted-foreground/80">
                    <div className="flex items-center gap-1.5">
                      <Box className="h-3.5 w-3.5" />
                      {file.status === 'parsing' ? '--' : file.objectsCount} objects
                    </div>
                    {file.printTimeEstimate && (
                      <div className="flex items-center gap-1.5 text-accent/80">
                        <Clock className="h-3.5 w-3.5" />
                        ~{file.printTimeEstimate}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-center">
                  {file.status === 'parsing' && (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="h-6 w-6 text-destructive" title={file.errorMessage} />
                  )}
                  {file.status === 'added' && (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                  )}
                  {file.status === 'ready' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleAdd(file)}
                      disabled={isPending}
                      className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                      Add Catalog
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
