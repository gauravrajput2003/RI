import {describe,it,expect,vi} from 'vitest';
import {createVoiceQueue,parseVehicleAlert,spokenAlert} from './events';
describe('vehicle voice alerts',()=>{
 it('rejects stale history, unknown events and malformed messages',()=>{
  const alert={id:'event',vehicleId:'bike',vehicleNumber:'AB12CD3456',eventType:'VEHICLE_RUNNING',message:'Vehicle AB12CD3456 has started.',occurredAt:new Date().toISOString()};
  expect(parseVehicleAlert(alert)).toEqual(alert);
  expect(spokenAlert(alert)).toBe('Vehicle A B 1 2 C D 3 4 5 6 has started.');
  expect(parseVehicleAlert({...alert,occurredAt:new Date(Date.now()-360000).toISOString()})).toBeNull();
  expect(parseVehicleAlert({...alert,eventType:'LOGIN'})).toBeNull();
  expect(parseVehicleAlert({...alert,message:null})).toBeNull();
 });
 it('speaks in sequence and ignores completion callbacks after logout/clear',()=>{
  const done:(()=>void)[]=[],speak=vi.fn((_text:string,callback:()=>void)=>done.push(callback));
  const queue=createVoiceQueue(speak);
  queue.add('Started');queue.add('Idle');expect(speak).toHaveBeenCalledTimes(1);
  done[0]();expect(speak.mock.calls[1][0]).toBe('Idle');
  queue.add('Stopped');queue.clear();done[1]();expect(speak).toHaveBeenCalledTimes(2);
  queue.add('New session');expect(speak.mock.calls[2][0]).toBe('New session');
 });
});

it('accepts fresh parking movement/reminder/re-entry notifications with the actual selected vehicle',()=>{
 for(const eventType of ['PARKING_MOVEMENT','PARKING_REMINDER','PARKING_RETURNED']){
  const alert={id:'parking-event',vehicleId:'selected',vehicleNumber:'SELECTED',eventType,message:'Actual parking event',occurredAt:new Date().toISOString()};
  expect(parseVehicleAlert(alert)).toEqual(alert);
 }
});

it('speaks parking movement and reminder concisely without audit timestamps or coordinates',()=>{
 for(const eventType of ['PARKING_MOVEMENT','PARKING_REMINDER'])expect(spokenAlert({id:'event',vehicleId:'bike',vehicleNumber:'AB12',eventType,radius:50,message:'Long audit: time and coordinates',occurredAt:new Date().toISOString()})).toBe('Warning! Vehicle A B 1 2 has moved more than 50 metres from its parking place. Please check your vehicle now.');
});
