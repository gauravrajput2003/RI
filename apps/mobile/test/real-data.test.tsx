import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Vehicles from '../app/(app)/vehicles';
import Profile from '../app/(app)/profile';
import Subscription from '../app/(app)/subscription';
import { vehicleDetails } from '../features/profile/vehicle-details';
import { demoVehicleDetails } from '../features/demo/data';
const boundary=vi.hoisted(()=>({demoMode:false,vehicles:{data:{data:[] as unknown[]} as {data:unknown[]}|undefined,isLoading:false,isError:false,refetch:vi.fn()},subscriptions:{data:[] as unknown[],isLoading:false,isError:false,refetch:vi.fn()}}));
vi.mock('../constants/config',()=>({config:boundary}));
vi.mock('../features/vehicles/queries',()=>({useVehicles:()=>boundary.vehicles}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>boundary.subscriptions}));
vi.mock('../services/api/auth',()=>({logout:vi.fn()}));
vi.mock('../services/api/subscriptions',()=>({getSubscriptions:vi.fn()}));
vi.mock('expo-router',()=>({router:{push:vi.fn(),back:vi.fn(),replace:vi.fn()}}));
vi.mock('@expo/vector-icons',()=>({Feather:'Icon',MaterialCommunityIcons:'Icon'}));
vi.mock('../components/fleet/VehicleVisual',()=>({VehicleVisual:'VehicleVisual'}));
vi.mock('../components/fleet/Sheet',()=>({NoticeSheet:()=>null}));
vi.mock('react-native',async()=>{
  const {createElement}=await import('react');
  return {Text:'Text',View:'View',ScrollView:'ScrollView',Pressable:'Pressable',TextInput:'TextInput',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:(s:unknown)=>s},
    FlatList:({data,renderItem,ListEmptyComponent}:{data:{id:string}[];renderItem:(p:{item:{id:string}})=>React.ReactNode;ListEmptyComponent:React.ReactNode})=>createElement('List',{},data.length?data.map(item=>createElement('Row',{key:item.id},renderItem({item}))):ListEmptyComponent)};
});
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
async function render(component:React.ReactElement){let tree!:ReactTestRenderer;await act(async()=>{tree=create(component)});const result=JSON.stringify(tree.toJSON());await act(async()=>tree.unmount());return result}
beforeEach(()=>{boundary.demoMode=false;boundary.vehicles.data={data:[]};boundary.vehicles.isLoading=false;boundary.vehicles.isError=false;boundary.subscriptions.data=[];boundary.subscriptions.isLoading=false;boundary.subscriptions.isError=false});
describe('real-mode user-facing data',()=>{
  it('keeps an empty fleet empty and never mixes demo fields into real records',async()=>{
    expect(await render(<Vehicles/>)).toContain('No vehicles available');
    const real={id:'real',vehicle_number:'REAL-ONE',alias:null,odometer:null,vehicle_type:null,active:true};
    expect(vehicleDetails([real],false)[0]).toMatchObject({speed:null,overspeed:null,mileage:null,odometer:null,alias:'',timestamp:'Unavailable',subscriptionStart:'Unavailable'});
    boundary.vehicles.data={data:[real]};const screen=await render(<Vehicles/>);
    expect(screen).toContain('REAL-ONE');for(const demo of demoVehicleDetails){expect(screen).not.toContain(demo.vehicle_number);expect(screen).not.toContain(demo.subscriptionDue)}
  });
  it('shows real loading and error states instead of preview vehicles',async()=>{
    boundary.vehicles.data=undefined;boundary.vehicles.isLoading=true;expect(await render(<Vehicles/>)).toContain('Loading vehicles');
    boundary.vehicles.isLoading=false;boundary.vehicles.isError=true;expect(await render(<Vehicles/>)).toContain('Unable to load vehicles');
  });
  it('shows unavailable profile identity in real mode and sample identity only in demo mode',async()=>{
    const screen=await render(<Profile/>);expect(screen).toContain('Profile unavailable');expect(screen).not.toContain('HUNAR');expect(screen).not.toContain('poobun');
    boundary.demoMode=true;expect(await render(<Profile/>)).toContain('HUNAR SMART WORLD');
  });
  it('renders only returned account subscriptions and keeps missing dates unavailable',async()=>{
    expect(await render(<Subscription/>)).toContain('No subscriptions available');
    boundary.subscriptions.data=[{id:'s',plan:'Returned plan',status:'paused',starts_at:null,ends_at:null}];
    const screen=await render(<Subscription/>);expect(screen).toContain('Returned plan');expect(screen).toContain('paused');expect(screen).toContain('Unavailable');expect(screen).not.toContain('HR12');
    boundary.subscriptions.isError=true;expect(await render(<Subscription/>)).toContain('Subscriptions unavailable');
  });
  it('retains explicitly selected demo vehicles/subscriptions',async()=>{
    boundary.demoMode=true;expect(await render(<Vehicles/>)).toContain('HR12S1010');expect(await render(<Subscription/>)).toContain('03-08-2027');
  });
});
