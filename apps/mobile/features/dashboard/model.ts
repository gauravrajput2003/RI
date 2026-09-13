import type { Location, Vehicle } from '../../types/models';
export type FleetFilter = 'All' | 'Overspeed' | 'Running' | 'Idle' | 'Stopped' | 'Inactive';
export const fleetFilters: { label: FleetFilter; color: string }[] = [
  { label: 'All', color: '#ef080c' }, { label: 'Overspeed', color: '#ff8300' },
  { label: 'Running', color: '#19b900' }, { label: 'Idle', color: '#d4bb00' },
  { label: 'Stopped', color: '#ff1628' }, { label: 'Inactive', color: '#9767bb' },
];
export interface CardExtras { distance: string; fuel: string; maxSpeed: string; since: string; lastSync: string; address: string; visual: 'scooter' | 'bike'; }
export const demoCardExtras: Record<string, CardExtras> = {
  'demo-van': { distance: '0.0', fuel: '—', maxSpeed: '0', since: '2 days 1 hour', lastSync: '12-09-2026\n20:25:09', address: 'Rohtak Jhajjar Rd, Sector-23, Rohtak, Haryana 124021, India', visual: 'scooter' },
  'demo-car': { distance: '15.76', fuel: '0.32', maxSpeed: '67', since: '1 hour 32 min', lastSync: '12-09-2026\n20:25:39', address: 'Rohtak Jhajjar Rd, Sector-23, Rohtak, Haryana 124021, India', visual: 'bike' },
  'demo-truck': { distance: '8.42', fuel: '0.18', maxSpeed: '42', since: '24 min', lastSync: '12-09-2026\n20:24:18', address: 'Model Town, Rohtak, Haryana 124001, India', visual: 'bike' },
};
export function matchesFilter(point: Location | undefined, filter: FleetFilter) {
  if (filter === 'All') return true;
  if (filter === 'Overspeed') return point?.metadata?.overspeed === true;
  return point?.state === ({ Running: 'MOVING', Idle: 'IDLE', Stopped: 'STOPPED', Inactive: 'OFFLINE' } as const)[filter];
}
export function visibleVehicles(vehicles: Vehicle[], live: Record<string, Location>, filter: FleetFilter, search: string) {
  const term = search.trim().toLowerCase();
  return vehicles.filter(vehicle => matchesFilter(live[vehicle.id], filter) && (!term || (vehicle.vehicle_number + ' ' + (vehicle.alias ?? '')).toLowerCase().includes(term)));
}
