import { create } from 'zustand';
import type { Location } from '../types/models';

export function createLiveVehicleStore() {
  return create<{
    byVehicleId: Record<string, Location>; updatedAt: Record<string, number>;
    upsert(id: string, location: Location): void; clear(): void;
  }>(set => ({
    byVehicleId: {}, updatedAt: {},
    upsert: (id, location) => set(state => {
      const previous = state.byVehicleId[id];
      const received = Date.parse(location.server_received_at);
      if (!Number.isFinite(received) || (previous && received < Date.parse(previous.server_received_at))) return state;
      // Partial/status packets must not erase the last usable position and metrics.
      const present = Object.fromEntries(Object.entries(location).filter(([key, value]) => value !== null && value !== undefined
        && !(location.gps_valid === false && ['latitude','longitude','tracker_timestamp',...(location.address_source?[]:['address','address_attribution'])].includes(key))));
      const next = { ...previous, ...present } as Location;
      if (previous && previous.address_source !== 'cell' && previous.address_source !== 'unavailable' && location.gps_valid !== false && !location.address && ((location.latitude != null && location.latitude !== previous.latitude)
        || (location.longitude != null && location.longitude !== previous.longitude))) {
        next.address = null; next.address_attribution = null;
      }
      if (previous && Object.keys(next).every(key => previous[key as keyof Location] === next[key as keyof Location])) return state;
      return { byVehicleId: { ...state.byVehicleId, [id]: next }, updatedAt: { ...state.updatedAt, [id]: received } };
    }),
    clear: () => set({ byVehicleId: {}, updatedAt: {} }),
  }));
}
export const useLiveVehicleStore = createLiveVehicleStore();
