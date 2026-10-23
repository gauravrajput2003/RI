import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {beforeEach,it,expect,vi} from 'vitest';
import {ParkingSheet} from '../components/fleet/ParkingSheet';
import type {ParkingMode} from '../../../packages/shared-types/src/parking';
const state=vi.hoisted(()=>({data:undefined as ParkingMode|undefined,isLoading:false,isError:false,isFetching:false,error:undefined as Error|undefined,refetch:vi.fn(),change:vi.fn(),online:true,canEdit:true}));
vi.mock('../features/parking/queries',()=>({useParking:()=>state,changeParking:state.change}));
vi.mock('../services/api/mobile',()=>({useAccount:()=>({data:{role:state.canEdit?'CLIENT':'ADMIN',permissions:[]}}),mobileMessage:(error:Error)=>error.message}));
vi.mock('../store/runtimeStore',()=>({useRuntimeStore:(select:(s:{online:boolean})=>unknown)=>select({online:state.online})}));
vi.mock('../constants/config',()=>({config:{demoMode:false}}));
vi.mock('expo-router',async()=>{const {useEffect}=await import('react');return{router:{push:vi.fn()},useFocusEffect:(fn:()=>void|(()=>void))=>useEffect(fn,[fn])};});
vi.mock('../features/map/LeafletMap',()=>({default:'MapView',Marker:'Marker'}));
vi.mock('react-native',()=>({ActivityIndicator:'ActivityIndicator',Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',View:'View',StyleSheet:{create:(s:unknown)=>s}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const fixture=():ParkingMode=>({vehicleId:'selected',vehicleNumber:'ACTUAL-PLATE',enabled:false,version:null,radius:20,repeatMinutes:1,activatedAt:null,referenceAt:null,reference:null,boundaryState:'unknown',lastEvaluatedAt:null,distanceMeters:null,monitoring:false,message:'Ready to capture the latest vehicle GPS position.',canEnable:true,history:[]});
beforeEach(()=>{vi.resetAllMocks();state.data=fixture();state.isLoading=false;state.isError=false;state.isFetching=false;state.online=true;state.canEdit=true;});
async function render(){const cache=new QueryClient();let tree!:ReactTestRenderer;await act(async()=>{tree=create(<QueryClientProvider client={cache}><ParkingSheet vehicle={{id:'selected',vehicle_number:'ACTUAL-PLATE'}} onClose={vi.fn()}/></QueryClientProvider>);});return{tree,close:async()=>{await act(async()=>tree.unmount());cache.clear();}};}
const button=(tree:ReactTestRenderer,label:string)=>tree.root.findByProps({accessibilityLabel:label});
it('shows saved configuration and fixed map reference without resetting active Parking Mode',async()=>{
 state.data={...fixture(),enabled:true,version:4,radius:40,repeatMinutes:5,activatedAt:'2026-10-22T00:00:00Z',reference:{latitude:28,longitude:76},boundaryState:'outside',message:'Monitoring paused: fresh GPS is required.'};
 const r=await render();expect(JSON.stringify(r.tree.toJSON())).toContain('Parking Mode');expect(JSON.stringify(r.tree.toJSON())).toContain('ON');expect(button(r.tree,'Parking radius 40 m').props.accessibilityState.selected).toBe(true);expect(button(r.tree,'Parking repeat 5 minutes').props.accessibilityState.selected).toBe(true);
 expect(r.tree.root.findByType('Marker' as React.ElementType).props.coordinate).toEqual({latitude:28,longitude:76});expect(state.change).not.toHaveBeenCalled();await r.close();
});
it('confirms before enabling, sends selected options/version only and prevents duplicate taps',async()=>{
 const r=await render();await act(async()=>button(r.tree,'Parking radius 30 m').props.onPress());await act(async()=>button(r.tree,'Parking repeat 2 minutes').props.onPress());await act(async()=>button(r.tree,'Enable Parking Mode').props.onPress());expect(state.change).not.toHaveBeenCalled();expect(JSON.stringify(r.tree.toJSON())).toContain('ACTUAL-PLATE');
 let done!:(value:ParkingMode)=>void;state.change.mockImplementation(()=>new Promise<ParkingMode>(resolve=>{done=resolve;}));const confirm=button(r.tree,'Confirm parking change').props.onPress;await act(async()=>{confirm();confirm();});expect(state.change).toHaveBeenCalledOnce();expect(state.change).toHaveBeenCalledWith('selected',{enabled:true,radius:30,repeatMinutes:2,expectedVersion:null});
 state.data={...fixture(),enabled:true,version:1,radius:30,repeatMinutes:2};await act(async()=>done(state.data!));expect(state.refetch).toHaveBeenCalled();expect(JSON.stringify(r.tree.toJSON())).toContain('Parking Mode saved');await r.close();
});
it('requires confirmation for disabling and refreshes backend state',async()=>{
 state.data={...fixture(),enabled:true,version:5};const r=await render();await act(async()=>button(r.tree,'Disable Parking Mode').props.onPress());expect(state.change).not.toHaveBeenCalled();state.change.mockImplementation(async()=>{state.data={...state.data!,enabled:false,version:6};return state.data;});
 await act(async()=>button(r.tree,'Confirm parking change').props.onPress());expect(state.change).toHaveBeenCalledWith('selected',{enabled:false,radius:20,repeatMinutes:1,expectedVersion:5});expect(button(r.tree,'Enable Parking Mode')).toBeTruthy();await r.close();
});
it('shows stale GPS, offline, permission, loading and API failures with no writes',async()=>{
 for(const mode of ['stale','offline','permission','loading','error']){
  state.data={...fixture(),canEnable:mode!=='stale',message:mode==='stale'?'Fresh valid GPS is required.':'Ready'};state.online=mode!=='offline';state.canEdit=mode!=='permission';state.isLoading=mode==='loading';state.isError=mode==='error';state.error=new Error('API unavailable');
  const r=await render();if(!state.isError&&!state.isLoading)expect(button(r.tree,'Enable Parking Mode').props.disabled).toBe(true);if(state.isError)expect(JSON.stringify(r.tree.toJSON())).toContain('API unavailable');await r.close();
 }
 expect(state.change).not.toHaveBeenCalled();
});
it('keeps API conflicts visible and never resets the saved location locally',async()=>{
 state.data={...fixture(),enabled:true,version:2,reference:{latitude:0,longitude:76}};state.change.mockRejectedValue(new Error('Parking Mode changed. Refresh before saving.'));
 const r=await render();await act(async()=>button(r.tree,'Save parking settings').props.onPress());await act(async()=>button(r.tree,'Confirm parking change').props.onPress());expect(JSON.stringify(r.tree.toJSON())).toContain('Refresh before saving');expect(r.tree.root.findByType('Marker' as React.ElementType).props.coordinate.latitude).toBe(0);await r.close();
});
