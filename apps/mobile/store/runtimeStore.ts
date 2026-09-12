import { create } from 'zustand';
export const useRuntimeStore = create<{ online: boolean | null; connected: boolean; readySession: string | null; cacheError: boolean }>(() => ({
  online: null, connected: false, readySession: null, cacheError: false,
}));
