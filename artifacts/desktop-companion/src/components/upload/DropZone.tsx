import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileType, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DropZoneProps {
  onFilesAccepted: (files: File[]) => void;
}

export function DropZone({ onFilesAccepted }: DropZoneProps) {
  const [isHovering, setIsHovering] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFilesAccepted(acceptedFiles);
    }
    setIsHovering(false);
  }, [onFilesAccepted]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-3mfdocument': ['.3mf'],
      'application/zip': ['.3mf'] // Fallback since some systems see 3mf as zip
    },
    onDragEnter: () => setIsHovering(true),
    onDragLeave: () => setIsHovering(false),
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div
        {...getRootProps()}
        className={`
          relative overflow-hidden rounded-2xl border-2 border-dashed 
          p-12 text-center transition-all duration-300 ease-out cursor-pointer
          ${isDragActive ? 'border-primary bg-primary/5 glow-cyan' : 'border-white/10 bg-card/40 hover:border-primary/50 hover:bg-card/80'}
          ${isDragReject ? 'border-destructive bg-destructive/5' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <AnimatePresence mode="wait">
          {isDragActive ? (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <div className="rounded-full bg-primary/20 p-4">
                <UploadCloud className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <h3 className="font-display text-2xl font-bold text-primary">Drop to Parse</h3>
              <p className="text-muted-foreground">Release files to begin extraction</p>
            </motion.div>
          ) : (
            <motion.div
              key="inactive"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center space-y-6"
            >
              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-primary/10 blur-2xl transition-all duration-500 group-hover:bg-primary/20" />
                <div className="relative rounded-2xl bg-gradient-to-b from-white/10 to-transparent p-5 shadow-2xl backdrop-blur-xl border border-white/5">
                  <FileType className="h-12 w-12 text-primary/80" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-display text-2xl font-bold text-foreground">
                  Upload 3MF Files
                </h3>
                <p className="text-lg text-muted-foreground">
                  Drag & drop your <span className="font-mono text-primary/80">.3mf</span> slice files here
                </p>
                <p className="text-sm text-muted-foreground/60">
                  Or click to browse your computer
                </p>
              </div>
              
              <div className="flex items-center gap-6 pt-4 text-sm font-medium text-muted-foreground/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary/50" /> Auto-extracts metadata
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary/50" /> Syncs to catalog
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
