import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveVehicleStore } from '../store/liveVehicleStore';
import { useVehicleStore } from '../store/vehicleStore';
import { LiveVehicleRow } from '../components/LiveVehicleRow';
import LiveMap from '../app/(app)/map';
import type { Location } from '../types/models';

const boundary = vi.hoisted(() => ({ animate: vi.fn(), directions:vi.fn(), focus:undefined as undefined|(()=>void|(()=>void)), renders: new Map<string, number>(), vehicles: [
  { id: 'a', vehicle_number: 'A', alias: null, vehicle_type: 'Bike', odometer: null, active: true },
  { id: 'b', vehicle_number: 'B', alias: null, vehicle_type: 'EVCar' as string|null, odometer: null, active: true },
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
vi.mock('react-native', () => ({PanResponder:{create:(handlers:Record<string,unknown>)=>({panHandlers:handlers})},Switch:'Switch',ScrollView:'ScrollView', View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock('expo-router', async () => {const React=await import('react');return {router:{push:vi.fn(),replace:vi.fn()},useFocusEffect:(callback:()=>void|(()=>void))=>{boundary.focus=callback;React.useEffect(callback,[callback]);}};});
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
    expect(tree.root.findAllByType('Marker' as React.ElementType)).toHaveLength(1);
    expect(tree.root.findByType('Marker' as React.ElementType).props.iconSize).toEqual([28,56]);
    for(const label of ['Today Km','Total Km','Address unavailable'])expect(JSON.stringify(tree.toJSON())).toContain(label);
    const detailLabels=['Today Running','Today Idle','Today Stop','Avg Speed','Max Speed','From Last Stop','Play Back','Share','Notification'];
    const expectCollapsed=()=>{for(const label of detailLabels)expect(JSON.stringify(tree.toJSON())).not.toContain(label);};
    expectCollapsed();
    const drag=()=>tree.root.findByProps({testID:'live-map-panel-drag'}).props;
    expect(drag().onMoveShouldSetPanResponder(null,{dx:60,dy:12})).toBe(false);
    expect(drag().onMoveShouldSetPanResponder(null,{dx:0,dy:5})).toBe(false);
    expect(drag().onMoveShouldSetPanResponderCapture(null,{dx:2,dy:-60})).toBe(true);
    await act(async()=>drag().onPanResponderRelease(null,{dy:-5,vy:0}));
    expectCollapsed();
    await act(async()=>drag().onPanResponderRelease(null,{dy:-60,vy:-.6}));
    for(const label of detailLabels)expect(JSON.stringify(tree.toJSON())).toContain(label);
    expect(tree.root.findByType('MapView' as React.ElementType)).toBe(map);
    expect(tree.root.findAllByType('Marker' as React.ElementType)[0].props.pinColor).toBe('#3b82f6');
    await act(async()=>drag().onPanResponderRelease(null,{dy:60,vy:.6}));
    expectCollapsed();
    await act(async()=>tree.root.findByProps({accessibilityLabel:'Expand live map details'}).props.onPress());
    for(const label of detailLabels)expect(JSON.stringify(tree.toJSON())).toContain(label);
    await act(async()=>{boundary.focus?.();});
    expectCollapsed();
    await act(async()=>tree.root.findByProps({accessibilityLabel:'Expand live map details'}).props.onPress());
    await act(async()=>tree.root.findByProps({accessibilityLabel:'Collapse live map details'}).props.onPress());
    expectCollapsed();
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
    const satellite=tree.root.findByProps({accessibilityLabel:'Satellite'});
    expect(satellite.props.disabled).toBe(false);
    await act(async()=>satellite.props.onValueChange(true));
    expect(map.props.mapType).toBe('satellite');
    expect(tree.root.findByType('MapView' as React.ElementType)).toBe(map);
    await act(async()=>satellite.props.onValueChange(false));
    expect(map.props.mapType).toBe('street');
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
    const markers=tree.root.findAllByType('Marker' as React.ElementType);
    expect(markers).toHaveLength(1);
    expect(markers[0].props.coordinate).toEqual({latitude:20,longitude:30});
    expect(markers[0].props.pinColor).toBe('#3b82f6');
    expect(markers[0].props.iconSize).toEqual([36,68]);
    expect(markers[0].props.svg).toContain('viewBox="0 0 80 150"');
    await act(async()=>useLiveVehicleStore.getState().upsert('a',point(20,30,3)));
    expect(tree.root.findAllByType('Marker' as React.ElementType)).toHaveLength(1);
    expect(tree.root.findByType('Marker' as React.ElementType)).toBe(markers[0]);
    await act(async () => tree.unmount());
  });
  it('never substitutes another vehicle position and uses the dashboard car default for a missing type', async()=>{
    useVehicleStore.getState().setSelected('b');
    useLiveVehicleStore.getState().upsert('a',point(1,2));
    let tree!:ReactTestRenderer;
    await act(async()=>{tree=create(<LiveMap/>);});
    expect(tree.root.findAllByType('Marker' as React.ElementType)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('No valid last-known GPS position');
    boundary.vehicles[1].vehicle_type=null;
    try{
      await act(async()=>useLiveVehicleStore.getState().upsert('b',point(20,30)));
      const markers=tree.root.findAllByType('Marker' as React.ElementType);
      expect(markers).toHaveLength(1);
      expect(markers[0].props.coordinate).toEqual({latitude:20,longitude:30});
      expect(markers[0].props.iconSize).toEqual([36,68]);
    }finally{
      boundary.vehicles[1].vehicle_type='EVCar';
      await act(async()=>tree.unmount());
    }
  });

});
