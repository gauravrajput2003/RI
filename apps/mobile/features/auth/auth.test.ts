import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../../services/api/create-client';
import { createAuthActions } from '../../services/api/auth-actions';
import { createAuthStore } from './session';
import { deferred, makeAuth, memoryStorage, response, tick, tokenA, tokenB, unauthorized } from '../../test/helpers';

describe('real auth store and Axios interceptors', () => {
  it('logs in and persists tokens only through the secure-storage adapter', async () => {
    const storage = memoryStorage(); const auth = createAuthStore(storage);
    const client = createApiClient('https://api.test', auth, async request => {
      expect(request.url).toBe('/auth/login');
      expect(request.headers.get('Authorization')).toBeUndefined();
      return response(request, { data: tokenA });
    });
    await createAuthActions(client, auth).login('driver@example.com', 'password');
    expect(auth.getState().tokens).toEqual(tokenA);
    expect(storage.setItem).toHaveBeenCalledOnce();
  });
  it('rejects login failure without refresh or saved credentials', async () => {
    const auth = makeAuth(); const adapter = vi.fn(async request => { throw unauthorized(request); });
    await expect(createAuthActions(createApiClient('https://api.test', auth, adapter), auth).login('bad', 'bad')).rejects.toThrow();
    expect(adapter).toHaveBeenCalledOnce(); expect(auth.getState().tokens).toBeNull();
  });
  it('coalesces simultaneous 401s, retries originals once, and reuses rotated tokens for delayed 401s', async () => {
    const auth = makeAuth(); await auth.getState().setTokens(tokenA);
    const refreshGate = deferred(); const lateGate = deferred();
    const calls: Record<string, number> = {}; let refreshes = 0;
    const client = createApiClient('https://api.test', auth, async request => {
      const url = request.url!;
      if (url === '/auth/refresh') { refreshes++; await refreshGate.promise; return response(request, { data: tokenB }); }
      calls[url] = (calls[url] ?? 0) + 1;
      if (request.headers.get('Authorization') === 'Bearer access-a') {
        if (url === '/late') await lateGate.promise;
        throw unauthorized(request);
      }
      return response(request, { ok: true });
    });
    const a = client.get('/a'); const b = client.get('/b'); const late = client.get('/late');
    await tick(); expect(refreshes).toBe(1);
    refreshGate.resolve(); await Promise.all([a, b]);
    lateGate.resolve(); await late;
    expect(refreshes).toBe(1); expect(calls).toEqual({ '/a': 2, '/b': 2, '/late': 2 });
    expect(auth.getState().tokens).toEqual(tokenB);
  });
  it('logs out on refresh failure', async () => {
    const auth = makeAuth(); await auth.getState().setTokens(tokenA);
    const client = createApiClient('https://api.test', auth, async request => { throw unauthorized(request); });
    await expect(client.get('/vehicles')).rejects.toThrow();
    expect(auth.getState().tokens).toBeNull();
  });
  it('socket-triggered refresh and REST 401s share one refresh operation', async () => {
    const auth = makeAuth(); await auth.getState().setTokens(tokenA);
    const gate = deferred(); let refreshes = 0;
    const client = createApiClient('https://api.test', auth, async request => {
      if (request.url === '/auth/refresh') { refreshes++; await gate.promise; return response(request, { data: tokenB }); }
      if (request.headers.get('Authorization') === 'Bearer access-a') throw unauthorized(request);
      return response(request, {});
    });
    const refresh = client.refreshSession(); const get = client.get('/vehicles');
    await tick(); expect(refreshes).toBe(1); gate.resolve(); await Promise.all([refresh, get]);
    expect(refreshes).toBe(1);
  });
  it('discards a successful response from a previous session', async () => {
    const auth = makeAuth(); await auth.getState().setTokens(tokenA); const gate = deferred();
    const client = createApiClient('https://api.test', auth, async request => { await gate.promise; return response(request, { private: 'old-user' }); });
    const request = client.get('/vehicles').catch(error => error);
    await tick(); await auth.getState().setTokens(tokenB); gate.resolve();
    expect((await request).code).toBe('ERR_CANCELED');
  });
  it('fails closed and exposes a warning when credential removal fails', async () => {
    const storage = memoryStorage(); const auth = createAuthStore(storage); await auth.getState().setTokens(tokenA);
    storage.removeItem.mockRejectedValueOnce(new Error('Device storage unavailable'));
    await expect(auth.getState().setTokens(null)).rejects.toThrow();
    expect(auth.getState().tokens).toBeNull(); expect(auth.getState().storageError).toBe(true);
    await auth.getState().setTokens(null); expect(storage.data.size).toBe(0); expect(auth.getState().storageError).toBe(false);
  });
  it('does not loop if retried request also returns 401', async () => {
    const auth = makeAuth(); await auth.getState().setTokens(tokenA);
    let protectedCalls = 0; let refreshes = 0;
    const client = createApiClient('https://api.test', auth, async request => {
      if (request.url === '/auth/refresh') { refreshes++; return response(request, { data: tokenB }); }
      protectedCalls++; throw unauthorized(request);
    });
    await expect(client.get('/vehicles')).rejects.toThrow();
    expect(protectedCalls).toBe(2); expect(refreshes).toBe(1); expect(auth.getState().tokens).toBeNull();
  });
  it('late refresh cannot restore a logged-out or switched session', async () => {
    const auth = makeAuth(); await auth.getState().setTokens(tokenA);
    const gate = deferred();
    const client = createApiClient('https://api.test', auth, async request => {
      if (request.url === '/auth/refresh') { await gate.promise; return response(request, { data: tokenB }); }
      throw unauthorized(request);
    });
    const pending = client.get('/vehicles').catch(error => error);
    await tick(); await auth.getState().setTokens(null); await auth.getState().setTokens(tokenA);
    const newSession = auth.getState().sessionKey;
    gate.resolve(); await pending;
    expect(auth.getState().sessionKey).toBe(newSession); expect(auth.getState().tokens).toEqual(tokenA);
  });
  it('serializes secure writes so a slow login cannot persist after logout', async () => {
    const storage = memoryStorage(); const gate = deferred();
    storage.setItem.mockImplementationOnce(async (key, value) => { await gate.promise; storage.data.set(key, value); });
    const auth = createAuthStore(storage); const login = auth.getState().setTokens(tokenA);
    const logout = auth.getState().setTokens(null);
    gate.resolve(); await Promise.all([login, logout]);
    expect(storage.data.size).toBe(0); expect(auth.getState().tokens).toBeNull();
  });
  it('late hydration cannot overwrite an explicit logout', async () => {
    const storage = memoryStorage(); const gate = deferred<string | null>();
    storage.getItem.mockImplementationOnce(() => gate.promise);
    const auth = createAuthStore(storage); const hydration = auth.getState().hydrate();
    await auth.getState().setTokens(null);
    gate.resolve(JSON.stringify({ version: 1, sessionKey: 'old', tokens: tokenA })); await hydration;
    expect(auth.getState().tokens).toBeNull();
  });
});
