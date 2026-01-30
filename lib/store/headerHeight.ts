import { create } from 'zustand';

interface HeaderHeightState {
  // Safe area calculée une seule fois au démarrage
  safeAreaTop: number;
  safeAreaBottom: number;
  isSafeAreaInitialized: boolean;
  
  // Hauteurs des headers (sans safe area)
  pageHeaderHeight: number;
  publicProfileHeaderHeight: number;
  
  // Hauteurs totales (safe area + header) - calculées automatiquement
  pageHeaderTotalHeight: number;
  publicProfileHeaderTotalHeight: number;
  
  // Actions
  initializeSafeArea: (top: number, bottom: number) => void;
  setPageHeaderHeight: (height: number) => void;
  setPublicProfileHeaderHeight: (height: number) => void;
}

export const useHeaderHeightStore = create<HeaderHeightState>((set, get) => ({
  // Safe area - valeurs par défaut
  safeAreaTop: 50,
  safeAreaBottom: 0,
  isSafeAreaInitialized: false,
  
  // Hauteurs des headers (sans safe area)
  pageHeaderHeight: 60,
  publicProfileHeaderHeight: 450,
  
  // Hauteurs totales - calculées automatiquement
  pageHeaderTotalHeight: 110, // Valeur par défaut, sera mise à jour automatiquement
  publicProfileHeaderTotalHeight: 500, // Valeur par défaut, sera mise à jour automatiquement
  
  // Initialiser la safe area une seule fois
  initializeSafeArea: (top: number, bottom: number) => {
    const state = get();
    if (state.isSafeAreaInitialized) return; // Ne pas réinitialiser
    
    set({
      safeAreaTop: top,
      safeAreaBottom: bottom,
      isSafeAreaInitialized: true,
      // Recalculer les hauteurs totales avec les valeurs actuelles
      pageHeaderTotalHeight: top + state.pageHeaderHeight,
      publicProfileHeaderTotalHeight: top + state.publicProfileHeaderHeight,
    });
  },
  
  // Mettre à jour la hauteur du header (sans safe area)
  setPageHeaderHeight: (height: number) => {
    const state = get();
    set({
      pageHeaderHeight: height,
      pageHeaderTotalHeight: state.safeAreaTop + height,
    });
  },
  
  // Mettre à jour la hauteur du header public profile (sans safe area)
  setPublicProfileHeaderHeight: (height: number) => {
    const state = get();
    set({
      publicProfileHeaderHeight: height,
      publicProfileHeaderTotalHeight: state.safeAreaTop + height,
    });
  },
}));
