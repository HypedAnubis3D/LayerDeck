import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  delay?: number;
  accentColor?: 'primary' | 'accent' | 'destructive' | 'muted';
}

export function StatCard({ title, value, icon: Icon, delay = 0, accentColor = 'primary' }: StatCardProps) {
  const colorMap = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    accent: 'text-accent bg-accent/10 border-accent/20',
    destructive: 'text-destructive bg-destructive/10 border-destructive/20',
    muted: 'text-muted-foreground bg-muted/30 border-white/5'
  };

  const iconClass = colorMap[accentColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <Card className="group relative overflow-hidden border-white/5 bg-card/50 hover:bg-card/80 hover:border-white/10 transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
              <p className="font-display text-3xl font-bold text-foreground tracking-tight">
                {value}
              </p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${iconClass} transition-colors duration-300`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
