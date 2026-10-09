import {describe,expect,it} from 'vitest';
import {createLiveVehicleStore} from './liveVehicleStore';
describe('live address freshness',()=>{
  it('clears an old address when the position changes, accepts enrichment for the same fix',()=>{
    const store=createLiveVehicleStore();const fix={server_received_at:'2026-10-08T15:00:00Z',latitude:28,longitude:76,address:'Old road'};
    store.getState().upsert('v',fix);
    store.getState().upsert('v',{...fix,server_received_at:'2026-10-08T15:01:00Z',latitude:29,address:undefined});
    expect(store.getState().byVehicleId.v.address).toBeNull();
    store.getState().upsert('v',{...fix,server_received_at:'2026-10-08T15:01:00Z',latitude:29,address:'New road'});
    expect(store.getState().byVehicleId.v.address).toBe('New road');
  });
});

it('keeps a last known address and GPS time when a no-fix packet reports idle',()=>{
 const store=createLiveVehicleStore();
 const fix={server_received_at:'2026-10-09T02:46:00Z',tracker_timestamp:'2026-10-09T02:46:00Z',latitude:28.86777,longitude:76.59430,address:'Rohtak road',gps_valid:true};
 store.getState().upsert('v',fix);
 store.getState().upsert('v',{server_received_at:'2026-10-09T02:51:00Z',tracker_timestamp:'2026-10-09T02:51:00Z',latitude:0,longitude:0,gps_valid:false,address:null,state:'IDLE',ignition:true,speed:0});
 expect(store.getState().byVehicleId.v).toMatchObject({latitude:fix.latitude,longitude:fix.longitude,address:fix.address,tracker_timestamp:fix.tracker_timestamp,gps_valid:false,state:'IDLE',ignition:true});
});

it('updates cell addresses independently of invalid GPS coordinates',()=>{
 const store=createLiveVehicleStore();
 store.getState().upsert('v',{server_received_at:'2026-10-09T02:46:00Z',latitude:28,longitude:76,address_source:'cell',address:'Cell area (approx.): Old'});
 store.getState().upsert('v',{server_received_at:'2026-10-09T02:47:00Z',latitude:0,longitude:0,gps_valid:false,address_source:'cell',address:'Cell area (approx.): New'});
 expect(store.getState().byVehicleId.v).toMatchObject({latitude:28,longitude:76,address:'Cell area (approx.): New'});
});
