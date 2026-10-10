import {beforeEach,describe,it,expect}from 'vitest';import {useLiveVehicleStore}from './liveVehicleStore';describe('live vehicle state',()=>{beforeEach(()=>useLiveVehicleStore.getState().clear());it('updates only the affected vehicle record',()=>{const store=useLiveVehicleStore.getState();store.upsert('a',{tracker_timestamp:null,server_received_at:'2026-01-01T00:00:00Z',latitude:1,longitude:1,speed:2,course:null,ignition:null,satellites:null,gps_valid:true,battery_percent:null,gsm_signal:null});const first=useLiveVehicleStore.getState().byVehicleId.a;useLiveVehicleStore.getState().upsert('b',{tracker_timestamp:null,server_received_at:'2026-01-01T00:00:00Z',latitude:3,longitude:3,speed:4,course:null,ignition:null,satellites:null,gps_valid:true,battery_percent:null,gsm_signal:null});expect(useLiveVehicleStore.getState().byVehicleId.a).toBe(first);expect(useLiveVehicleStore.getState().byVehicleId.b.speed).toBe(4)})});

it('clears historical speed when the server explicitly reports no live speed, while retaining partial updates',()=>{
  const store=useLiveVehicleStore.getState();store.clear();
  store.upsert('a',{server_received_at:'2026-10-09T04:00:00Z',speed:22,state:'MOVING'});
  store.upsert('a',{server_received_at:'2026-10-09T04:01:00Z',speed:22,current_speed:null,state:'IDLE'});
  expect(useLiveVehicleStore.getState().byVehicleId.a).toMatchObject({speed:null,state:'IDLE'});
  store.upsert('a',{server_received_at:'2026-10-09T04:02:00Z',current_speed:0,state:'IDLE'});
  expect(useLiveVehicleStore.getState().byVehicleId.a.speed).toBe(0);
  store.upsert('a',{server_received_at:'2026-10-09T04:03:00Z',ignition:true});
  expect(useLiveVehicleStore.getState().byVehicleId.a.speed).toBe(0);
});
