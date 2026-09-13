import { create } from 'zustand';
import type { Tokens } from '../../types/models';

export interface TokenStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
const KEY = 'fleet.auth.tokens';
function validTokens(value: unknown): value is Tokens {
  return typeof value === 'object' && value !== null && 'accessToken' in value && typeof value.accessToken === 'string' && 'refreshToken' in value && typeof value.refreshToken === 'string';
}

export function createAuthStore(storage: TokenStorage, acceptTokens: (tokens: Tokens) => boolean = () => true) {
  let writes = Promise.resolve();
  const persist = (value: string | null) => {
    const task = writes.catch(() => undefined).then(() => value === null ? storage.removeItem(KEY) : storage.setItem(KEY, value));
    writes = task;
    return task;
  };
  return create<{
    tokens: Tokens | null; sessionKey: string | null; hydrated: boolean; storageError: boolean;
    setTokens(tokens: Tokens | null): Promise<void>;
    replaceTokens(expected: Tokens, next: Tokens): Promise<boolean>;
    hydrate(): Promise<void>;
  }>((set, get) => ({
    tokens: null, sessionKey: null, hydrated: false, storageError: false,
    async setTokens(tokens) {
      if (tokens && !acceptTokens(tokens)) { await get().setTokens(null); throw new Error('Demo sessions are disabled in real mode'); }
      // Cache identity, never an authorization credential. Refresh retains this key.
      const sessionKey = tokens ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` : null;
      set({ tokens, sessionKey, hydrated: true, storageError: false });
      try { await persist(tokens ? JSON.stringify({ version: 1, sessionKey, tokens }) : null); }
      catch (error) { if (get().sessionKey === sessionKey) set({ tokens: null, sessionKey: null, storageError: true }); throw error; }
    },
    async replaceTokens(expected, next) {
      if (get().tokens !== expected) return false;
      if (!acceptTokens(next)) { await get().setTokens(null); throw new Error('Demo sessions are disabled in real mode'); }
      const sessionKey = get().sessionKey;
      set({ tokens: next });
      try { await persist(JSON.stringify({ version: 1, sessionKey, tokens: next })); }
      catch (error) { if (get().sessionKey === sessionKey) set({ tokens: null, sessionKey: null, storageError: true }); throw error; }
      return get().sessionKey === sessionKey;
    },
    async hydrate() {
      if (get().hydrated) return;
      try {
        const raw = await storage.getItem(KEY);
        if (get().hydrated) return;
        const data: unknown = raw ? JSON.parse(raw) : null;
        if (data && typeof data === 'object' && 'version' in data && data.version === 1 && 'tokens' in data && validTokens(data.tokens) && acceptTokens(data.tokens) && 'sessionKey' in data && typeof data.sessionKey === 'string') {
          set({ tokens: data.tokens, sessionKey: data.sessionKey, hydrated: true });
        } else { await get().setTokens(null); }
      } catch { if (!get().hydrated) set({ tokens: null, sessionKey: null, hydrated: true, storageError: true }); }
    },
  }));
}
