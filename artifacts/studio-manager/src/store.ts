import { create } from "zustand";

export type TabId =
  | "dashboard" | "spools" | "prints" | "tmf" | "queue" | "orders"
  | "shiny" | "revenue" | "customers" | "maint" | "forecast" | "priceengine"
  | "shop" | "history" | "stats" | "backup" | "labels" | "sync"
  | "scheduler" | "batch" | "loyalty" | "reviews" | "mystery"
  | "catalog" | "tax" | "convention" | "printers" | "fildb" | "drying"
  | "power" | "nozzle" | "waste" | "purchases" | "shipping" | "restock"
  | "fulfillment" | "failrate";

export interface AppState {
  activeTab: TabId;
  sidebarOpen: boolean;
  setActiveTab: (tab: TabId) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: "dashboard",
  sidebarOpen: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
