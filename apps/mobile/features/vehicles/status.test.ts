import { describe, expect, it } from 'vitest';
import { stateForVehicle } from './status';
import { visibleVehicles } from '../dashboard/model';
import { normalizeLocation, normalizeVehicles } from './normalize';
const vehicle={id:'a',vehicle_number:'A',alias:null,odometer:null,vehicle_type:null,active:true,
  state:'MOVING' as const,status_checked_at:'2026-08-01T00:00:00Z',last_seen_at:'2026-08-01T00:00:00Z',offline_at:'2026-08-01T00:01:30Z'};
describe('server-derived offline display',()=>{
  it('shows the server offline decision even with no GPS record',()=>{
    const offline={...vehicle,state:'OFFLINE' as const,status_checked_at:'2026-08-01T00:02:00Z'};
    expect(stateForVehicle(offline)).toBe('OFFLINE');
    expect(visibleVehicles([offline],{},'Inactive','')).toEqual([offline]);
    expect(visibleVehicles([offline],{},'Running','')).toEqual([]);
    // Old cache stays last-known when disconnected; no client-clock guess about heartbeats.
    expect(stateForVehicle(vehicle)).toBe('MOVING');
  });
  it('prefers newer server activity over cached state and accepts later realtime state',()=>{
    const old={server_received_at:'2026-07-31T00:00:00Z',state:'STOPPED' as const};
    expect(stateForVehicle(vehicle,old)).toBe('MOVING');
    const fresh={...old,status_checked_at:'2026-08-01T00:02:00Z',offline_at:'2026-08-01T00:03:30Z'};
    expect(stateForVehicle(vehicle,fresh)).toBe('STOPPED');
  });
  it('retains server metadata through normalization and handles no activity safely',()=>{
    expect(normalizeVehicles([vehicle])[0]).toMatchObject(vehicle);
    expect(normalizeLocation({...vehicle,server_received_at:vehicle.status_checked_at})).toMatchObject({offline_at:vehicle.offline_at});
    expect(stateForVehicle({...vehicle,state:'OFFLINE',offline_at:null})).toBe('OFFLINE');
  });
});
