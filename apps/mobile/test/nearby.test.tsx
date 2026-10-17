import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {NearbySheet} from '../components/fleet/NearbySheet';
import {NearbyView} from '../features/nearby/NearbyView';
import {nearbyCategories,nearbyCategoryIds,type NearbyCategory,type NearbyResult} from '../features/nearby/service';
const mock=vi.hoisted(()=>({load:vi.fn(),details:vi.fn(),external:vi.fn(),place:vi.fn(),push:vi.fn(),back:vi.fn(),open:vi.fn(),fit:vi.fn(),session:'session'}));
vi.mock('../features/nearby/service',async original=>({...await original<typeof import('../features/nearby/service')>(),loadNearby:mock.load,loadNearbyDetails:mock.details,handleOpenNearbyInGoogleMaps:mock.external,placeAction:mock.place}));
vi.mock('../services/api/client',()=>({api:{}}));
vi.mock('../services/api/mobile',()=>({mobileMessage:(e:Error)=>e.message,requireOnline:vi.fn()}));
vi.mock('../features/street-view/service',()=>({loadStreetPosition:vi.fn()}));
vi.mock('../store/authStore',()=>({useAuthStore:Object.assign((select:(s:{sessionKey:string})=>unknown)=>select({sessionKey:mock.session}),{getState:()=>({sessionKey:mock.session})})}));
vi.mock('@expo/vector-icons',()=>({FontAwesome6:'Icon'}));
vi.mock('expo-router',async()=>{
 const {useEffect}=await import('react');return {router:{push:mock.push,back:mock.back,canGoBack:()=>true,replace:vi.fn()},useFocusEffect:(callback:()=>void|(()=>void))=>useEffect(callback,[callback])};
});
vi.mock('../components/VehicleMarker',()=>({VehicleMarker:(props:Record<string,unknown>)=>React.createElement('VehicleMarker',props)}));
vi.mock('../features/map/LeafletMap',async()=>{
 const {forwardRef,useImperativeHandle,createElement}=await import('react');return {Marker:'Marker',default:forwardRef((props:Record<string,unknown>,ref)=>{useImperativeHandle(ref,()=>({fitToCoordinates:mock.fit,animateToRegion:vi.fn()}));return createElement('Map',props);})};
});
vi.mock('react-native',async()=>{
 const {forwardRef,useImperativeHandle,createElement}=await import('react');return {View:'View',Text:'Text',Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',TextInput:'TextInput',ActivityIndicator:'ActivityIndicator',Linking:{openURL:mock.open},Share:{share:vi.fn()},Alert:{alert:vi.fn()},useWindowDimensions:()=>({height:720}),PanResponder:{create:()=>({panHandlers:{}})},StyleSheet:{create:(s:unknown)=>s},FlatList:forwardRef((props:{data:unknown[];renderItem:(i:{item:unknown})=>React.ReactNode;ListEmptyComponent:React.ReactNode},ref)=>{useImperativeHandle(ref,()=>({scrollToIndex:vi.fn(),scrollToOffset:vi.fn()}));return createElement('List',{},props.data.length?props.data.map((item,index)=>createElement(React.Fragment,{key:index},props.renderItem({item}))):props.ListEmptyComponent);})};
});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const vehicle={id:'selected',vehicle_number:'OWN'};
const result=(category:NearbyCategory,name='Provider place'):NearbyResult=>({category,center:{latitude:28.9,longitude:76.6,recordedAt:'2026-10-16T10:00:00Z',stale:false,timeUncertain:false},places:[{id:'place',name,latitude:28.91,longitude:76.61,address:'Provider road',type:nearbyCategories[category].label,distanceMeters:1000,phone:null,openingHours:null}],radius:5000,attribution:'Geoapify',limitation:null});
beforeEach(()=>{vi.clearAllMocks();mock.load.mockImplementation(async(_id,category)=>result(category));mock.external.mockResolvedValue(undefined);mock.place.mockResolvedValue(undefined);mock.details.mockResolvedValue({...result('hospitals').places[0],phone:'+911234567890',openingHours:'24/7'})});
async function render(element:React.ReactElement){let tree!:ReactTestRenderer;await act(async()=>{tree=create(element)});return tree}
it('both category icons open the same selected-vehicle Google Maps search for all ten categories',async()=>{
 for(const category of nearbyCategoryIds){
  const tree=await render(<NearbySheet vehicle={vehicle} onClose={vi.fn()}/>);
  expect(tree.root.findAllByType('Icon' as React.ElementType)).toHaveLength(20);
  for(const label of [`Search ${nearbyCategories[category].label} in Google Maps`,`Open ${nearbyCategories[category].label} in Google Maps`]){
   const before=mock.external.mock.calls.length;
   await act(async()=>tree.root.findByProps({accessibilityLabel:label}).props.onPress());
   expect(mock.external).toHaveBeenCalledTimes(before+1);expect(mock.external.mock.calls.at(-1)?.slice(0,2)).toEqual([category,'selected']);
  }
  expect(mock.push).not.toHaveBeenCalled();await act(async()=>tree.unmount());
 }
});
it('external arrow passes the right category and ID and prevents duplicate requests',async()=>{
 let finish!:()=>void;mock.external.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve}));
 const tree=await render(<NearbySheet vehicle={vehicle} onClose={vi.fn()}/>),press=tree.root.findByProps({accessibilityLabel:'Open Hospitals in Google Maps'}).props.onPress;
 await act(async()=>{press();press()});expect(mock.external).toHaveBeenCalledOnce();expect(mock.external.mock.calls[0].slice(0,2)).toEqual(['hospitals','selected']);expect(mock.push).not.toHaveBeenCalled();
 await act(async()=>finish());await act(async()=>tree.unmount());
});
it('renders real matching map markers, stale warning, optional details and place actions',async()=>{
 mock.load.mockResolvedValue({...result('hospitals'),center:{...result('hospitals').center,stale:true}});
 const tree=await render(<NearbyView vehicleId="selected" vehicleNumber="OWN" category="hospitals"/>);
 const markers=tree.root.findAllByType('Marker' as React.ElementType);expect(markers.find(marker=>marker.props.title==='Provider place')?.props.coordinate).toMatchObject({latitude:28.91,longitude:76.61});expect(markers.find(marker=>marker.props.title.includes('Recorded vehicle GPS'))?.props.coordinate).toMatchObject({latitude:28.9,longitude:76.6});expect(JSON.stringify(tree.toJSON())).toContain('over 10 minutes old');
 expect(tree.root.findAllByProps({accessibilityLabel:'Call Provider place'})).toHaveLength(0);
 await act(async()=>tree.root.findByProps({accessibilityLabel:'Load details for Provider place'}).props.onPress());
 expect(JSON.stringify(tree.toJSON())).toContain('Open 24 hours');
 for(const [label,action] of [['Directions to','directions'],['Call','call'],['Share','share']] as const){await act(async()=>tree.root.findByProps({accessibilityLabel:`${label} Provider place`}).props.onPress());expect(mock.place.mock.calls.at(-1)?.[0]).toBe(action);}
 expect(mock.open).not.toHaveBeenCalled();await act(async()=>tree.unmount());
});
it('aborts old category searches; late results cannot overwrite current results or survive closing',async()=>{
 let finish!:(r:NearbyResult)=>void;mock.load.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
 const tree=await render(<NearbyView vehicleId="selected" vehicleNumber="OWN" category="hospitals"/>),signal=mock.load.mock.calls[0][3] as AbortSignal;
 await act(async()=>tree.update(<NearbyView vehicleId="selected" vehicleNumber="OWN" category="atm"/>));expect(signal.aborted).toBe(true);
 await act(async()=>finish(result('hospitals','Old hospital')));expect(JSON.stringify(tree.toJSON())).not.toContain('Old hospital');expect(JSON.stringify(tree.toJSON())).toContain('ATM');
 const currentSignal=mock.load.mock.calls[1][3] as AbortSignal;await act(async()=>tree.unmount());expect(currentSignal.aborted).toBe(true);
});
it('shows empty/provider error/GPS errors with retry instead of opening an external app',async()=>{
 mock.load.mockResolvedValueOnce({...result('atm'),places:[]});let tree=await render(<NearbyView vehicleId="selected" vehicleNumber="OWN" category="atm"/>);expect(JSON.stringify(tree.toJSON())).toContain('No matching places found');await act(async()=>tree.unmount());
 for(const message of ['GPS unavailable','Provider rate limit reached','You are offline']){mock.load.mockRejectedValueOnce(new Error(message));tree=await render(<NearbyView vehicleId="selected" vehicleNumber="OWN" category="atm"/>);expect(JSON.stringify(tree.toJSON())).toContain(message);expect(tree.root.findAllByType('Marker' as React.ElementType)).toHaveLength(0);await act(async()=>tree.unmount());}
 expect(mock.open).not.toHaveBeenCalled();
});
