import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {beforeEach,expect,it,vi} from 'vitest';
import {permissionKeys} from '../../../packages/shared-types/src/permissions';
import {AddDriverView} from '../features/drivers/AddDriverView';
import {DriverListView} from '../features/drivers/DriverListView';
import {DriverSheet} from '../components/fleet/DriverSheet';
import {validateDriver,type Driver,type VehicleDriver} from '../features/drivers/service';
const mock=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn(),back:vi.fn(),push:vi.fn(),replace:vi.fn(),session:'session',rows:[] as Driver[],assignment:{assignmentId:null,assignedAt:null,driver:null} as VehicleDriver,canEdit:true}));
vi.mock('../services/api/client',()=>({api:{get:mock.get,post:mock.post,put:mock.put}}));
vi.mock('../constants/config',()=>({config:{demoMode:false}}));
vi.mock('../services/api/mobile',()=>({requireOnline:vi.fn(),mobileMessage:(e:Error)=>e.message,useAccount:()=>({data:{id:'user',role:mock.canEdit?'CLIENT':'ADMIN',permissions:mock.canEdit?permissionKeys:['vehicles.view','dashboard.view']},isLoading:false,isError:false})}));
vi.mock('../store/authStore',()=>({useAuthStore:Object.assign((select:(state:{sessionKey:string})=>unknown)=>select({sessionKey:mock.session}),{getState:()=>({sessionKey:mock.session})})}));
vi.mock('expo-router',async()=>{const {useEffect}=await import('react');return {router:{back:mock.back,push:mock.push,replace:mock.replace,canGoBack:()=>true},useFocusEffect:(fn:()=>void|(()=>void))=>useEffect(fn,[fn])};});
vi.mock('@expo/vector-icons',()=>({Feather:'Icon'}));
vi.mock('react-native-svg',()=>({SvgXml:'SvgXml'}));
vi.mock('react-native',async()=>{
 const {createElement}=await import('react');return {View:'View',Text:'Text',Modal:'Modal',TextInput:'TextInput',Pressable:'Pressable',ScrollView:'ScrollView',KeyboardAvoidingView:'KeyboardAvoidingView',ActivityIndicator:'ActivityIndicator',Platform:{OS:'android'},StyleSheet:{create:(s:unknown)=>s},FlatList:(props:{data:unknown[];renderItem:(props:{item:unknown})=>React.ReactNode;ListEmptyComponent:React.ReactNode;ListFooterComponent:React.ReactNode;onRefresh?:()=>void})=>createElement('List',{onRefresh:props.onRefresh},props.data.length?props.data.map((item,index)=>createElement(React.Fragment,{key:index},props.renderItem({item}))):props.ListEmptyComponent,props.ListFooterComponent)};
});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const driver:Driver={id:'driver-1',name:'Backend Driver',mobile:'+919876543210',licence_number:'DL14202612345',created_at:'2026-10-16T10:00:00Z',assigned:false,vehicle_id:null,vehicle_number:null};
beforeEach(()=>{
 vi.resetAllMocks();mock.session='session';mock.rows=[driver];mock.assignment={assignmentId:null,assignedAt:null,driver:null};mock.canEdit=true;
 mock.get.mockImplementation(async(path:string)=>({data:{data:path==='/drivers'?mock.rows:mock.assignment,nextCursor:null}}));
 mock.post.mockResolvedValue({data:{data:driver}});mock.put.mockImplementation(async()=>{mock.assignment={assignmentId:'assignment-1',assignedAt:'2026-10-16T11:00:00Z',driver:{...driver,assigned:true,vehicle_id:'vehicle-1'}};return {data:{data:mock.assignment}};});
});
async function tick(){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});}
async function render(element:React.ReactElement){
 const cache=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});let tree!:ReactTestRenderer;
 await act(async()=>{tree=create(<QueryClientProvider client={cache}>{element}</QueryClientProvider>)});await tick();
 return {cache,tree,update:async(element:React.ReactElement)=>{await act(async()=>tree.update(<QueryClientProvider client={cache}>{element}</QueryClientProvider>));await tick();},close:async()=>{await act(async()=>tree.unmount());cache.clear();}};
}
const button=(tree:ReactTestRenderer,label:string)=>tree.root.findByProps({accessibilityLabel:label});
async function fill(tree:ReactTestRenderer){await act(async()=>{button(tree,'Name').props.onChangeText(' Backend Driver ');button(tree,'Mobile').props.onChangeText('+91 98765 43210');button(tree,'Licence Number').props.onChangeText(' dl14202612345 ');});}
it('validates required fields with shared rules, preserves failed values and prevents duplicate saves',async()=>{
 const r=await render(<AddDriverView vehicleId="vehicle-1"/>);
 await act(async()=>button(r.tree,'Save driver').props.onPress());expect(mock.post).not.toHaveBeenCalled();expect(JSON.stringify(r.tree.toJSON())).toContain('Enter a name');
 await fill(r.tree);mock.post.mockRejectedValueOnce(new Error('Network unavailable'));
 await act(async()=>button(r.tree,'Save driver').props.onPress());expect(button(r.tree,'Name').props.value).toBe(' Backend Driver ');expect(JSON.stringify(r.tree.toJSON())).toContain('Network unavailable');expect(mock.replace).not.toHaveBeenCalled();
 let done!:(result:unknown)=>void;mock.post.mockImplementationOnce(()=>new Promise(resolve=>{done=resolve;}));const press=button(r.tree,'Save driver').props.onPress;
 await act(async()=>{press();press();});expect(mock.post).toHaveBeenCalledTimes(2);
 expect(mock.post.mock.calls[1]).toEqual(['/drivers',{name:'Backend Driver',mobile:'+919876543210',licenceNumber:'DL14202612345',vehicleId:'vehicle-1'}]);
 await act(async()=>done({data:{data:driver}}));expect(mock.replace).toHaveBeenCalledWith({pathname:'/(app)/drivers',params:{vehicleId:'vehicle-1',vehicleNumber:''}});expect(button(r.tree,'Name').props.value).toBe('');await r.close();
});
it('lists backend cards and uses the same Add Driver route from the floating plus',async()=>{
 const r=await render(<DriverListView/>);expect(JSON.stringify(r.tree.toJSON())).toContain('Backend Driver');expect(JSON.stringify(r.tree.toJSON())).toContain('+919876543210');expect(r.tree.root.findAllByType('SvgXml' as React.ElementType).filter(icon=>icon.props.width===72)).toHaveLength(1);
 await act(async()=>button(r.tree,'Add driver').props.onPress());expect(mock.push).toHaveBeenCalledWith({pathname:'/(app)/add-driver',params:{vehicleId:'',vehicleNumber:''}});expect(mock.put).not.toHaveBeenCalled();
 mock.rows=[driver,{...driver,id:'driver-2',name:'New persisted driver'}];await act(async()=>r.tree.root.findByType('List' as React.ElementType).props.onRefresh());await tick();expect(JSON.stringify(r.tree.toJSON())).toContain('New persisted driver');await r.close();
});
it('selection and confirmation use the real vehicle ID/current assignment version, save once, and refresh the current driver',async()=>{
 const r=await render(<DriverListView vehicleId="vehicle-1" vehicleNumber="OWN"/>);
 await act(async()=>button(r.tree,'Select driver Backend Driver').props.onPress());
 const press=button(r.tree,'Confirm driver assignment').props.onPress;await act(async()=>{press();press();});await tick();
 expect(mock.put).toHaveBeenCalledOnce();expect(mock.put).toHaveBeenCalledWith('/vehicles/vehicle-1/driver',{driverId:'driver-1',expectedAssignmentId:null});expect(mock.replace).toHaveBeenCalledWith('/(app)');
 expect(r.cache.getQueryData(['drivers','session','assignment','vehicle-1'])).toMatchObject({driver:{id:'driver-1'}});await r.close();
});
it('shows current assignment in the modal, opens selection once, and isolates vehicle changes/late results',async()=>{
 mock.assignment={assignmentId:'assignment-1',assignedAt:null,driver};const r=await render(<DriverSheet vehicle={{id:'vehicle-1',vehicle_number:'OWN'}} onClose={vi.fn()}/>);
 expect(JSON.stringify(r.tree.toJSON())).toContain('Backend Driver');const choose=button(r.tree,'Assign Driver').props.onPress;await act(async()=>{choose();choose();});expect(mock.push).toHaveBeenCalledOnce();expect(mock.push).toHaveBeenCalledWith({pathname:'/(app)/drivers',params:{vehicleId:'vehicle-1',vehicleNumber:'OWN'}});await r.close();
 let done!:(result:unknown)=>void;mock.get.mockImplementationOnce(()=>new Promise(resolve=>{done=resolve;}));const current=await render(<DriverSheet vehicle={{id:'vehicle-1',vehicle_number:'OWN'}} onClose={vi.fn()}/>);
 const signal=mock.get.mock.calls.at(-1)?.[1].signal as AbortSignal;
 mock.assignment={assignmentId:'assignment-2',assignedAt:null,driver:{...driver,id:'driver-2',name:'Other vehicle driver'}};
 await current.update(<DriverSheet vehicle={{id:'vehicle-2',vehicle_number:'SECOND'}} onClose={vi.fn()}/>);expect(signal.aborted).toBe(true);
 await act(async()=>done({data:{data:{assignmentId:'old',driver}}}));expect(JSON.stringify(current.tree.toJSON())).toContain('Other vehicle driver');expect(JSON.stringify(current.tree.toJSON())).not.toContain('Backend Driver');await current.close();
});
it('handles empty lists, busy drivers, write failures and view-only permissions',async()=>{
 mock.rows=[];let r=await render(<DriverListView vehicleId="vehicle-1"/>);expect(JSON.stringify(r.tree.toJSON())).toContain('No drivers saved');await act(async()=>button(r.tree,'Add driver').props.onPress());expect(mock.push).toHaveBeenCalledWith({pathname:'/(app)/add-driver',params:{vehicleId:'vehicle-1',vehicleNumber:''}});await r.close();
 mock.rows=[{...driver,assigned:true,vehicle_id:'other-vehicle',vehicle_number:'OTHER'}];r=await render(<DriverListView vehicleId="vehicle-1"/>);expect(button(r.tree,'Select driver Backend Driver').props.disabled).toBe(true);await r.close();
 mock.rows=[driver];mock.put.mockRejectedValueOnce(new Error('Assignment changed. Refresh.'));r=await render(<DriverListView vehicleId="vehicle-1"/>);await act(async()=>button(r.tree,'Select driver Backend Driver').props.onPress());await act(async()=>button(r.tree,'Confirm driver assignment').props.onPress());expect(JSON.stringify(r.tree.toJSON())).toContain('Assignment changed');expect(mock.replace).not.toHaveBeenCalled();await r.close();
 mock.canEdit=false;r=await render(<DriverListView vehicleId="vehicle-1"/>);expect(r.tree.root.findAllByProps({accessibilityLabel:'Add driver'})).toHaveLength(0);expect(button(r.tree,'Confirm driver assignment').props.disabled).toBe(true);await r.close();
});
it('rejects unsupported phone/licence formats without pretending to verify a licence registry',()=>{
 for(const input of [{name:' ',mobile:'1234567890',licenceNumber:'DL12345'},{name:'Name',mobile:'-------',licenceNumber:'DL12345'},{name:'Name',mobile:'1234567890',licenceNumber:'x'}])expect(validateDriver(input).valid).toBe(false);
 expect(validateDriver({name:' Name ',mobile:'(987) 654-3210',licenceNumber:' dl 12345 '})).toMatchObject({valid:true,data:{name:'Name',mobile:'9876543210',licenceNumber:'DL 12345'}});
});
