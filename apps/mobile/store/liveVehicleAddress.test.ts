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
