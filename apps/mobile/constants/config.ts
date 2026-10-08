// Expo substitutes only direct EXPO_PUBLIC accesses at bundle time.
import { resolveDemoMode } from '../features/demo/mode';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveEndpoints } from './endpoints';

const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : process.env.NODE_ENV !== 'production';
const demoMode = resolveDemoMode(process.env.EXPO_PUBLIC_DEMO_MODE, isDev);

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
const endpoints = resolveEndpoints({
  apiUrl,
  socketUrl,
  webHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : undefined,
  expoHostUri: Constants.expoConfig?.hostUri,
});

if (!demoMode && process.env.NODE_ENV === 'production' && (!apiUrl?.startsWith('https://') || !socketUrl?.startsWith('https://'))) {
  throw new Error('Production requires HTTPS EXPO_PUBLIC_API_URL and EXPO_PUBLIC_SOCKET_URL');
}

export const config = {
  demoMode,
  showDemoNotice: process.env.EXPO_PUBLIC_SHOW_DEMO_NOTICE === 'true',
  ...endpoints,
};
