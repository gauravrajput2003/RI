import { Redirect, Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import { Loading } from '../../components/StateViews';
import { ConnectionBanner } from '../../components/ConnectionBanner';
export default function AppLayout() {
  const hydrated = useAuthStore(state => state.hydrated);
  const session = useAuthStore(state => state.sessionKey);
  const ready = useRuntimeStore(state => state.readySession);
  if (!hydrated) return <Loading />;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (ready !== session) return <Loading />;
  return <SafeAreaView style={{ flex: 1 }} edges={['top','left','right']}><ConnectionBanner /><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#0f766e' }}>
    <Tabs.Screen name="index" options={{ title: 'Home' }} /><Tabs.Screen name="vehicles" options={{ title: 'Vehicles' }} />
    <Tabs.Screen name="map" options={{ title: 'Map' }} /><Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    <Tabs.Screen name="vehicle/[vehicleId]" options={{ href: null }} />
  </Tabs></SafeAreaView>;
}
