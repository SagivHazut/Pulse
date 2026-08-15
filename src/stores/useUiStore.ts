import { create } from 'zustand';

import type { ToastMessage } from '../components/ui/Toast';

let toastId = 0;

type UiState = {
  toast: ToastMessage;
  showToast(text: string, tone?: 'info' | 'success' | 'warning'): void;
  dismissToast(): void;
};

/** Transient, non-persisted UI chatter. */
export const useUiStore = create<UiState>((set) => ({
  toast: null,
  showToast(text, tone = 'info') {
    toastId += 1;
    set({ toast: { id: toastId, text, tone } });
  },
  dismissToast() {
    set({ toast: null });
  },
}));

export const showToast = (text: string, tone?: 'info' | 'success' | 'warning') =>
  useUiStore.getState().showToast(text, tone);
