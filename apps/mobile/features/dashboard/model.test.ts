import { describe, expect, it } from 'vitest';
import { demoLocations, demoVehicles } from '../demo/data';
import { demoCardExtras, fleetFilters, matchesFilter, visibleVehicles } from './model';
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
