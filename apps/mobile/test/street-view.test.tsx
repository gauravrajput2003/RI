import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {StreetViewSheet} from '../components/fleet/StreetViewSheet';
const mock=vi.hoisted(()=>({load:vi.fn(),open:vi.fn(),session:'session'}));
vi.mock('../features/street-view/service',()=>({loadStreetPosition:mock.load,openGoogleLocation:mock.open}));
vi.mock('../services/api/mobile',()=>({mobileMessage:(e:Error)=>e.message}));
vi.mock('../store/authStore',()=>({useAuthStore:{getState:()=>({sessionKey:mock.session})}}));
vi.mock('../components/fleet/Sheet',()=>({Sheet:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock('react-native',()=>({View:'View',Text:'Text',Pressable:'Pressable',ScrollView:'ScrollView',ActivityIndicator:'ActivityIndicator',useWindowDimensions:()=>({height:640}),StyleSheet:{create:(s:unknown)=>s}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const vehicle={id:'own',vehicle_number:'OWN'},point={latitude:28.9,longitude:76.6,recordedAt:'2026-10-14T10:00:00Z',stale:false,timeUncertain:false};
beforeEach(()=>{vi.resetAllMocks();mock.session='session';mock.load.mockResolvedValue(point);mock.open.mockResolvedValue('street')});
async function render(){let tree!:ReactTestRenderer;await act(async()=>{tree=create(<StreetViewSheet vehicle={vehicle} onClose={vi.fn()}/>)});return tree}
it('previews selected GPS and only opens once for repeated taps during a request',async()=>{
 const tree=await render();expect(mock.load.mock.calls[0][0]).toBe('own');expect(mock.open).not.toHaveBeenCalled();
 expect(JSON.stringify(tree.toJSON())).toContain('28.900000');expect(JSON.stringify(tree.toJSON())).toContain('Imagery may be unavailable');
 let resolve!:(value:typeof point)=>void;mock.load.mockImplementation(()=>new Promise(r=>{resolve=r}));
 const open=tree.root.findByProps({accessibilityLabel:'Open vehicle Street View'}).props.onPress;
 await act(async()=>{open();open()});expect(mock.load).toHaveBeenCalledTimes(2);
 await act(async()=>resolve(point));expect(mock.open).toHaveBeenCalledOnce();expect(mock.open).toHaveBeenCalledWith(point,'street');
 await act(async()=>tree.unmount());
});
it('ignores a previous vehicle request and cancels it on selection change',async()=>{
 let resolve!:(value:typeof point)=>void;mock.load.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));
 const tree=await render();const signal=mock.load.mock.calls[0][1] as AbortSignal;
 await act(async()=>tree.update(<StreetViewSheet vehicle={{id:'second',vehicle_number:'SECOND'}} onClose={vi.fn()}/>));
 expect(signal.aborted).toBe(true);expect(mock.load.mock.calls[1][0]).toBe('second');
 await act(async()=>resolve({...point,latitude:1}));expect(JSON.stringify(tree.toJSON())).not.toContain('1.000000');expect(mock.open).not.toHaveBeenCalled();
 await act(async()=>tree.unmount());
});
it('shows unavailable GPS without enabling Street View',async()=>{
 mock.load.mockRejectedValue(new Error('No valid recorded GPS'));const tree=await render();
 expect(JSON.stringify(tree.toJSON())).toContain('No valid recorded GPS');expect(tree.root.findByProps({accessibilityLabel:'Open vehicle Street View'}).props.disabled).toBe(true);
 await act(async()=>tree.unmount());
});
it('warns about stale fixes and retains a normal map action',async()=>{
 mock.load.mockResolvedValue({...point,stale:true});const tree=await render();
 expect(JSON.stringify(tree.toJSON())).toContain('over 10 minutes old');expect(JSON.stringify(tree.toJSON())).toContain('Open recorded Street View');
 await act(async()=>tree.root.findByProps({accessibilityLabel:'View vehicle on normal map'}).props.onPress());
 expect(mock.open).toHaveBeenCalledWith({...point,stale:true},'map');await act(async()=>tree.unmount());
});
it('requires review when a previously fresh preview becomes stale before opening',async()=>{
 const tree=await render();mock.load.mockResolvedValue({...point,stale:true});
 await act(async()=>tree.root.findByProps({accessibilityLabel:'Open vehicle Street View'}).props.onPress());
 expect(mock.open).not.toHaveBeenCalled();expect(JSON.stringify(tree.toJSON())).toContain('Review its timestamp');
 await act(async()=>tree.root.findByProps({accessibilityLabel:'Open vehicle Street View'}).props.onPress());
 expect(mock.open).toHaveBeenCalledOnce();await act(async()=>tree.unmount());
});
