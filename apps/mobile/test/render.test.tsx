import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveVehicleStore } from '../store/liveVehicleStore';
import { useVehicleStore } from '../store/vehicleStore';
import { LiveVehicleRow } from '../components/LiveVehicleRow';
import LiveMap from '../app/(app)/map';
import type { Location } from '../types/models';

const boundary = vi.hoisted(() => ({ animate: vi.fn(), directions:vi.fn(), renders: new Map<string, number>(), vehicles: [
  { id: 'a', vehicle_number: 'A', alias: null, vehicle_type: null, odometer: null, active: true },
  { id: 'b', vehicle_number: 'B', alias: null, vehicle_type: null, odometer: null, active: true },
] }));
vi.mock('../components/fleet/NearbySheet',()=>({NearbySheet:(props:Record<string,unknown>)=>React.createElement('Nearby',props)}));
vi.mock('../components/fleet/StreetViewSheet',()=>({StreetViewSheet:(props:Record<string,unknown>)=>React.createElement('StreetView',props)}));
vi.mock('../features/map/navigation',async importOriginal=>({...await importOriginal<Record<string,unknown>>(),openVehicleDirections:boundary.directions}));
vi.mock('../features/map/live-data',()=>({useLiveMapData:()=>({})}));
vi.mock('../services/api/mobile',()=>({useAccount:()=>({data:{role:'CLIENT',permissions:[]}}),mobileMessage:(e:Error)=>e.message}));
vi.mock('../components/fleet/ShareSheet',()=>({ShareSheet:()=>null}));
vi.mock('../components/fleet/BottomTabs',()=>({ReportDots:()=>null}));
vi.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
vi.mock('@expo/vector-icons',()=>({Feather:'Icon',MaterialCommunityIcons:'Icon'}));
vi.mock('react-native', () => ({Switch:'Switch',ScrollView:'ScrollView', View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock('expo-router', async () => {const React=await import('react');return {router:{push:vi.fn(),replace:vi.fn()},useFocusEffect:(callback:()=>void)=>React.useEffect(callback,[callback])};});
vi.mock('react-native-svg',()=>({SvgXml:'SvgXml'}));
vi.mock('../features/vehicles/queries', () => ({ useVehicles: () => ({ data: { data: boundary.vehicles } }), useLatestLocation:()=>({dataUpdatedAt:0}) }));
vi.mock('../components/VehicleCard', () => ({ VehicleCard: ({ vehicle }: { vehicle: { id: string } }) => {
  boundary.renders.set(vehicle.id, (boundary.renders.get(vehicle.id) ?? 0) + 1); return null;
} }));
vi.mock('../features/map/LeafletMap', async () => {
  const { forwardRef, useImperativeHandle, createElement } = await import('react');
  return { default: forwardRef((props: Record<string, unknown>, ref) => {
    useImperativeHandle(ref, () => ({ animateToRegion: boundary.animate }));
    return createElement('MapView', props);
  }), Marker: 'Marker',Polyline:'Polyline' };
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
    for(const label of ['Today Km','Total Km','Today Running','Today Idle','Today Stop','Avg Speed','Max Speed','From Last Stop','Play Back','Share','Notification'])expect(JSON.stringify(tree.toJSON())).toContain(label);
    expect(tree.root.findAllByType('ScrollView' as React.ElementType)).toHaveLength(0);
    await act(async()=>tree.root.findByProps({accessibilityLabel:'Navigate to selected vehicle in Google Maps'}).props.onPress());
    expect(boundary.directions).toHaveBeenLastCalledWith(expect.objectContaining({latitude:1,longitude:2}));
    boundary.animate.mockClear();
    await act(async()=>tree.root.findByProps({accessibilityLabel:'Recenter selected vehicle'}).props.onPress());
    expect(tree.root.findAllByType('Marker' as React.ElementType)[0].props.pinColor).toBe('#3b82f6');
    await act(async () => tree.root.findAllByType('Marker' as React.ElementType)[0].props.onPress());
    expect(tree.root.findAllByType('Marker' as React.ElementType)[0].props.pinColor).toBe('#3b82f6');
    expect(tree.root.findAllByType('Marker' as React.ElementType)[0].props.zIndexOffset).toBe(1000);
    expect(useVehicleStore.getState().selectedVehicleId).toBe('a'); expect(boundary.animate).toHaveBeenCalledOnce();
    await act(async()=>tree.root.findByProps({accessibilityLabel:'Live Map settings'}).props.onPress());
    await act(async()=>tree.root.findByProps({accessibilityLabel:'Selected vehicle Nearby'}).props.onPress());
    expect(tree.root.findByType('Nearby' as React.ElementType).props.vehicle.id).toBe('a');
    await act(async()=>tree.root.findByType('Nearby' as React.ElementType).props.onClose());
    await act(async()=>tree.root.findByProps({accessibilityLabel:'Live Map settings'}).props.onPress());
    await act(async()=>tree.root.findByProps({accessibilityLabel:'Selected vehicle Street View'}).props.onPress());
    expect(tree.root.findByType('StreetView' as React.ElementType).props.vehicle.id).toBe('a');
    await act(async()=>tree.root.findByType('StreetView' as React.ElementType).props.onClose());
    expect(useVehicleStore.getState().selectedVehicleId).toBe('a');
    await act(async () => map.props.onRegionChangeComplete({ latitude: 1, longitude: 2, latitudeDelta: .1, longitudeDelta: .1 }));
    expect(useVehicleStore.getState().followSelected).toBe(true);
    await act(async () => useLiveVehicleStore.getState().upsert('a', point(2, 3, 1)));
    expect(boundary.animate).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType('Marker' as React.ElementType)[0].props.coordinate).toEqual({ latitude: 2, longitude: 3 });
    await act(async () => map.props.onPanDrag());
    await act(async () => useLiveVehicleStore.getState().upsert('a', point(3, 4, 2)));
    expect(boundary.animate).toHaveBeenCalledTimes(2);
    await act(async()=>tree.root.findByProps({accessibilityLabel:'Live Map settings'}).props.onPress());
    await act(async () => tree.root.findByProps({accessibilityLabel:'Toggle follow selected vehicle'}).props.onValueChange(true));
    expect(boundary.animate).toHaveBeenCalledTimes(3);
    expect(tree.root.findByType('MapView' as React.ElementType)).toBe(map);
    await act(async () => map.props.onRegionChangeComplete({ latitude: 3, longitude: 4, latitudeDelta: .1, longitudeDelta: .1 }));
    await act(async () => useVehicleStore.getState().setSelected('b'));
    expect(tree.root.findAllByType('Marker' as React.ElementType).find(marker => marker.props.title.startsWith('A ·'))?.props.pinColor).toBe('#3b82f6');
    await act(async () => tree.unmount());
  });
});
