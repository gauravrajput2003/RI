import type { Location, Tokens, Vehicle } from '../../types/models';

// Public, local demonstration credentials. These are NOT backend credentials/JWTs.
export const demoCredentials = { email: 'gaurav@gmail.com', password: '123456' };
export const demoTokens: Tokens = { accessToken: 'local-demo-access-not-a-jwt', refreshToken: 'local-demo-refresh-not-a-jwt' };
export const demoVehicles: Vehicle[] = [
  { id: 'demo-van', vehicle_number: 'DEMO-101', alias: 'Sample delivery van', vehicle_type: 'Van', odometer: 18420, active: true },
  { id: 'demo-car', vehicle_number: 'DEMO-102', alias: 'Sample parked car', vehicle_type: 'Car', odometer: 7320, active: true },
  { id: 'demo-truck', vehicle_number: 'DEMO-103', alias: 'Sample idle truck', vehicle_type: 'Truck', odometer: 42300, active: true },
];
const startedAt = Date.now();
export function demoLocations(now = Date.now()): Record<string, Location> {
  const phase = (now - startedAt) / 60000;
  const timestamp = new Date(now).toISOString();
  const base: Location = { server_received_at: timestamp, tracker_timestamp: timestamp, gps_valid: true, satellites: 9, battery_percent: 86, gsm_signal: 4, course: 0 };
  return {
    'demo-van': { ...base, vehicle_id: 'demo-van', latitude: 28.6139 + Math.sin(phase) * .005, longitude: 77.209 + Math.cos(phase) * .005, speed: 32, ignition: true, course: (phase * 180 / Math.PI + 360) % 360, state: 'MOVING' },
    'demo-car': { ...base, vehicle_id: 'demo-car', latitude: 28.619, longitude: 77.213, speed: 0, ignition: false, state: 'STOPPED' },
    'demo-truck': { ...base, vehicle_id: 'demo-truck', latitude: 28.608, longitude: 77.205, speed: 0, ignition: true, state: 'IDLE' },
  };
}
