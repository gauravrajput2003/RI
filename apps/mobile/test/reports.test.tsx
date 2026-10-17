import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {beforeEach,expect,it,vi} from 'vitest';
import type {MobileReport} from '../../../packages/shared-types/src/mobile-reports';
import {ReportView} from '../features/reports/ReportView';
import {ReportSheet} from '../components/fleet/ReportSheet';
import {dateKey} from '../features/reports/dates';
const boundary=vi.hoisted(()=>({get:vi.fn(),share:vi.fn()}));
vi.mock('../services/api/client',()=>({api:{get:boundary.get}}));
vi.mock('../constants/config',()=>({config:{demoMode:false}}));
vi.mock('../services/api/mobile',()=>({mobileMessage:(error:unknown)=>error instanceof Error?error.message:'Request failed'}));
vi.mock('../store/authStore',()=>({useAuthStore:(select:(s:{sessionKey:string})=>unknown)=>select({sessionKey:'isolated-session'})}));
vi.mock('../features/reports/export',()=>({shareReport:boundary.share}));
vi.mock('../components/fleet/VehicleIcon',()=>({VehicleIcon:'VehicleImage'}));
vi.mock('@expo/vector-icons',()=>({Feather:'Icon',MaterialCommunityIcons:'Icon'}));
vi.mock('@react-native-community/datetimepicker',()=>({default:'DatePicker'}));
vi.mock('expo-router',()=>({router:{replace:vi.fn()}}));
vi.mock('react-native',()=>({View:'View',Text:'Text',Pressable:'Pressable',Image:'Image',TextInput:'TextInput',Modal:'Modal',ActivityIndicator:'Spinner',ScrollView:'ScrollView',Platform:{OS:'android'},StyleSheet:{create:(styles:unknown)=>styles,absoluteFill:{}},FlatList:({data,renderItem,ListFooterComponent}:{data:unknown[];renderItem:(i:{item:unknown})=>React.ReactNode;ListFooterComponent?:React.ReactNode})=><>{data.map((item,index)=><React.Fragment key={index}>{renderItem({item})}</React.Fragment>)}{ListFooterComponent}</>}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
// All values below are isolated component-test fixtures, never report production data.
const report=():MobileReport=>({kind:'distance',vehicle:{id:'isolated-vehicle',vehicleNumber:'ISOLATED-BIKE',vehicleType:'bike'},filters:{start:new Date().toISOString(),end:new Date().toISOString(),timeZone:'Asia/Kolkata'},generatedAt:new Date().toISOString(),snapshotId:'isolated-snapshot',rows:[]});
async function render(kind:'distance'|'travel-summary'='distance'){
 const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});let tree!:ReactTestRenderer;
 await act(async()=>{tree=create(<QueryClientProvider client={cache}><ReportView kind={kind} vehicleId="isolated-vehicle" vehicleNumber="ISOLATED-BIKE"/></QueryClientProvider>)});
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20))});
 return {tree,close:async()=>{await act(async()=>tree.unmount());cache.clear()}};
}
const button=(tree:ReactTestRenderer,label:string)=>tree.root.findByProps({accessibilityLabel:label});
beforeEach(()=>{boundary.get.mockReset();boundary.share.mockReset();boundary.get.mockResolvedValue({data:{data:report()}})});
it.each(['distance','travel-summary'] as const)('%s clearly identifies the actual selected vehicle/period when empty and disables exports',async(kind)=>{
 const r=await render(kind),text=JSON.stringify(r.tree.toJSON());expect(text).toContain('No report data available for this vehicle.');expect(text).toContain('ISOLATED-BIKE');expect(text).toContain('Selected period:');expect(r.tree.root.findAllByType('VehicleImage' as React.ElementType)).toHaveLength(0);expect(button(r.tree,'Download as PDF').props.disabled).toBe(true);expect(button(r.tree,'Download as Excel').props.disabled).toBe(true);expect(boundary.get.mock.calls[0][0]).toBe(`/reports/mobile/${kind}`);await r.close();
});
it('keeps loading and network failure separate from no-data',async()=>{
 let reject!:(cause:unknown)=>void;boundary.get.mockImplementation(()=>new Promise((_resolve,fail)=>{reject=fail}));const r=await render();expect(JSON.stringify(r.tree.toJSON())).toContain('Loading report');expect(JSON.stringify(r.tree.toJSON())).not.toContain('No report data');boundary.get.mockRejectedValue(new Error('Network unavailable'));await act(async()=>reject(new Error('Network unavailable')));await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1200))});expect(JSON.stringify(r.tree.toJSON())).toContain('Could not retrieve the report.');expect(JSON.stringify(r.tree.toJSON())).not.toContain('No report data available for this vehicle.');await r.close();
});
it('preserves genuine zeros, missing fields, selected filters and exact export snapshot',async()=>{
 const data=report();data.rows=[{id:'day',date:dateKey(),pointCount:2,gpsPointCount:2,km:0,avgSpeed:0,maxSpeed:0,durationSeconds:60,runningSeconds:0,idleSeconds:null,stoppedSeconds:null,unreachableSeconds:0,halts:null,startTime:null,endTime:null,startLocation:null,endLocation:null,startAddress:null,endAddress:null,partial:true}];boundary.get.mockResolvedValue({data:{data}});let finish!:()=>void;boundary.share.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve}));const r=await render();expect(JSON.stringify(r.tree.toJSON())).toContain('0 km');expect(JSON.stringify(r.tree.toJSON())).toContain('00:01:00');expect(JSON.stringify(r.tree.toJSON())).toContain('— means unavailable');const press=button(r.tree,'Download as PDF').props.onPress;await act(async()=>{press();press()});expect(boundary.share).toHaveBeenCalledTimes(1);expect(boundary.share).toHaveBeenCalledWith(data,'pdf');await act(async()=>finish());await r.close();
});
it('cancels custom draft changes and applies an actual option without reusing another vehicle ID',async()=>{
 boundary.get.mockImplementation((url:string)=>Promise.resolve({data:{data:url==='/reports/options'?[{id:'second-vehicle',vehicle_number:'SECOND-BIKE',alias:null}]:report()}}));const r=await render();await act(async()=>button(r.tree,'Report filters').props.onPress());await act(async()=>button(r.tree,'Select Vehicle').props.onPress());await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20))});const pick=r.tree.root.findAllByType('Pressable' as React.ElementType).find(node=>node.findAllByType('Text' as React.ElementType).some(text=>text.props.children==='SECOND-BIKE'))!;await act(async()=>pick.props.onPress());await act(async()=>button(r.tree,'Cancel report filters').props.onPress());expect(boundary.get.mock.calls.filter(([,options])=>options.params?.vehicleId==='second-vehicle')).toHaveLength(0);
 await act(async()=>button(r.tree,'Report filters').props.onPress());await act(async()=>button(r.tree,'Select Vehicle').props.onPress());await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10))});const second=r.tree.root.findAllByType('Pressable' as React.ElementType).find(node=>node.findAllByType('Text' as React.ElementType).some(text=>text.props.children==='SECOND-BIKE'))!;await act(async()=>second.props.onPress());await act(async()=>button(r.tree,'Apply report filters').props.onPress());expect(boundary.get.mock.calls.some(([,options])=>options.params?.vehicleId==='second-vehicle')).toBe(true);await r.close();
});
it('report menu routes both choices and closes without navigation',async()=>{const close=vi.fn(),select=vi.fn();let tree!:ReactTestRenderer;await act(async()=>{tree=create(<ReportSheet visible onClose={close} onSelect={select}/>)});await act(async()=>button(tree,'Distance Report').props.onPress());expect(select).toHaveBeenLastCalledWith('distance');await act(async()=>button(tree,'Travel Summary').props.onPress());expect(select).toHaveBeenLastCalledWith('travel-summary');await act(async()=>button(tree,'Close Report').props.onPress());expect(close).toHaveBeenCalledOnce();await act(async()=>tree.unmount())});
