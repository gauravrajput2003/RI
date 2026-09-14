import { Redirect, Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import { Loading } from '../../components/StateViews';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { FleetBottomTabs } from '../../components/fleet/BottomTabs';
import { config } from '../../constants/config';
export default function AppLayout() {
  const hydrated = useAuthStore(state => state.hydrated);
  const session = useAuthStore(state => state.sessionKey);
  const ready = useRuntimeStore(state => state.readySession);
  if (!hydrated) return <Loading />;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (ready !== session) return <Loading />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top','left','right']}>
    {!config.demoMode ? <ConnectionBanner /> : null}
    <Tabs
      initialRouteName="index"
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => {
        const currentRoute = state.routes[state.index].name;
        if (!['reports', 'index', 'profile'].includes(currentRoute)) {
          return null;
        }
        return (
          <FleetBottomTabs
            selected={currentRoute}
            navigate={name => {
              const target = state.routes.find(route => route.name === name);
              if (!target) return;
              const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
              if (!event.defaultPrevented) navigation.navigate(name);
            }}
          />
        );
      }}
    >
      <Tabs.Screen name="reports" options={{ title: 'Report' }} />
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="vehicles" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="map" options={{ href: null }} />
      <Tabs.Screen name="playback" options={{ href: null }} />
      <Tabs.Screen name="vehicle/[vehicleId]" options={{ href: null }} />
    </Tabs>
  </SafeAreaView>;
}
