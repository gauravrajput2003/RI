import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveVehicleStore } from '../store/liveVehicleStore';
import { useVehicleStore } from '../store/vehicleStore';
import { LiveVehicleRow } from '../components/LiveVehicleRow';
import LiveMap from '../app/(app)/map';
import type { Location } from '../types/models';

const boundary = vi.hoisted(() => ({ animate: vi.fn(), renders: new Map<string, number>(), vehicles: [
  { id: 'a', vehicle_number: 'A', alias: null, vehicle_type: null, odometer: null, active: true },
  { id: 'b', vehicle_number: 'B', alias: null, vehicle_type: null, odometer: null, active: true },
] }));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('../features/vehicles/queries', () => ({ useVehicles: () => ({ data: { data: boundary.vehicles } }), useLatestLocation: vi.fn() }));
vi.mock('../components/VehicleCard', () => ({ VehicleCard: ({ vehicle }: { vehicle: { id: string } }) => {
  boundary.renders.set(vehicle.id, (boundary.renders.get(vehicle.id) ?? 0) + 1); return null;
} }));
vi.mock('react-native-maps', async () => {
  const { forwardRef, useImperativeHandle, createElement } = await import('react');
  return { default: forwardRef((props: Record<string, unknown>, ref) => {
    useImperativeHandle(ref, () => ({ animateToRegion: boundary.animate }));
    return createElement('MapView', props);
  }), Marker: 'Marker' };
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const point = (latitude: number, longitude: number, second = 0): Location => ({ latitude, longitude, server_received_at: `2026-09-11T00:00:0${second}Z` });
describe('rendered mobile integration (native UI boundaries only mocked)', () => {
  beforeEach(() => { useLiveVehicleStore.getState().clear(); useVehicleStore.setState({ selectedVehicleId: null, followSelected: true }); boundary.renders.clear(); boundary.animate.mockClear(); });
  it('one GPS update does not rerender another vehicle row', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<>{boundary.vehicles.map(vehicle => <LiveVehicleRow key={vehicle.id} vehicle={vehicle} />)}</>); });
    expect(boundary.renders.get('a')).toBe(1); expect(boundary.renders.get('b')).toBe(1);
    await act(async () => { useLiveVehicleStore.getState().upsert('a', point(1, 2)); });
    expect(boundary.renders.get('a')).toBe(2); expect(boundary.renders.get('b')).toBe(1);
    await act(async () => tree.unmount());
  });
  it('marker selection, automatic updates, manual pan and re-enable use the real map handlers', async () => {
    useLiveVehicleStore.getState().upsert('a', point(1, 2));
    useLiveVehicleStore.getState().upsert('b', point(20, 30));
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<LiveMap />); });
    const map = tree.root.findByType('MapView' as React.ElementType);
    await act(async () => tree.root.findAllByType('Marker' as React.ElementType)[0].props.onPress());
    expect(useVehicleStore.getState().selectedVehicleId).toBe('a'); expect(boundary.animate).toHaveBeenCalledOnce();
    await act(async () => map.props.onRegionChangeComplete({ latitude: 1, longitude: 2, latitudeDelta: .1, longitudeDelta: .1 }));
    expect(useVehicleStore.getState().followSelected).toBe(true);
    await act(async () => useLiveVehicleStore.getState().upsert('a', point(2, 3, 1)));
    expect(boundary.animate).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType('Marker' as React.ElementType)[0].props.coordinate).toEqual({ latitude: 2, longitude: 3 });
    await act(async () => map.props.onPanDrag());
    await act(async () => useLiveVehicleStore.getState().upsert('a', point(3, 4, 2)));
    expect(boundary.animate).toHaveBeenCalledTimes(2);
    await act(async () => tree.root.findByType('Pressable' as React.ElementType).props.onPress());
    expect(boundary.animate).toHaveBeenCalledTimes(3);
    expect(tree.root.findByType('MapView' as React.ElementType)).toBe(map);
    await act(async () => tree.unmount());
  });
});
