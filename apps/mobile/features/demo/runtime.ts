import { AppState } from 'react-native';
import { focusManager, onlineManager, type QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useLiveVehicleStore } from '../../store/liveVehicleStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import { demoLocations, demoVehicles } from './data';

export function startDemoRuntime(queries: QueryClient) {
  let session: string | null = null;
  let active = AppState.currentState === 'active';
  const clear = () => {
    void queries.cancelQueries(); queries.clear();
    useLiveVehicleStore.getState().clear();
    useVehicleStore.setState({ selectedVehicleId: null, followSelected: true });
    useRuntimeStore.setState({ readySession: null, online: null, connected: false, cacheError: false });
  };
  const reconcile = () => {
    const next = useAuthStore.getState().sessionKey;
    if (next === session) return;
    session = next; clear();
    if (session) {
      queries.setQueryData(['vehicles', 'list'], { pages: [{ success: true, data: demoVehicles }], pageParams: [undefined] });
      for (const [id, point] of Object.entries(demoLocations())) useLiveVehicleStore.getState().upsert(id, point);
      useRuntimeStore.setState({ readySession: session });
    }
  };
  // Local adapter requests can run without internet. This is not network status.
  onlineManager.setOnline(true);
  focusManager.setFocused(active);
  const unsubscribe = useAuthStore.subscribe(reconcile); reconcile();
  const app = AppState.addEventListener('change', state => { active = state === 'active'; focusManager.setFocused(active); });
  return () => { app.remove(); unsubscribe(); clear(); };
}
