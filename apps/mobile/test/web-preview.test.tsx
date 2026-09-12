import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import LiveMapWeb from '../features/map/LiveMap.web';
import { createAuthStore } from '../features/auth/session';
import { tokenStorage } from '../services/storage/tokens.web';
import { snapshotStorage } from '../services/cache/storage.web';
import { createMemoryStorage } from '../services/storage/memory';

vi.mock('react-native-maps', () => { throw new Error('Native maps must never load in the web preview'); });
vi.mock('expo-secure-store', () => { throw new Error('Native SecureStore must never load in the web preview'); });
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable' }));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
describe('web platform boundaries', () => {
  it('renders the native-map availability message without importing native maps', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<LiveMapWeb />); });
    expect(JSON.stringify(tree.toJSON())).toContain('Map available on Android and iOS');
    await act(async () => tree.unmount());
  });
  it('supports login/logout with memory-only tokens, separate from web snapshots', async () => {
    const auth = createAuthStore(tokenStorage);
    await auth.getState().hydrate(); expect(auth.getState().storageError).toBe(false);
    await auth.getState().setTokens({ accessToken: 'test-only-access', refreshToken: 'test-only-refresh' });
    expect(await tokenStorage.getItem('fleet.auth.tokens')).toContain('test-only-access');
    expect(await snapshotStorage.getItem('fleet.auth.tokens')).toBeNull();
    expect(await createMemoryStorage().getItem('fleet.auth.tokens')).toBeNull();
    await auth.getState().setTokens(null);
    expect(await tokenStorage.getItem('fleet.auth.tokens')).toBeNull();
  });
});
