import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {RelaySheet} from '../components/fleet/RelaySheet';
import type {VehicleRelay} from '../../../packages/shared-types/src/relay';
const state=vi.hoisted(()=>({data:undefined as VehicleRelay|undefined,isLoading:false,isError:false,isFetching:false,online:true,canEdit:true,error:undefined as Error|undefined,refetch:vi.fn(),send:vi.fn()}));
vi.mock('../features/relay/queries',()=>({useVehicleRelay:()=>state,sendRelayRequest:state.send}));
vi.mock('../services/api/mobile',()=>({useAccount:()=>({data:{role:state.canEdit?'CLIENT':'ADMIN',permissions:[]}}),mobileMessage:(error:Error)=>error.message}));
vi.mock('../store/runtimeStore',()=>({useRuntimeStore:(select:(s:{online:boolean})=>unknown)=>select({online:state.online})}));
vi.mock('../constants/config',()=>({config:{demoMode:false}}));
vi.mock('expo-router',async()=>{const {useEffect}=await import('react');return {useFocusEffect:(fn:()=>void|(()=>void))=>useEffect(fn,[fn])};});
vi.mock('react-native',()=>({ActivityIndicator:'ActivityIndicator',Modal:'Modal',Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',View:'View',StyleSheet:{create:(s:unknown)=>s}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const vehicle={id:'selected',vehicle_number:'SELECTED-REG'};
const fixture=():VehicleRelay=>({vehicleId:vehicle.id,vehicleNumber:vehicle.vehicle_number,vehicleType:'Car',configured:true,protocol:'GT06',state:'unknown',stateMessage:'Relay state is not confirmed by this tracker adapter.',canLock:false,canUnlock:false,code:'RELAY_UNSUPPORTED',message:'This tracker does not support remote relay control.',history:[],requestKey:'server-key'});
beforeEach(()=>{vi.resetAllMocks();state.data=fixture();state.isLoading=false;state.isError=false;state.isFetching=false;state.online=true;state.canEdit=true;state.error=undefined;});
async function render(){let tree!:ReactTestRenderer;await act(async()=>{tree=create(<RelaySheet vehicle={vehicle} onClose={vi.fn()}/>)});return tree;}
const button=(tree:ReactTestRenderer,label:string)=>tree.root.findByProps({accessibilityLabel:label});
it('loads the selected real vehicle and leaves both controls disabled for unsupported trackers',async()=>{
 const tree=await render();expect(JSON.stringify(tree.toJSON())).toContain('SELECTED-REG');expect(JSON.stringify(tree.toJSON())).toContain('Car');expect(JSON.stringify(tree.toJSON())).toContain('Unknown');
 for(const label of ['Lock Vehicle','Unlock Vehicle']){expect(button(tree,label).props.disabled).toBe(true);await act(async()=>button(tree,label).props.onPress());}
 expect(state.send).not.toHaveBeenCalled();await act(async()=>tree.unmount());
});
it('distinguishes disabled relay, loading and server errors without claiming success',async()=>{
 for(const mode of ['disabled','loading','error']){
  state.data=mode==='disabled'?{...fixture(),configured:false,message:'Relay control is not enabled for this vehicle.'}:undefined;
  state.isLoading=mode==='loading';state.isError=mode==='error';state.error=new Error('Server unavailable');
  const tree=await render();expect(button(tree,'Lock Vehicle').props.disabled).toBe(true);
  const text=JSON.stringify(tree.toJSON());expect(text).not.toContain('Locked');expect(text).not.toContain('Unlocked');
  if(mode==='disabled')expect(text).toContain('not enabled');if(mode==='error')expect(text).toContain('Server unavailable');if(mode==='loading')expect(tree.root.findAllByType('ActivityIndicator' as React.ElementType)).toHaveLength(1);
  await act(async()=>tree.unmount());
 }
});
it('keeps offline and view-only clients blocked even if a stale response enables controls',async()=>{
 state.data={...fixture(),canLock:true,canUnlock:true};
 for(const mode of ['offline','view-only']){state.online=mode!=='offline';state.canEdit=mode!=='view-only';const tree=await render();await act(async()=>button(tree,'Lock Vehicle').props.onPress());expect(state.send).not.toHaveBeenCalled();expect(button(tree,'Unlock Vehicle').props.disabled).toBe(true);await act(async()=>tree.unmount());}
});
it('confirms selected-vehicle requests, prevents duplicate taps, and never equates HTTP completion with physical state',async()=>{
 // UI-only contract fixture. Production currently returns both capabilities false.
 state.data={...fixture(),canLock:true,canUnlock:true};
 let done!:()=>void;state.send.mockImplementation(()=>new Promise<void>(resolve=>{done=resolve;}));
 const tree=await render();await act(async()=>button(tree,'Unlock Vehicle').props.onPress());
 expect(JSON.stringify(tree.toJSON())).toContain('restore the configured vehicle circuit');expect(state.send).not.toHaveBeenCalled();
 const confirm=button(tree,'Confirm relay command').props.onPress;await act(async()=>{confirm();confirm();});
 expect(state.send).toHaveBeenCalledOnce();expect(state.send).toHaveBeenCalledWith('selected','unlock','server-key');
 await act(async()=>done());expect(JSON.stringify(tree.toJSON())).toContain('Result not confirmed');expect(JSON.stringify(tree.toJSON())).not.toContain('Unlocked');
 await act(async()=>tree.unmount());
});
it('shows rejected or transport failures without changing the relay state',async()=>{
 state.data={...fixture(),canLock:true};state.send.mockRejectedValue(new Error('Command was not sent.'));
 const tree=await render();await act(async()=>button(tree,'Lock Vehicle').props.onPress());expect(JSON.stringify(tree.toJSON())).toContain('interrupt the configured vehicle circuit');
 await act(async()=>button(tree,'Confirm relay command').props.onPress());expect(JSON.stringify(tree.toJSON())).toContain('Command was not sent.');expect(JSON.stringify(tree.toJSON())).toContain('Unknown');expect(state.refetch).toHaveBeenCalled();await act(async()=>tree.unmount());
});
