import axios, { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { demoCredentials, demoTokens } from '../../features/demo/data';

const boundary = vi.hoisted(() => ({ demoMode: false, apiUrl: 'https://real-api.invalid/api/v1', socketUrl: 'https://real-api.invalid', disk: new Map<string,string>() }));
vi.mock('../../constants/config', () => ({ config: boundary }));
vi.mock('../storage/tokens', () => ({ tokenStorage: {
  getItem: async (key:string) => boundary.disk.get(key) ?? null,
  setItem: async (key:string,value:string) => { boundary.disk.set(key,value); },
  removeItem: async (key:string) => { boundary.disk.delete(key); },
} }));
vi.mock('../../features/demo/adapter', async importOriginal => {
  const actual = await importOriginal<typeof import('../../features/demo/adapter')>();
  return { createDemoAdapter: vi.fn(actual.createDemoAdapter) };
});
const real = vi.fn();
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); boundary.demoMode=false; boundary.disk.clear(); axios.defaults.adapter=real; });
async function load() {
  const library=await import('axios');library.default.defaults.adapter=real;
  return { ...(await import('./client')), auth:(await import('../../store/authStore')).useAuthStore,
    demo:(await import('../../features/demo/adapter')).createDemoAdapter };
}
describe('application adapter selection', () => {
  it('explicit demo mode uses only the demo adapter', async () => {
    boundary.demoMode=true;
    const {api,auth,demo}=await load();
    const login=await api.post('/auth/login',demoCredentials);await auth.getState().setTokens(login.data.data);
    expect((await api.get('/vehicles')).data.data).toHaveLength(3);
    expect(demo).toHaveBeenCalledOnce();expect(real).not.toHaveBeenCalled();
  });
  it('real mode uses the real adapter and only supplied credentials/data', async () => {
    real.mockImplementation(async config=>({config,status:200,statusText:'OK',headers:{},data:{success:true,data:[]}}));
    const {api,demo}=await load();
    const credentials={email:'real@example.invalid',password:'real-test-password'};
    await api.post('/auth/login',credentials);
    expect(JSON.parse(real.mock.calls[0][0].data)).toEqual(credentials);
    expect((await api.get('/vehicles')).data.data).toEqual([]);
    expect(real).toHaveBeenCalledTimes(2);expect(demo).not.toHaveBeenCalled();
  });
  it('network failure surfaces without constructing or invoking a demo adapter', async () => {
    real.mockImplementation(async config=>{throw new AxiosError('Network unavailable','ERR_NETWORK',config)});
    const {api,demo,auth}=await load();
    await expect(api.get('/vehicles')).rejects.toThrow('Network unavailable');
    expect(real).toHaveBeenCalledOnce();expect(demo).not.toHaveBeenCalled();expect(auth.getState().tokens).toBeNull();
  });
  it('demo credentials receive the real login error, never a locally accepted session', async () => {
    real.mockImplementation(async config=>{throw new AxiosError('Rejected by real API','ERR_BAD_REQUEST',config,undefined,{config,status:401,statusText:'Unauthorized',headers:{},data:{}})});
    const {api,demo,auth}=await load();
    await expect(api.post('/auth/login',demoCredentials)).rejects.toThrow('Rejected by real API');
    expect(real).toHaveBeenCalledOnce();expect(demo).not.toHaveBeenCalled();expect(auth.getState().tokens).toBeNull();
  });
  it('discards legacy demo sessions before real-mode hydration and rejects new demo tokens', async () => {
    boundary.disk.set('fleet.auth.tokens',JSON.stringify({version:1,sessionKey:'old-demo',tokens:demoTokens}));
    const {auth,demo}=await load();await auth.getState().hydrate();
    expect(auth.getState().tokens).toBeNull();expect(boundary.disk.size).toBe(0);
    await expect(auth.getState().setTokens(demoTokens)).rejects.toThrow('Demo sessions are disabled');
    expect(auth.getState().tokens).toBeNull();expect(demo).not.toHaveBeenCalled();expect(real).not.toHaveBeenCalled();
  });
});
