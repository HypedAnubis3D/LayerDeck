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
  lightMode: boolean;
  setActiveTab: (tab: TabId) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setLightMode: (v: boolean) => void;
  toggleLightMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: "dashboard",
  sidebarOpen: false,
  lightMode: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setLightMode: (v) => set({ lightMode: v }),
  toggleLightMode: () =>
    set((s) => {
      const next = !s.lightMode;
      if (next) document.body.classList.add("light-mode");
      else document.body.classList.remove("light-mode");
      return { lightMode: next };
    }),
}));
