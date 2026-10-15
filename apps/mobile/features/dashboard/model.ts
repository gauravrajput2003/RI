import type { Location, Vehicle } from '../../types/models';
import { stateForVehicle } from '../vehicles/status';
import {STATUS_COLORS} from '../../utils/vehicleIcons';
export type FleetFilter = 'All' | 'Overspeed' | 'Running' | 'Idle' | 'Stopped' | 'Inactive';
export const fleetFilters: { label: FleetFilter; color: string }[] = [
  { label: 'All', color: '#ef080c' }, { label: 'Overspeed', color: '#ff8300' },
  { label: 'Running', color: STATUS_COLORS.running.main }, { label: 'Idle', color: STATUS_COLORS.idle.main },
  { label: 'Stopped', color: STATUS_COLORS.stopped.main }, { label: 'Inactive', color: STATUS_COLORS.unreachable.main },
];
export interface CardExtras { distance: string; fuel: string; maxSpeed: string; since: string; lastSync: string; address: string; visual: 'scooter' | 'bike'; }
export const demoCardExtras: Record<string, CardExtras> = {
  'demo-van': { distance: '0.0', fuel: '—', maxSpeed: '0', since: '2 days 1 hour', lastSync: '12-09-2026\n20:25:09', address: 'Rohtak Jhajjar Rd, Sector-23, Rohtak, Haryana 124021, India', visual: 'scooter' },
  'demo-car': { distance: '15.76', fuel: '0.32', maxSpeed: '67', since: '1 hour 32 min', lastSync: '12-09-2026\n20:25:39', address: 'Rohtak Jhajjar Rd, Sector-23, Rohtak, Haryana 124021, India', visual: 'bike' },
  'demo-truck': { distance: '8.42', fuel: '0.18', maxSpeed: '42', since: '24 min', lastSync: '12-09-2026\n20:24:18', address: 'Model Town, Rohtak, Haryana 124001, India', visual: 'bike' },
};
/** These are today's recorded GPS metrics, not lifetime odometer or sensor guesses. */
export function liveCardExtras(vehicle: Vehicle, latest?: Location | null, live?: Location, now = Date.now()): CardExtras {
  const sources = [vehicle, latest, live].filter((value): value is Vehicle | Location => value != null);
  const status = sources.reduce((newest, value) =>
    (Date.parse(value.status_checked_at ?? '') || 0) >= (Date.parse(newest.status_checked_at ?? '') || 0) ? value : newest);
  const since = status.state === 'OFFLINE' ? status.offline_at : status.status_since_at;
  const started = since ? Date.parse(since) : NaN;
  const minutes = Math.max(0, Math.floor((now - started) / 60000));
  const elapsed = !Number.isFinite(started) || started > now ? 'Not available'
    : minutes < 1 ? '<1 min' : minutes < 60 ? `${minutes} min`
    : minutes < 1440 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`;
  const seen = live?.last_seen_at ?? latest?.last_seen_at ?? vehicle.last_seen_at;
  return {
    distance: latest?.today_distance_km == null ? 'Not available' : `${latest.today_distance_km.toFixed(1)} km`,
    maxSpeed: latest?.today_max_speed == null ? 'Not available' : `${Math.round(latest.today_max_speed)} km/h`,
    fuel: 'Not available', since: elapsed,
    lastSync: seen ? new Date(seen).toLocaleString() : 'Not available',
    address: live?.address ?? latest?.address ?? 'Address unavailable',
    visual: vehicle.vehicle_type?.toLowerCase() === 'scooter' ? 'scooter' : 'bike',
  };
}
export function matchesFilter(point: Location | undefined, filter: FleetFilter, state = point?.state) {
  if (filter === 'All') return true;
  if (filter === 'Overspeed') return state !== 'OFFLINE' && point?.metadata?.overspeed === true;
  return state === ({ Running: 'MOVING', Idle: 'IDLE', Stopped: 'STOPPED', Inactive: 'OFFLINE' } as const)[filter];
}
export function visibleVehicles(vehicles: Vehicle[], live: Record<string, Location>, filter: FleetFilter, search: string) {
  const term = search.trim().toLowerCase();
  return vehicles.filter(vehicle => matchesFilter(live[vehicle.id], filter, stateForVehicle(vehicle, live[vehicle.id])) && (!term || (vehicle.vehicle_number + ' ' + (vehicle.alias ?? '')).toLowerCase().includes(term)));
}
