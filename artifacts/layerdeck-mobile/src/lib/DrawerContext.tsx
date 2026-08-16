import { createContext, useContext, useState, type ReactNode } from 'react';

interface DrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <DrawerContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer must be used within DrawerProvider');
  return ctx;
}
