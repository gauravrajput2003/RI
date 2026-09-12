import { describe, expect, it } from 'vitest';
import { createApiClient } from '../../services/api/create-client';
import { createAuthActions } from '../../services/api/auth-actions';
import { createAuthStore } from '../auth/session';
import { createMemoryStorage } from '../../services/storage/memory';
import { createDemoAdapter } from './adapter';
import { demoCredentials, demoLocations } from './data';
import { resolveDemoMode } from './mode';

describe('explicit development-only demo', () => {
  it('requires opt-in and refuses production activation', () => {
    expect(resolveDemoMode(undefined, true)).toBe(false);
    expect(resolveDemoMode('false', true)).toBe(false);
    expect(resolveDemoMode('true', true)).toBe(true);
    expect(() => resolveDemoMode('true', false)).toThrow('development-only');
  });
  it('accepts requested demo credentials, serves sample data locally and logs out', async () => {
    const auth = createAuthStore(createMemoryStorage());
    const api = createApiClient('https://no-server.invalid', auth, createDemoAdapter());
    const actions = createAuthActions(api, auth);
    await expect(actions.login(demoCredentials.email, 'wrong')).rejects.toThrow();
    expect(auth.getState().tokens).toBeNull();
    await actions.login(demoCredentials.email, demoCredentials.password);
    const vehicles = await api.get('/vehicles');
    expect(vehicles.data.data).toHaveLength(3);
    const latest = await api.get('/vehicles/demo-van/latest-location');
    expect(latest.data.data.state).toBe('MOVING');
    await expect(api.get('/not-implemented')).rejects.toThrow();
    await actions.logout();
    expect(auth.getState().tokens).toBeNull();
  });
  it('changes the simulated moving vehicle without inventing movement for parked vehicles', () => {
    const first = demoLocations(100000); const next = demoLocations(103000);
    expect(first['demo-van'].latitude).not.toBe(next['demo-van'].latitude);
    expect(first['demo-car'].latitude).toBe(next['demo-car'].latitude);
    expect(first['demo-car'].speed).toBe(0);
  });
});
