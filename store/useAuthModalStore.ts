/**
 * Auth Modal Store
 * Global state for opening the login modal from anywhere (e.g. Add to List when logged out)
 */

import { create } from 'zustand';

interface AuthModalStore {
  isOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

export const useAuthModalStore = create<AuthModalStore>((set) => ({
  isOpen: false,
  openAuthModal: () => set({ isOpen: true }),
  closeAuthModal: () => set({ isOpen: false }),
}));
