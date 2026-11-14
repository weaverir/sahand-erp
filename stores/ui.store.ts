
"use client";

import { create } from "zustand";

interface UIState {
  mobileMenuOpen: boolean;
  sidebarCollapsed: boolean;

  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;

  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  mobileMenuOpen: false,
  sidebarCollapsed: false,

  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  toggleMobileMenu: () =>
    set((state) => ({
      mobileMenuOpen: !state.mobileMenuOpen,
    })),

  closeMobileMenu: () => set({ mobileMenuOpen: false }),

  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),

  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),
}));
