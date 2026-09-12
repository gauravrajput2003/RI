// Expo substitutes only direct EXPO_PUBLIC accesses at bundle time.
import { resolveDemoMode } from '../features/demo/mode';

const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : process.env.NODE_ENV !== 'production';
const demoMode = resolveDemoMode(process.env.EXPO_PUBLIC_DEMO_MODE, isDev);

const defaultHost = typeof window !== 'undefined' ? 'http://localhost:3000' : 'http://10.0.2.2:3000';
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;

if (process.env.NODE_ENV === 'production' && (!apiUrl?.startsWith('https://') || !socketUrl?.startsWith('https://'))) {
  throw new Error('Production requires HTTPS EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL');
}

export const config = {
  demoMode,
  apiUrl: apiUrl ?? `${defaultHost}/api/v1`,
  socketUrl: socketUrl ?? defaultHost,
};
