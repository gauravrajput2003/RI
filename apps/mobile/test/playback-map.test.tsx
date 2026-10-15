import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi,beforeEach } from 'vitest';
import PlaybackView from '../features/playback/PlaybackView';

const boundary = vi.hoisted(() => ({ fit: vi.fn(), animate: vi.fn(),history:vi.fn(),refetch:vi.fn(),params:{vehicleId:'demo'},focus:undefined as undefined|(()=>void|(()=>void)), points: [
  { latitude: 28, longitude: 76, speed: 0, server_received_at: '2026-09-14T00:00:00Z' },
  { latitude: 29, longitude: 77, speed: 0, server_received_at: '2026-09-14T00:10:00Z' },
] }));
vi.mock('react-native', () => ({ Platform:{OS:'android'},KeyboardAvoidingView:'KeyboardAvoidingView',ScrollView:'ScrollView',View: 'View', Text: 'Text', Pressable: 'Pressable', Modal: 'Modal', TextInput: 'TextInput', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (s: unknown) => s, absoluteFillObject: {} } }));
vi.mock('@react-native-community/datetimepicker',()=>({default:'DateTimePicker'}));
vi.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: vi.fn(),replace:vi.fn() }), useLocalSearchParams: () => boundary.params,useFocusEffect:(callback:typeof boundary.focus)=>{boundary.focus=callback;} }));
vi.mock('@expo/vector-icons', () => ({ Feather: 'Icon', MaterialCommunityIcons: 'Icon', Ionicons: 'Icon' }));
vi.mock('../features/vehicles/queries', () => ({ useHistory: (...args:unknown[]) => {boundary.history(...args);return { data: boundary.points, isLoading: false,refetch:boundary.refetch };} }));
vi.mock('../features/map/LeafletMap', async () => {
  const { forwardRef, useImperativeHandle, createElement } = await import('react');
  return { default: forwardRef((props: Record<string, unknown>, ref) => {
    useImperativeHandle(ref, () => ({ fitToCoordinates: boundary.fit, animateToRegion: boundary.animate }));
    return createElement('MapView', props);
  }), Marker: 'Marker', Polyline: 'Polyline' };
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(()=>{vi.clearAllMocks();boundary.points=[{latitude:28,longitude:76,speed:0,server_received_at:'2026-09-14T00:00:00Z'},{latitude:28.001,longitude:76.001,speed:10,server_received_at:'2026-09-14T00:10:00Z'}];});

it('fits the route when ready and after history changes, with non-null marker colors', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<PlaybackView />); });
  boundary.fit.mockClear();
  await act(async () => tree.root.findByType('MapView' as React.ElementType).props.onMapReady());
  expect(boundary.fit).toHaveBeenCalledWith([{ latitude: 28, longitude: 76 }, { latitude: 28.001, longitude: 76.001 }], expect.any(Object));
  for (const marker of tree.root.findAllByType('Marker' as React.ElementType)) {
    if(String(marker.props.title).startsWith('Playback'))expect(marker.props.children).toBeDefined();
    else expect(marker.props.pinColor).toMatch(/^#[0-9a-f]{6}$/);
  }
  boundary.points = [{ latitude: 12, longitude: 80, speed: 0, server_received_at: '2026-09-14T01:00:00Z' }];
  await act(async () => tree.update(<PlaybackView />));
  expect(boundary.animate).toHaveBeenCalledWith(expect.objectContaining({ latitude: 12, longitude: 80 }), 250);
  await act(async () => tree.unmount());
});

it('loads the selected historical day through its final second and keeps invalid ranges open',async()=>{
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(<PlaybackView/>);});
 const input=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label})[0];
 await act(async()=>{input('Start date').props.onChangeText('14/09/2026');input('Due date').props.onChangeText('13/09/2026');});
 await act(async()=>input('Confirm playback range').props.onPress());
 expect(JSON.stringify(tree.toJSON())).toContain('Start date/time must be before');
 expect(boundary.history.mock.calls.at(-1)![3]).toBe(false);
 await act(async()=>input('Due date').props.onChangeText('14/09/2026'));
 await act(async()=>input('Confirm playback range').props.onPress());
 const [id,from,to,enabled]=boundary.history.mock.calls.at(-1)!;
 expect(id).toBe('demo');expect(enabled).toBe(true);expect(from.getDate()).toBe(14);expect(to.getHours()).toBe(23);expect(to.getMinutes()).toBe(59);expect(to.getSeconds()).toBe(59);
 await act(async()=>tree.unmount());
});
it('seeks recorded points, changes speed explicitly, and toggles actual route and halt layers',async()=>{
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(<PlaybackView/>);});
 const control=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label})[0];
 expect(control('4x speed').props.accessibilityState.checked).toBe(true);
 await act(async()=>{control('12x speed').props.onPress();control('Playback timeline').props.onLayout({nativeEvent:{layout:{width:200}}});});
 await act(async()=>control('Playback timeline').props.onPress({nativeEvent:{locationX:200}}));
 const marker=tree.root.findAllByType('Marker' as React.ElementType).find(item=>String(item.props.title).startsWith('Playback'))!;
 expect(marker.props.coordinate.latitude).toBe(28.001);expect(marker.props.pinColor).toBe('#22c55e');expect(marker.props.iconType).toBe('bike');expect(marker.props.zIndexOffset).toBe(3000);
 expect(tree.root.findAllByType('Polyline' as React.ElementType)).toHaveLength(1);
 await act(async()=>control('Show route line').props.onPress());expect(tree.root.findAllByType('Polyline' as React.ElementType)).toHaveLength(0);
 await act(async()=>control('Show halt markers').props.onPress());expect(control('Show halt markers').props.accessibilityState.selected).toBe(false);
 await act(async()=>control('Centre on playback vehicle').props.onPress());expect(boundary.animate).toHaveBeenCalledWith(expect.objectContaining({latitude:28.001}),250);
 await act(async()=>control('Choose start date').props.onPress());
 expect(tree.root.findByType('DateTimePicker' as React.ElementType).props.mode).toBe('date');
 await act(async()=>tree.unmount());
});

it('shows the green bike above badges and advances its coordinates when playback starts',async()=>{
 vi.useFakeTimers();boundary.points=[{latitude:28,longitude:76,speed:10,server_received_at:'2026-09-14T00:00:00Z'},{latitude:28.0001,longitude:76,speed:10,server_received_at:'2026-09-14T00:00:10Z'}];
 let tree!:ReactTestRenderer;try{
  await act(async()=>{tree=create(<PlaybackView/>);});
  const bike=()=>tree.root.findAllByType('Marker' as React.ElementType).find(item=>item.props.iconType==='bike')!;
  expect(bike().props.coordinate.latitude).toBe(28);expect(bike().props.pinColor).toBe('#22c55e');
  await act(async()=>tree.root.findAllByProps({accessibilityLabel:'Start playback'})[0].props.onPress());
  await act(async()=>{vi.advanceTimersByTime(500);});
  expect(bike().props.coordinate.latitude).toBeGreaterThan(28);expect(bike().props.coordinate.latitude).toBeLessThan(28.0001);
  await act(async()=>tree.root.findAllByProps({accessibilityLabel:'Pause playback'})[0].props.onPress());const stopped=bike().props.coordinate.latitude;
  await act(async()=>{vi.advanceTimersByTime(500);});expect(bike().props.coordinate.latitude).toBe(stopped);
 }finally{if(tree)await act(async()=>tree.unmount());vi.useRealTimers();}
});

it('resets the range for a different vehicle and closes dialogs when leaving the tab',async()=>{
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(<PlaybackView/>);});
 const control=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label})[0];
 await act(async()=>control('Confirm playback range').props.onPress());
 expect(boundary.history.mock.calls.at(-1)![3]).toBe(true);
 boundary.params={vehicleId:'another-bike'};await act(async()=>tree.update(<PlaybackView/>));
 expect(boundary.history.mock.calls.at(-1)![0]).toBe('another-bike');expect(boundary.history.mock.calls.at(-1)![3]).toBe(false);
 let cleanup:void|(()=>void);await act(async()=>{cleanup=boundary.focus!();});
 await act(async()=>{if(typeof cleanup==='function')cleanup();});
 expect(tree.root.findAllByType('Modal' as React.ElementType).every(modal=>!modal.props.visible)).toBe(true);
 await act(async()=>tree.unmount());boundary.params={vehicleId:'demo'};
});
