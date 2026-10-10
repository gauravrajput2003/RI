import { describe, expect, it } from 'vitest';
import { demoLocations, demoVehicles } from '../demo/data';
import { demoCardExtras, liveCardExtras, fleetFilters, matchesFilter, visibleVehicles } from './model';
import { searchReports } from '../reports/catalog';

describe('dashboard preview models', () => {
  it('shows three bikes and counts their actual statuses', () => {
    const points = demoLocations();
    expect(fleetFilters.map(filter => demoVehicles.filter(vehicle => matchesFilter(points[vehicle.id], filter.label)).length)).toEqual([3, 0, 0, 1, 2, 0]);
    for (const vehicle of demoVehicles) expect(demoCardExtras[vehicle.id]).toBeDefined();
  });
  it('combines case-insensitive account / plate search with status filtering', () => {
    const points = demoLocations();
    expect(visibleVehicles(demoVehicles, points, 'All', ' hr12s1010 ').map(vehicle => vehicle.id)).toEqual(['demo-van']);
    expect(visibleVehicles(demoVehicles, points, 'Stopped', 'test')).toHaveLength(2);
    expect(visibleVehicles(demoVehicles, points, 'Idle', 'test')).toHaveLength(0);
    expect(matchesFilter(undefined, 'Running')).toBe(false);
    expect(matchesFilter({ ...points['demo-van'], state: 'MOVING', speed: 100 }, 'Overspeed')).toBe(false);
  });
  it('filters the report catalog without fabricating report results', () => {
    expect(searchReports('distance').map(report => report.title)).toEqual(['Distance Report']);
    expect(searchReports('TRAVEL').map(report => report.title)).toEqual(['Travel Summary']);
    expect(searchReports('not found')).toEqual([]);
  });
});

describe('real dashboard metrics',()=>{
  const vehicle={id:'real',vehicle_number:'REAL',alias:null,vehicle_type:'Bike',odometer:8710,active:true};
  const now=Date.parse('2026-10-09T04:00:00Z');
  it('shows recorded daily totals and keeps zero values, without inventing fuel',()=>{
    const latest={server_received_at:'2026-10-09T04:00:00Z',today_distance_km:0,today_max_speed:0,status_since_at:'2026-10-09T03:30:00Z'};
    expect(liveCardExtras(vehicle,latest,undefined,now)).toMatchObject({distance:'0.0 km',maxSpeed:'0 km/h',fuel:'Not available',since:'30 min'});
    expect(liveCardExtras(vehicle,{...latest,today_max_speed:67,today_distance_km:2.345},undefined,now)).toMatchObject({distance:'2.3 km',maxSpeed:'67 km/h'});
  });
  it('uses the newest server status and heartbeat sync, not old GPS time',()=>{
    const latest={server_received_at:'2026-10-09T03:00:00Z',status_checked_at:'2026-10-09T04:00:00Z',state:'IDLE' as const,status_since_at:'2026-10-09T03:50:00Z',last_seen_at:'2026-10-09T03:59:50Z'};
    expect(liveCardExtras(vehicle,latest,undefined,now).since).toBe('10 min');
    expect(liveCardExtras(vehicle,latest,undefined,now).lastSync).toBe(new Date(latest.last_seen_at).toLocaleString());
    expect(liveCardExtras({...vehicle,state:'OFFLINE',status_checked_at:'2026-10-09T04:01:00Z',offline_at:'2026-10-09T03:55:00Z'},latest,undefined,now).since).toBe('5 min');
  });
  it('does not use lifetime odometer or pretend an unknown transition time is known',()=>{
    expect(liveCardExtras(vehicle,undefined,undefined,now)).toMatchObject({distance:'Not available',maxSpeed:'Not available',since:'Not available'});
  });
});
