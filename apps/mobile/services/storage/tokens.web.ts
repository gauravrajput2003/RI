import { createMemoryStorage } from './memory';
// SecureStore has no web implementation. Reloading the preview signs out.
export const tokenStorage = createMemoryStorage();
