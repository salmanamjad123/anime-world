/**
 * Auth Modal Store
 * Global state for opening the login modal from anywhere (e.g. Add to List when logged out)
 */

import { create } from 'zustand';

export type AuthModalView = 'login' | 'register' | 'forgot' | 'verify';

interface AuthModalStore {
  isOpen: boolean;
  defaultView: AuthModalView | undefined;
  openAuthModal: (view?: AuthModalView) => void;
  closeAuthModal: () => void;
}

export const useAuthModalStore = create<AuthModalStore>((set) => ({
  isOpen: false,
  defaultView: undefined,
  openAuthModal: (view) => set({ isOpen: true, defaultView: view }),
  closeAuthModal: () => set({ isOpen: false, defaultView: undefined }),
}));
