import { createAuthStore } from '../features/auth/session';
import { tokenStorage } from '../services/storage/tokens';
import { config } from '../constants/config';
import { createMemoryStorage } from '../services/storage/memory';
// Never persist demo credentials into a real user's SecureStore session.
export const useAuthStore = createAuthStore(config.demoMode ? createMemoryStorage() : tokenStorage);
