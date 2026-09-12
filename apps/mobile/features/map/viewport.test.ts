import { describe, expect, it } from 'vitest';
import { followRegion, visibleIds } from './viewport';
import { useVehicleStore } from '../../store/vehicleStore';
import type { Location } from '../../types/models';
const point = (latitude: number, longitude: number) => ({ latitude, longitude, server_received_at: '2026-09-11T00:00:00Z' } as Location);
describe('map follow and viewport', () => {
  it('selection enables follow, realtime coordinates follow, manual pan can disable and re-enable it', () => {
    const store = useVehicleStore.getState(); store.setSelected('a');
    expect(useVehicleStore.getState().selectedVehicleId).toBe('a');
    expect(followRegion(point(1, 2), useVehicleStore.getState().followSelected)?.latitude).toBe(1);
    expect(followRegion(point(3, 4), true)?.latitude).toBe(3);
    store.setFollow(false); expect(followRegion(point(4, 5), useVehicleStore.getState().followSelected)).toBeNull();
    store.setFollow(true); expect(followRegion(point(4, 5), useVehicleStore.getState().followSelected)?.latitude).toBe(4);
  });
  it('retains selected marker outside viewport and handles the antimeridian', () => {
    const region = { latitude: 0, longitude: 179, latitudeDelta: 10, longitudeDelta: 10 };
    expect(visibleIds({ a: point(0, -179), b: point(40, 30), c: point(50, 50) }, region, 'b')).toEqual(['a', 'b']);
  });
  it('does not impose a fixed 500 marker cap', () => {
    const points = Object.fromEntries(Array.from({ length: 800 }, (_, index) => [String(index), point(1, 1)]));
    expect(visibleIds(points, { latitude: 1, longitude: 1, latitudeDelta: 1, longitudeDelta: 1 }, null)).toHaveLength(800);
  });
});
