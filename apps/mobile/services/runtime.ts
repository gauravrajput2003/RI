import { snapshotStorage } from './cache/storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { focusManager, onlineManager, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { config } from '../constants/config';
import { api } from './api/client';
import { useAuthStore } from '../store/authStore';
import { useLiveVehicleStore } from '../store/liveVehicleStore';
import { useVehicleStore } from '../store/vehicleStore';
import { useRuntimeStore } from '../store/runtimeStore';
import { normalizeLocation } from '../features/vehicles/normalize';
import { vehicleKeys } from '../features/vehicles/queries';
import type { ApiEnvelope, Vehicle } from '../types/models';
import { createSnapshotCache } from './cache/snapshot';
import { createSocketLifecycle, type SocketPort } from './socket/lifecycle';
import { bindSessionLifecycle } from './session/lifecycle';
import { startDemoRuntime } from '../features/demo/runtime';

export function startRuntime(queryClient: QueryClient) {
  if (config.demoMode) return startDemoRuntime(queryClient);
  const cache = createSnapshotCache(snapshotStorage);
  let disposed = false;
  let appActive = AppState.currentState === 'active';
  let savedPages: unknown;
  let savedLive: unknown;
  const receive = (payload: unknown) => {
    const location = normalizeLocation(payload);
    if (location?.vehicle_id) useLiveVehicleStore.getState().upsert(location.vehicle_id, location);
  };
  const realtime = createSocketLifecycle(token => {
    return io(config.socketUrl, {
      auth: { token }, autoConnect: false, transports: ['websocket'], reconnection: true,
      reconnectionDelay: 1000, reconnectionDelayMax: 10000, randomizationFactor: 0.3,
    }) as unknown as SocketPort;
  }, {
    location: receive, status: receive,
    connection: connected => useRuntimeStore.setState({ connected }),
    unauthorized: () => { void api.refreshSession().catch(() => undefined); },
    connected: () => {
      // Only mounted latest-state queries; never invalidate/refetch the fleet per GPS event.
      void queryClient.invalidateQueries({ queryKey: ['vehicles','latest'], refetchType: 'active' });
    },
  });
  const stopSession = bindSessionLifecycle(useAuthStore, {
    transport: realtime.setSession,
    ready: readySession => useRuntimeStore.setState({ readySession }),
    clear: () => {
      void queryClient.cancelQueries(); queryClient.clear();
      useLiveVehicleStore.getState().clear();
      useVehicleStore.setState({ selectedVehicleId: null, followSelected: true });
      useRuntimeStore.setState({ cacheError: false });
      savedPages = undefined; savedLive = undefined;
    },
    remove: session => cache.remove(session),
    load: async session => {
      const snapshot = await cache.load(session);
      if (disposed || useAuthStore.getState().sessionKey !== session || !snapshot) return;
      queryClient.setQueryData(vehicleKeys.list, {
        pages: [{ success: true, data: snapshot.vehicles }], pageParams: [undefined],
      }, { updatedAt: 0 });
      for (const [id, location] of Object.entries(snapshot.locations)) useLiveVehicleStore.getState().upsert(id, location);
      savedPages = queryClient.getQueryData(vehicleKeys.list);
      savedLive = useLiveVehicleStore.getState().byVehicleId;
    },
  });
  onlineManager.setOnline(false);
  realtime.setActive(AppState.currentState === 'active');
  focusManager.setFocused(AppState.currentState === 'active');
  const stopNetwork = NetInfo.addEventListener(state => {
    const online = state.isConnected === null ? null : state.isConnected && state.isInternetReachable !== false;
    useRuntimeStore.setState({ online });
    onlineManager.setOnline(online === true);
    realtime.setNetwork(online === true);
  });
  const save = () => {
    const session = useAuthStore.getState().sessionKey;
    if (!session || useRuntimeStore.getState().readySession !== session) return;
    const pages = queryClient.getQueryData<InfiniteData<ApiEnvelope<Vehicle[]>>>(vehicleKeys.list);
    if (!pages) return;
    const live = useLiveVehicleStore.getState().byVehicleId;
    if (pages === savedPages && live === savedLive) return;
    savedPages = pages; savedLive = live;
    void cache.save(session, pages.pages.flatMap(page => page.data), live)
      .then(() => { if (useAuthStore.getState().sessionKey === session) useRuntimeStore.setState({ cacheError: false }); })
      .catch(() => { if (useAuthStore.getState().sessionKey === session) { savedPages = undefined; savedLive = undefined; useRuntimeStore.setState({ cacheError: true }); } });
  };
  const refreshActivity = () => {
    if (appActive && useRuntimeStore.getState().online === true && useAuthStore.getState().sessionKey) {
      // One shared fleet refresh also observes heartbeats that have no GPS event.
      void queryClient.invalidateQueries({ queryKey: vehicleKeys.list, refetchType: 'active' });
    }
  };
  const app = AppState.addEventListener('change', state => {
    const active = state === 'active';
    appActive = active;
    focusManager.setFocused(active); realtime.setActive(active);
    if (!active) save();
    else refreshActivity();
  });
  const interval = setInterval(() => { refreshActivity(); save(); }, 30000);
  return () => { save(); disposed = true; clearInterval(interval); stopNetwork(); app.remove(); stopSession(); };
}
