import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import PlaybackView from '../features/playback/PlaybackView';

const boundary = vi.hoisted(() => ({ fit: vi.fn(), animate: vi.fn(), points: [
  { latitude: 28, longitude: 76, speed: 0, server_received_at: '2026-09-14T00:00:00Z' },
  { latitude: 29, longitude: 77, speed: 0, server_received_at: '2026-09-14T00:10:00Z' },
] }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', Modal: 'Modal', TextInput: 'TextInput', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (s: unknown) => s, absoluteFill: {} } }));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: vi.fn() }), useLocalSearchParams: () => ({ vehicleId: 'demo' }) }));
vi.mock('@expo/vector-icons', () => ({ Feather: 'Icon', MaterialCommunityIcons: 'Icon', Ionicons: 'Icon' }));
vi.mock('../features/vehicles/queries', () => ({ useHistory: () => ({ data: boundary.points, isLoading: false }) }));
vi.mock('react-native-maps', async () => {
  const { forwardRef, useImperativeHandle, createElement } = await import('react');
  return { default: forwardRef((props: Record<string, unknown>, ref) => {
    useImperativeHandle(ref, () => ({ fitToCoordinates: boundary.fit, animateToRegion: boundary.animate }));
    return createElement('MapView', props);
  }), Marker: 'Marker', Polyline: 'Polyline' };
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('fits the route when ready and after history changes, with non-null marker colors', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<PlaybackView />); });
  boundary.fit.mockClear();
  await act(async () => tree.root.findByType('MapView' as React.ElementType).props.onMapReady());
  expect(boundary.fit).toHaveBeenCalledWith([{ latitude: 28, longitude: 76 }, { latitude: 29, longitude: 77 }], expect.any(Object));
  for (const marker of tree.root.findAllByType('Marker' as React.ElementType)) {
    expect(marker.props.pinColor).toMatch(/^#[0-9a-f]{6}$/);
  }
  boundary.points = [{ latitude: 12, longitude: 80, speed: 0, server_received_at: '2026-09-14T01:00:00Z' }];
  await act(async () => tree.update(<PlaybackView />));
  expect(boundary.animate).toHaveBeenCalledWith(expect.objectContaining({ latitude: 12, longitude: 80 }), 250);
  await act(async () => tree.unmount());
});
