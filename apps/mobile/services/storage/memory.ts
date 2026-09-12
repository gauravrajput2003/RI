import type { TokenStorage } from '../../features/auth/session';
// Web preview only: never put JWTs in localStorage, sessionStorage or cookies.
export function createMemoryStorage(): TokenStorage {
  const values = new Map<string, string>();
  return {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); },
  };
}
