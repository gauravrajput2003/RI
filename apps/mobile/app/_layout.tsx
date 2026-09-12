import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { startRuntime } from '../services/runtime';
import '../global.css';
import { CredentialWarning } from '../components/CredentialWarning';
import { PreviewNotice } from '../components/PreviewNotice';
import { DemoNotice } from '../components/DemoNotice';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnReconnect: false } } });
export default function RootLayout() {
  useEffect(() => {
    const stop = startRuntime(queryClient);
    void useAuthStore.getState().hydrate();
    return stop;
  }, []);
  return <SafeAreaProvider><QueryClientProvider client={queryClient}><DemoNotice /><PreviewNotice /><CredentialWarning /><Stack screenOptions={{ headerShown: false }} /></QueryClientProvider></SafeAreaProvider>;
}
