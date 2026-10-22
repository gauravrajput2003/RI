import {afterEach,describe,expect,it,vi} from 'vitest';
import L from 'leaflet';
import {getVehicleIcon,getVehicleStatus,getVehicleSvg,STATUS_COLORS} from './vehicleIcons.js';

afterEach(()=>vi.useRealTimers());
describe('dashboard vehicle markers',()=>{
 it('uses backend status and falls back to telemetry with a thirty-minute timeout',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
  expect(getVehicleStatus({fleet_status:'STOPPED',speed:40})).toBe('stopped');
  expect(getVehicleStatus({state:'MOVING'})).toBe('running');
  expect(getVehicleStatus({status:'OVERSPEED'})).toBe('running');
  expect(getVehicleStatus({speed:40})).toBe('unreachable');
  expect(getVehicleStatus({speed:40,lastSeen:'invalid'})).toBe('unreachable');
  expect(getVehicleStatus({speed:40,lastSeen:'2026-10-14T09:30:00Z'})).toBe('unreachable');
  const lastSeen='2026-10-14T09:59:00Z';
  expect(getVehicleStatus({speed:6,ignition:false,lastSeen})).toBe('running');
  expect(getVehicleStatus({speed:0,ignition:true,lastSeen})).toBe('idle');
  expect(getVehicleStatus({speed:0,ignition:false,lastSeen})).toBe('stopped');
 });
 it('normalizes types, applies the palette and creates centered rotated icons without a box',()=>{
  for(const [type,width,height] of [['MOTORCYCLE',28,56],['scooter',28,56],['SUV',36,68],['lorry',36,86],['rickshaw',32,58],['unknown',28,56]] as const){
   const icon=getVehicleIcon(L,type,'idle',90);
   expect(icon.options.className).toBe('');
   expect(icon.options.iconSize).toEqual([width,height]);
   expect(icon.options.iconAnchor).toEqual([width/2,height/2]);
   expect(icon.options.html).toContain('rotate(90deg)');
   expect(icon.options.html).toContain(STATUS_COLORS.idle.main);
   expect(icon.options.html).not.toContain('{{');
  }
  expect(getVehicleSvg('Bike','running')).toBe(getVehicleSvg('motorcycle','RUNNING'));
  expect(getVehicleSvg('car','stopped')).toContain('viewBox="0 0 80 150"');
  expect(getVehicleSvg('truck','stopped')).toContain('viewBox="0 0 80 190"');
  expect(getVehicleSvg('auto','unreachable')).toContain(STATUS_COLORS.unreachable.main);
  expect(getVehicleIcon(L,'bike','running',Number.NaN).options.html).toContain('rotate(0deg)');
 });
});
