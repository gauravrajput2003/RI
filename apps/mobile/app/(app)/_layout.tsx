import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { Redirect, Tabs, router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import { Loading } from '../../components/StateViews';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { FleetBottomTabs } from '../../components/fleet/BottomTabs';
import { config } from '../../constants/config';
export default function AppLayout() {
  const pathname = usePathname();
  const hydrated = useAuthStore(state => state.hydrated);
  const session = useAuthStore(state => state.sessionKey);
  const ready = useRuntimeStore(state => state.readySession);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pathname === '/' || pathname === '/index') return false;
      if(pathname==='/announcement-center'){router.replace('/(app)');return true;}
      if(['/change-password','/coins','/announcements'].includes(pathname)){router.replace('/(app)/profile');return true;}
      if(['/add-vehicle','/edit-vehicle','/notifications'].includes(pathname)){router.replace('/(app)/vehicles');return true;}
      if(router.canGoBack())router.back();else router.replace('/(app)');
      return true;
    });
    return () => subscription.remove();
  }, [pathname]);
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
        if (!['reports', 'index', 'profile', 'change-password'].includes(currentRoute)) {
          return null;
        }
        return (
          <FleetBottomTabs
            selected={currentRoute==='change-password'?'profile':currentRoute}
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
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="reports" options={{ title: 'Report' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="vehicles" options={{ href: null }} />
      <Tabs.Screen name="subscription" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="map" options={{ href: null }} />
      <Tabs.Screen name="playback" options={{ href: null }} />
      <Tabs.Screen name="vehicle/[vehicleId]" options={{ href: null }} />
      <Tabs.Screen name="add-vehicle" options={{ href: null }} />
      <Tabs.Screen name="edit-vehicle" options={{ href: null }} />
      <Tabs.Screen name="announcements" options={{ href: null }} />
      <Tabs.Screen name="announcement-center" options={{ href: null }} />
      <Tabs.Screen name="contact" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="coins" options={{ href: null }} />
      <Tabs.Screen name="change-password" options={{ href: null }} />
    </Tabs>
  </SafeAreaView>;
}
