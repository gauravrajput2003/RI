import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRuntimeStore } from '../store/runtimeStore';
import { useLiveVehicleStore } from '../store/liveVehicleStore';
import { exactAge } from '../utils/format';
import { config } from '../constants/config';
export function ConnectionBanner() {
  const online = useRuntimeStore(state => state.online);
  const connected = useRuntimeStore(state => state.connected);
  const cacheError = useRuntimeStore(state => state.cacheError);
  const [now, setNow] = useState(Date.now);
  // Reading the snapshot on a clock avoids a whole-banner render on every GPS packet.
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const updates = Object.values(useLiveVehicleStore.getState().updatedAt);
  const latest = updates.length ? Math.max(...updates) : undefined;
  const status = config.demoMode ? 'DEMO — simulated GPS, no backend connection' : online === false ? 'Offline — showing last-known data' : online === null ? 'Checking network' : connected ? 'Connected' : 'Reconnecting — showing last-known data';
  return <View accessibilityLiveRegion="polite" style={{ padding: 8, backgroundColor: connected ? '#dcfce7' : '#fef3c7' }}>
    <Text>{status}. Latest received update: {exactAge(latest, now)}.</Text>
    {cacheError ? <Text>Unable to save offline snapshot on this device.</Text> : null}
  </View>;
}
