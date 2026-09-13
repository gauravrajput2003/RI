import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { startRuntime } from './runtime';
import { useAuthStore } from '../store/authStore';
import { useRuntimeStore } from '../store/runtimeStore';
import { useLiveVehicleStore } from '../store/liveVehicleStore';
import { useVehicleStore } from '../store/vehicleStore';
import { tokenA, tick } from '../test/helpers';

const native = vi.hoisted(() => {
  const secure = new Map<string, string>(); const disk = new Map<string, string>();
  return { secure, disk, network: undefined as undefined | ((state: { isConnected: boolean; isInternetReachable: boolean }) => void),
    app: undefined as undefined | ((state: string) => void), stopNetwork: vi.fn(), stopApp: vi.fn(),
    sockets: [] as { handlers: Map<string, (...args: unknown[]) => void>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] };
});
vi.mock('expo-secure-store', () => ({ getItemAsync: async (key: string) => native.secure.get(key) ?? null, setItemAsync: async (key: string, value: string) => { native.secure.set(key, value); }, deleteItemAsync: async (key: string) => { native.secure.delete(key); } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async (key: string) => native.disk.get(key) ?? null, setItem: async (key: string, value: string) => { native.disk.set(key, value); }, removeItem: async (key: string) => { native.disk.delete(key); } } }));
vi.mock('@react-native-community/netinfo', () => ({ default: { addEventListener: (callback: typeof native.network) => { native.network = callback; return native.stopNetwork; } } }));
vi.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: (_event: string, callback: typeof native.app) => { native.app = callback; return { remove: native.stopApp }; } } }));
vi.mock('socket.io-client', () => ({ io: () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = { handlers, auth: {}, connect: vi.fn(), disconnect: vi.fn(), on: (event: string, callback: (...args: unknown[]) => void) => handlers.set(event, callback), removeAllListeners: () => handlers.clear() };
  native.sockets.push(socket); return socket;
} }));

let stop: (() => void) | undefined;
afterEach(async () => { stop?.(); stop = undefined; await useAuthStore.getState().setTokens(null); native.disk.clear(); native.sockets.length = 0; vi.clearAllMocks(); vi.useRealTimers(); });
describe('actual runtime with mocked device/network/transport boundaries', () => {
  it('refreshes only the authorized fleet on one shared cadence and pauses network reads in background', async () => {
    vi.useFakeTimers({toFake:['Date','setInterval','clearInterval']});
    const createTimer=vi.spyOn(globalThis,'setInterval');
    await useAuthStore.getState().setTokens(tokenA);
    const queries=new QueryClient();const invalidate=vi.spyOn(queries,'invalidateQueries');
    stop=startRuntime(queries);await tick();
    native.network!({isConnected:true,isInternetReachable:true});
    queries.setQueryData(['vehicles','list'],{pages:[{success:true,data:Array.from({length:200},(_,i)=>({id:String(i),vehicle_number:String(i),active:true}))}],pageParams:[undefined]});
    await vi.advanceTimersByTimeAsync(30000);
    expect(createTimer).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({queryKey:['vehicles','list'],refetchType:'active'});
    native.app!('background');await vi.advanceTimersByTimeAsync(30000);
    expect(invalidate).toHaveBeenCalledOnce();
    stop();stop=undefined;createTimer.mockRestore();queries.clear();
  });
  it('hydrates useful offline data, resumes one socket and refetches only active latest-state queries', async () => {
    await useAuthStore.getState().setTokens(tokenA);
    const session = useAuthStore.getState().sessionKey!;
    native.disk.set('fleet.snapshot.v1.' + session, JSON.stringify({ version: 1, savedAt: Date.now(), vehicles: [{ id: 'a', vehicle_number: 'A', active: true }], locations: { a: { latitude: 1, longitude: 2, server_received_at: '2026-09-11T00:00:00Z' } } }));
    const queries = new QueryClient(); const invalidate = vi.spyOn(queries, 'invalidateQueries');
    stop = startRuntime(queries); native.network!({ isConnected: false, isInternetReachable: false }); await tick();
    expect(useRuntimeStore.getState().online).toBe(false); expect(useRuntimeStore.getState().connected).toBe(false);
    expect(useLiveVehicleStore.getState().byVehicleId.a.latitude).toBe(1);
    expect(native.sockets[0].connect).not.toHaveBeenCalled();
    native.network!({ isConnected: true, isInternetReachable: true });
    expect(native.sockets[0].connect).toHaveBeenCalledOnce();
    native.sockets[0].handlers.get('connect')!();
    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['vehicles', 'latest'], refetchType: 'active' });
    native.sockets[0].handlers.get('vehicle:location')!({ vehicleId: 'a', latitude: 3, longitude: 4, serverReceivedAt: '2026-09-11T00:00:01Z' });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(useLiveVehicleStore.getState().byVehicleId.a.latitude).toBe(3);
    native.network!({ isConnected: false, isInternetReachable: false });
    expect(useLiveVehicleStore.getState().byVehicleId.a.latitude).toBe(3);
    useVehicleStore.getState().setSelected('a'); await useAuthStore.getState().setTokens(null); await tick();
    expect(useVehicleStore.getState().selectedVehicleId).toBeNull(); expect(useLiveVehicleStore.getState().byVehicleId).toEqual({});
    expect(queries.getQueryCache().getAll()).toHaveLength(0); expect(native.disk.size).toBe(0);
    expect(native.sockets[0].handlers.size).toBe(0);
  });
  it('saves at the coarse interval/background boundary and releases all subscriptions and timers', async () => {
    const createTimer = vi.spyOn(globalThis, 'setInterval'); const clearTimer = vi.spyOn(globalThis, 'clearInterval');
    await useAuthStore.getState().setTokens(tokenA);
    const session = useAuthStore.getState().sessionKey!; const queries = new QueryClient();
    stop = startRuntime(queries); await tick();
    queries.setQueryData(['vehicles','list'], { pages: [{ success: true, data: [{ id: 'a', vehicle_number: 'A', active: true }] }], pageParams: [undefined] });
    native.app!('background'); await tick();
    expect(native.disk.has('fleet.snapshot.v1.' + session)).toBe(true);
    stop(); stop = undefined;
    expect(native.stopNetwork).toHaveBeenCalledOnce(); expect(native.stopApp).toHaveBeenCalledOnce();
    expect(createTimer).toHaveBeenCalledWith(expect.any(Function), 30000);
    expect(clearTimer).toHaveBeenCalledWith(createTimer.mock.results[0].value);
    createTimer.mockRestore(); clearTimer.mockRestore();
    expect(useRuntimeStore.getState().connected).toBe(false);
  });
});
