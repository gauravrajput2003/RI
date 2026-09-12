import * as SecureStore from 'expo-secure-store';
import type { TokenStorage } from '../../features/auth/session';
export const tokenStorage: TokenStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};
