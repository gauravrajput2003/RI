import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createSocketLifecycle } from './lifecycle';
import { bindSessionLifecycle } from '../session/lifecycle';
import { createLiveVehicleStore } from '../../store/liveVehicleStore';
import { normalizeLocation } from '../../features/vehicles/normalize';
import { createApiClient } from '../api/create-client';
import { createAuthActions } from '../api/auth-actions';
import { createSnapshotCache } from '../cache/snapshot';
import { makeAuth, memoryStorage, response, tick, tokenA, tokenB } from '../../test/helpers';
function harness() {
  const live = createLiveVehicleStore();
  const sockets: ReturnType<typeof makeSocket>[] = [];
  function makeSocket() {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    return { auth: {}, handlers, on: vi.fn((event: string, handler: (...args: unknown[]) => void) => { handlers.set(event, handler); }),
      removeAllListeners: vi.fn(() => handlers.clear()), connect: vi.fn(), disconnect: vi.fn() };
  }
  const receive = (value: unknown) => { const point = normalizeLocation(value); if (point?.vehicle_id) live.getState().upsert(point.vehicle_id, point); };
  const connected = vi.fn(); const connection = vi.fn();
  const manager = createSocketLifecycle(() => { const socket = makeSocket(); sockets.push(socket); return socket; }, { location: receive, status: receive, connected, connection });
  return { manager, sockets, live, connected };
}
const payload = (vehicleId: string, speed = 10) => ({ vehicleId, latitude: 10, longitude: 20, serverReceivedAt: '2026-09-11T00:00:00Z', speed });
describe('socket lifecycle', () => {
  it('connects once after auth/network; duplicate setup adds no listeners', () => {
    const h = harness(); h.manager.setNetwork(true); h.manager.setSession('a', 'token');
    h.manager.setSession('a', 'token'); h.manager.setNetwork(true);
    expect(h.sockets).toHaveLength(1); expect(h.sockets[0].connect).toHaveBeenCalledOnce();
    expect(h.sockets[0].on).toHaveBeenCalledTimes(5);
  });
  it('location/status updates affect only their vehicle and reject stale packets', () => {
    const h = harness(); h.manager.setSession('a', 'token');
    const handlers = h.sockets[0].handlers;
    handlers.get('vehicle:location')!(payload('a')); handlers.get('vehicle:location')!(payload('b'));
    const other = h.live.getState().byVehicleId.b;
    handlers.get('vehicle:status')!({ vehicleId: 'a', state: 'STOPPED', serverReceivedAt: '2026-09-11T00:00:01Z' });
    expect(h.live.getState().byVehicleId.a.state).toBe('STOPPED');
    expect(h.live.getState().byVehicleId.a.latitude).toBe(10); expect(h.live.getState().byVehicleId.b).toBe(other);
    handlers.get('vehicle:location')!(payload('a', 90)); expect(h.live.getState().byVehicleId.a.speed).toBe(10);
  });
  it('offline/background disconnect, preserve last-known state and resume without new listeners', () => {
    const h = harness(); h.manager.setNetwork(true); h.manager.setSession('a', 'token');
    h.sockets[0].handlers.get('vehicle:location')!(payload('a'));
    h.manager.setNetwork(false); h.manager.setActive(false); h.manager.setNetwork(true);
    expect(h.sockets[0].connect).toHaveBeenCalledTimes(1);
    h.manager.setActive(true); expect(h.sockets[0].connect).toHaveBeenCalledTimes(2);
    h.sockets[0].handlers.get('connect')!(); expect(h.connected).toHaveBeenCalledOnce();
    expect(h.live.getState().byVehicleId.a).toBeDefined(); expect(h.sockets[0].on).toHaveBeenCalledTimes(5);
  });
  it('token rotation disconnects old socket and stale callbacks cannot modify state', () => {
    const h = harness(); h.manager.setNetwork(true); h.manager.setSession('a', 'old');
    const oldCallback = h.sockets[0].handlers.get('vehicle:location')!;
    h.manager.setSession('a', 'new'); oldCallback(payload('old-user'));
    expect(h.sockets[0].handlers.size).toBe(0); expect(h.sockets[0].disconnect).toHaveBeenCalledOnce();
    expect(h.live.getState().byVehicleId['old-user']).toBeUndefined();
    h.manager.stop(); expect(h.sockets[1].handlers.size).toBe(0);
  });
  it('real logout and account switching clear socket, live state, queries and persisted snapshot', async () => {
    const h = harness(); const auth = makeAuth(); const client = createApiClient('https://api.test', auth, async request => response(request, {}));
    const queries = new QueryClient(); const cache = createSnapshotCache(memoryStorage()); const removed = vi.fn(cache.remove);
    const stop = bindSessionLifecycle(auth, {
      transport: h.manager.setSession, clear: () => { queries.clear(); h.live.getState().clear(); },
      load: async () => undefined, remove: removed, ready: vi.fn(),
    });
    h.manager.setNetwork(true);
    await auth.getState().setTokens(tokenA); await tick();
    const first = auth.getState().sessionKey!;
    h.sockets[0].handlers.get('vehicle:location')!(payload('a')); queries.setQueryData(['private'], ['a']);
    await createAuthActions(client, auth).logout(); await tick();
    expect(auth.getState().tokens).toBeNull(); expect(h.sockets[0].handlers.size).toBe(0);
    expect(h.live.getState().byVehicleId).toEqual({}); expect(queries.getQueryData(['private'])).toBeUndefined();
    expect(removed).toHaveBeenCalledWith(first);
    await auth.getState().setTokens(tokenA); await tick();
    h.sockets[1].handlers.get('vehicle:location')!(payload('a'));
    await auth.getState().setTokens(tokenB); await tick();
    expect(h.live.getState().byVehicleId).toEqual({}); expect(h.sockets[1].handlers.size).toBe(0);
    stop(); expect(h.sockets[2].handlers.size).toBe(0);
  });
});
