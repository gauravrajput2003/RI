import { describe, expect, it } from 'vitest';
import { createSnapshotCache, MAX_VEHICLES } from './snapshot';
import { memoryStorage } from '../../test/helpers';
const vehicle = { id: 'a', vehicle_number: 'A', alias: null, vehicle_type: null, odometer: null, active: true };
describe('bounded offline snapshots', () => {
  it('roundtrips useful data, excludes tokens/history/unknown fields, and isolates sessions', async () => {
    const storage = memoryStorage(); const cache = createSnapshotCache(storage, () => 100);
    await cache.save('user-a', [{ ...vehicle, accessToken: 'DO-NOT-SAVE' } as typeof vehicle], { a: {
      server_received_at: '2026-09-11T00:00:00Z', latitude: 1, longitude: 2, refreshToken: 'DO-NOT-SAVE', history: ['DO-NOT-SAVE'],
    } as never });
    expect([...storage.data.values()][0]).not.toContain('DO-NOT-SAVE');
    expect((await cache.load('user-a'))?.locations.a.latitude).toBe(1);
    expect(await cache.load('user-b')).toBeNull();
    await cache.remove('user-a'); expect(await cache.load('user-a')).toBeNull();
  });
  it('ignores corrupt, expired and future-schema data', async () => {
    const storage = memoryStorage(); const cache = createSnapshotCache(storage, () => 100000000);
    for (const value of ['broken', JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, savedAt: 0, vehicles: [] })]) {
      storage.data.set('fleet.snapshot.v1.a', value); expect(await cache.load('a')).toBeNull();
    }
  });
  it('bounds fleet size and serializes removal after pending writes', async () => {
    const storage = memoryStorage(); const cache = createSnapshotCache(storage);
    const save = cache.save('a', Array.from({ length: MAX_VEHICLES + 10 }, (_, index) => ({ ...vehicle, id: String(index) })), {});
    await save; expect((await cache.load('a'))?.vehicles).toHaveLength(MAX_VEHICLES);
    const pending = cache.save('a', [vehicle], {}); const remove = cache.remove('a');
    await Promise.all([pending, remove]); expect(await cache.load('a')).toBeNull();
  });
});
