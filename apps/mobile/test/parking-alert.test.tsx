import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ParkingAlertDialog} from '../components/ParkingAlertDialog';
import {VehicleAlertBanner} from '../components/VehicleAlertBanner';
import {useNotificationStore} from '../store/notificationStore';
import type {VehicleAlert} from '../services/notifications/events';
const mocks=vi.hoisted(()=>({stopAlarm:vi.fn(),stopVoice:vi.fn(),push:vi.fn(),selected:vi.fn()}));
vi.mock('react-native',()=>({Modal:'Modal',View:'View',Pressable:'Pressable',Text:'Text',StyleSheet:{create:(value:unknown)=>value}}));
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:24,bottom:0,left:0,right:0})}));
vi.mock('expo-router',()=>({router:{push:mocks.push}}));
vi.mock('../store/vehicleStore',()=>({useVehicleStore:{getState:()=>({setSelected:mocks.selected})}}));
vi.mock('../services/notifications/parking-sound',()=>({stopParkingAlarm:mocks.stopAlarm}));
vi.mock('../services/notifications/voice',()=>({stopVoice:mocks.stopVoice}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const warning=(id='one',vehicleId='bike'):VehicleAlert=>({id,vehicleId,vehicleNumber:'HR12AU6675',eventType:'PARKING_MOVEMENT',radius:50,message:'Audit GPS: 28.8678,76.5942',occurredAt:new Date().toISOString()});
let tree:ReactTestRenderer|undefined;
beforeEach(()=>{vi.clearAllMocks();useNotificationStore.getState().clear();});
afterEach(async()=>{if(tree)await act(async()=>tree!.unmount());tree=undefined;useNotificationStore.getState().clear();vi.useRealTimers();});

it('opens a separate global modal above an existing screen/dialog with clear red alert content and no coordinates',async()=>{
 await act(async()=>{tree=create(<><ViewFixture/><VehicleAlertBanner/><ParkingAlertDialog/></>);});
 await act(async()=>useNotificationStore.getState().show(warning()));
 const modals=tree!.root.findAllByType('Modal' as React.ElementType);expect(modals).toHaveLength(2);
 const urgent=modals[1];expect(urgent.props.presentationStyle).toBe('overFullScreen');
 expect(urgent.findByProps({accessibilityLabel:'Parking security alert'})).toBeTruthy();
 const text=JSON.stringify(tree!.toJSON());expect(text).toContain('PARKING ALERT');expect(text).toContain('HR12AU6675');expect(text).toContain('more than 50 metres');expect(text).toContain('Please check your vehicle now.');expect(text).not.toContain('28.8678');expect(text).not.toContain('76.5942');
});
function ViewFixture(){return React.createElement('Modal',{visible:true},React.createElement('Text',{},'Existing report or parking dialog'));}

it('holds an urgent warning until acknowledged and routine status updates cannot cover it',async()=>{
 vi.useFakeTimers();await act(async()=>{tree=create(<><VehicleAlertBanner/><ParkingAlertDialog/></>);});
 await act(async()=>useNotificationStore.getState().show(warning()));
 await act(async()=>{useNotificationStore.getState().show({...warning('stopped'),eventType:'VEHICLE_STOPPED',message:'Vehicle stopped'});await vi.advanceTimersByTimeAsync(12000);});
 expect(useNotificationStore.getState().alert?.id).toBe('one');expect(tree!.root.findByProps({accessibilityLabel:'Parking security alert'})).toBeTruthy();
 await act(async()=>tree!.root.findByProps({accessibilityLabel:'Dismiss parking alert'}).props.onPress());
 expect(mocks.stopAlarm).toHaveBeenCalledOnce();expect(mocks.stopVoice).toHaveBeenCalledOnce();expect(useNotificationStore.getState().alert?.id).toBe('stopped');
 expect(tree!.root.findAllByProps({accessibilityLabel:'Parking security alert'})).toHaveLength(0);
});

it('updates an active reminder without stacking dialogs, and opens the correct vehicle map',async()=>{
 await act(async()=>{tree=create(<ParkingAlertDialog/>);});
 await act(async()=>useNotificationStore.getState().show(warning()));
 await act(async()=>useNotificationStore.getState().show({...warning('reminder'),eventType:'PARKING_REMINDER',radius:30}));
 expect(tree!.root.findAllByType('Modal' as React.ElementType)).toHaveLength(1);expect(JSON.stringify(tree!.toJSON())).toContain('more than 30 metres');
 await act(async()=>tree!.root.findByProps({accessibilityLabel:'Open parking alert vehicle in Live Map'}).props.onPress());
 expect(mocks.selected).toHaveBeenCalledWith('bike');expect(mocks.push).toHaveBeenCalledWith('/(app)/map');expect(useNotificationStore.getState().alert).toBeNull();
});

it('retains warnings for other vehicles, clears queued account data, and clears the active warning on return',()=>{
 const store=useNotificationStore.getState();store.show(warning());store.show(warning('two','second'));store.show(warning('two','second'));
 expect(useNotificationStore.getState().pending).toHaveLength(1);store.dismiss();expect(useNotificationStore.getState().alert?.vehicleId).toBe('second');
 store.show({...warning('returned','second'),eventType:'PARKING_RETURNED'});expect(useNotificationStore.getState().alert?.eventType).toBe('PARKING_RETURNED');
 store.clear();expect(useNotificationStore.getState().alert).toBeNull();expect(useNotificationStore.getState().pending).toHaveLength(0);
});

it('never falls back to an audit message with coordinates when the radius is unavailable',async()=>{
 useNotificationStore.getState().show({...warning(),radius:undefined});await act(async()=>{tree=create(<ParkingAlertDialog/>);});
 const text=JSON.stringify(tree!.toJSON());expect(text).toContain('moved away from its parking place');expect(text).not.toContain('28.8678');
});

it('does not resurrect a queued warning when that vehicle returned before acknowledgement',()=>{
 const store=useNotificationStore.getState();store.show(warning());store.show(warning('second-warning','second'));
 store.show({...warning('second-return','second'),eventType:'PARKING_RETURNED'});store.dismiss();
 expect(useNotificationStore.getState().alert?.eventType).toBe('PARKING_RETURNED');expect(useNotificationStore.getState().pending).toHaveLength(0);
});
