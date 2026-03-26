import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogOut, Layers, Box } from 'lucide-react';
import { motion } from 'framer-motion';

export function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 w-full border-b border-white/5 bg-card/80 backdrop-blur-md"
    >
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-2 font-display text-lg font-bold tracking-widest text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          LAYER<span className="text-primary">STACK</span>
        </div>
        
        <div className="ml-4 flex items-center gap-2 rounded-full border border-white/5 bg-background/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Box className="h-3 w-3 text-accent" />
          Companion
        </div>
        
        <div className="ml-auto flex items-center space-x-4">
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">
                {user.email}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={signOut}
                className="h-8 border-white/10 bg-background/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
