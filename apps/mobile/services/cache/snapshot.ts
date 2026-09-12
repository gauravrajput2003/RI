import { normalizeLocation, normalizeVehicles } from '../../features/vehicles/normalize';
import type { Location, Vehicle } from '../../types/models';

export interface Snapshot { version: 1; savedAt: number; vehicles: Vehicle[]; locations: Record<string, Location> }
export interface SnapshotStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> }
export const MAX_VEHICLES = 2000;
const MAX_BYTES = 2_000_000;
const MAX_AGE = 24 * 60 * 60 * 1000;
export function createSnapshotCache(storage: SnapshotStorage, now = Date.now) {
  let queue = Promise.resolve();
  const key = (session: string) => 'fleet.snapshot.v1.' + session;
  const enqueue = (work: () => Promise<void>) => {
    const result = queue.catch(() => undefined).then(work); queue = result; return result;
  };
  return {
    async load(session: string): Promise<Snapshot | null> {
      await queue.catch(() => undefined);
      try {
        const raw = await storage.getItem(key(session));
        if (!raw || raw.length * 2 > MAX_BYTES) return null;
        const data = JSON.parse(raw) as Snapshot;
        if (data.version !== 1 || !Number.isFinite(data.savedAt) || data.savedAt > now() || now() - data.savedAt > MAX_AGE || !Array.isArray(data.vehicles) || data.vehicles.length > MAX_VEHICLES) return null;
        const vehicles = normalizeVehicles(data.vehicles);
        const locations: Record<string, Location> = {};
        for (const vehicle of vehicles) {
          const location = normalizeLocation(data.locations?.[vehicle.id]);
          if (location) locations[vehicle.id] = location;
        }
        return { version: 1, savedAt: data.savedAt, vehicles, locations };
      } catch { return null; }
    },
    save(session: string, vehicles: Vehicle[], live: Record<string, Location>) {
      // Whitelist both schemas; unknown fields, credentials and history never reach storage.
      const safeVehicles = normalizeVehicles(vehicles.slice(0, MAX_VEHICLES));
      const locations: Record<string, Location> = {};
      for (const vehicle of safeVehicles) {
        const location = normalizeLocation(live[vehicle.id]);
        if (location) locations[vehicle.id] = location;
      }
      const serialized = JSON.stringify({ version: 1, savedAt: now(), vehicles: safeVehicles, locations });
      if (serialized.length * 2 > MAX_BYTES) return Promise.resolve();
      return enqueue(() => storage.setItem(key(session), serialized));
    },
    remove(session: string) { return enqueue(() => storage.removeItem(key(session))); },
  };
}
