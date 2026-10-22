import {afterEach,it,expect,vi} from 'vitest';
import {getVehicleStatus,getVehicleSvg,ICON_SIZE,SVGS,normalizeType,STATUS_COLORS} from './vehicleIcons.js';
afterEach(()=>vi.useRealTimers());
it('prioritizes backend state, then checks freshness before motion and ignition',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
 expect(getVehicleStatus({state:'OFFLINE',speed:40,lastSeen:new Date().toISOString()})).toBe('unreachable');
 expect(getVehicleStatus({state:'MOVING'})).toBe('running');
 expect(getVehicleStatus({speed:1})).toBe('unreachable');
 expect(getVehicleStatus({speed:6,lastSeen:'2026-10-14T09:30:00Z'})).toBe('unreachable');
 const lastSeen='2026-10-14T09:59:00Z';expect(getVehicleStatus({speed:6,lastSeen})).toBe('running');expect(getVehicleStatus({speed:0,ignition:true,lastSeen})).toBe('idle');expect(getVehicleStatus({speed:0,ignition:false,lastSeen})).toBe('stopped');
 expect(getVehicleStatus({speed:0,lastSeen})).toBe('unknown');expect(getVehicleStatus({speed:null,ignition:true,lastSeen})).toBe('unknown');
 expect(getVehicleStatus({speed:20,lastSeen:'2026-10-14T09:30:01Z'})).toBe('running');
});
it('normalizes aliases and shares cached five-type SVGs with a fixed status palette',()=>{
 for(const [raw,type] of [['Motorcycle','bike'],['SCOOTER','scooty'],['Hatchback','car'],['EVCar','car'],['EV-Car','car'],['Jeep','car'],['E-Rickshaw','auto'],['Three Wheeler','auto'],['Lorry','truck'],['Rickshaw','auto'],['unknown','bike']] as const)expect(normalizeType(raw)).toBe(type);
 for(const type of Object.keys(SVGS) as (keyof typeof SVGS)[]){const svg=getVehicleSvg(type,'idle');expect(svg).toContain(STATUS_COLORS.idle.main);expect(svg).toContain(STATUS_COLORS.idle.dark);expect(svg).toContain('opacity="0.18"');expect(svg).not.toContain('{{');expect(ICON_SIZE[type][1]).toBeGreaterThan(ICON_SIZE[type][0]);}
 expect(getVehicleSvg('Bike','running')).toBe(getVehicleSvg('Motorcycle','MOVING'));
});
