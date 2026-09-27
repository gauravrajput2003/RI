import {describe,expect,it} from 'vitest';
import {shouldCreateNotification,telemetryCandidates} from './engine.js';
const vehicle={vehicleNumber:'HR12TEST',overspeedLimit:80,doorConfigured:false,capabilities:{airCondition:'SUPPORTED',door:'UNSUPPORTED'}};
const active=(input:Parameters<typeof telemetryCandidates>[1])=>telemetryCandidates(vehicle,input).filter(item=>item.active).map(item=>item.type);
describe('alert event normalization',()=>{
 it('uses the authoritative state and vehicle threshold',()=>{expect(active({fleet_status:'STOPPED',speed:0})).toContain('VEHICLE_STOPPED');expect(active({fleet_status:'RUNNING',speed:81})).toEqual(expect.arrayContaining(['VEHICLE_RUNNING','VEHICLE_OVERSPEED','VEHICLE_ONLINE']));expect(active({fleet_status:'RUNNING',speed:80})).not.toContain('VEHICLE_OVERSPEED')});
 it('does not repeat an active transition and can suppress an initial online event',()=>{expect(shouldCreateNotification(undefined,true)).toBe(true);expect(shouldCreateNotification(undefined,true,false)).toBe(false);expect(shouldCreateNotification(true,true)).toBe(false);expect(shouldCreateNotification(false,true)).toBe(true);expect(shouldCreateNotification(true,false)).toBe(false)});
 it('only exposes AC and door events with real supported data',()=>{expect(active({fleet_status:'IDLE',ac:true})).toContain('AC_ON');expect(telemetryCandidates(vehicle,{fleet_status:'IDLE'}).some(item=>item.type.startsWith('AC_'))).toBe(false);expect(telemetryCandidates(vehicle,{fleet_status:'IDLE',door:true}).some(item=>item.type.startsWith('DOOR_'))).toBe(false);expect(active.call(null,{fleet_status:'IDLE',ac:false})).toContain('AC_OFF')});
});
