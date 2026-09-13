import type { Location, Tokens, Vehicle } from '../../types/models';

// Public, local demonstration credentials. These are NOT backend credentials/JWTs.
export const demoCredentials = { email: 'gaurav@gmail.com', password: '123456' };
export const demoTokens: Tokens = { accessToken: 'local-demo-access-not-a-jwt', refreshToken: 'local-demo-refresh-not-a-jwt' };
export const demoVehicles: Vehicle[] = [
  { id: 'demo-van', vehicle_number: 'HR12S1010', alias: 'TEST ACCOUNT', vehicle_type: 'Scooter', odometer: 0, active: true },
  { id: 'demo-car', vehicle_number: 'HR12AY6674', alias: 'Ri test dli', vehicle_type: 'Motorbike', odometer: 15.76, active: true },
  { id: 'demo-truck', vehicle_number: 'HR12AB1234', alias: 'DEMO BIKE', vehicle_type: 'Motorbike', odometer: 8.42, active: true },
];
export function demoLocations(now = Date.now()): Record<string, Location> {
  const timestamp = new Date(now).toISOString();
  const base: Location = { server_received_at: timestamp, tracker_timestamp: timestamp, gps_valid: true, satellites: 9, battery_percent: 86, gsm_signal: 4, course: 0 };
  return {
    'demo-van': { ...base, vehicle_id: 'demo-van', latitude: 28.8837, longitude: 76.6066, speed: 0, ignition: false, state: 'STOPPED' },
    'demo-car': { ...base, vehicle_id: 'demo-car', latitude: 28.8842, longitude: 76.6072, speed: 0, ignition: false, state: 'STOPPED' },
    'demo-truck': { ...base, vehicle_id: 'demo-truck', latitude: 28.8955, longitude: 76.6068, speed: 0, ignition: true, state: 'IDLE' },
  };
}

export const demoUserProfile = {
  name: 'HUNAR SMART WORLD',
  email: 'poobun10101@gmail.com',
  phone: '9253010101',
  avatarLetter: 'H',
};

export const demoVehicleDetails = [
  {
    id: 'demo-scooter',
    vehicle_number: 'HR12S1010',
    timestamp: '12-09-2026 21:01:21',
    speed: 0,
    overspeed: 90,
    mileage: 30,
    odometer: 0,
    alias: 'TEST ACCOUNT',
    remark: '—',
    subscriptionStart: '03-08-2026',
    subscriptionDue: '03-08-2027',
    visual: 'scooter' as const,
  },
  {
    id: 'demo-car-2',
    vehicle_number: 'HR12AC3222',
    timestamp: '12-09-2026 20:58:34',
    speed: 0,
    overspeed: 90,
    mileage: 20,
    odometer: 0,
    alias: 'magnet tracker (protocol w-15)',
    remark: '—',
    subscriptionStart: '21-08-2026',
    subscriptionDue: '21-08-2027',
    visual: 'car' as const,
  },
  {
    id: 'demo-bike',
    vehicle_number: 'HR12AY6674',
    timestamp: '12-09-2026 20:58:57',
    speed: 0,
    overspeed: 60,
    mileage: 15,
    odometer: 15.76,
    alias: 'Ri test dli',
    remark: '—',
    subscriptionStart: '13-02-2026',
    subscriptionDue: '13-02-2027',
    visual: 'bike' as const,
  },
  {
    id: 'demo-quad',
    vehicle_number: '0000',
    timestamp: '12-09-2026 19:40:12',
    speed: 0,
    overspeed: 60,
    mileage: 25,
    odometer: 8.42,
    alias: 'DEMO BIKE',
    remark: '—',
    subscriptionStart: '28-07-2026',
    subscriptionDue: '28-07-2027',
    visual: 'bike' as const,
  },
];

export const demoSubscriptions = [
  { id: 'sub-1', badgeIndex: 1, vehicle_number: 'HR12S1010', subscriptionStart: '03-08-2026', subscriptionDue: '03-08-2027' },
  { id: 'sub-2', badgeIndex: 2, vehicle_number: 'HR12AC3222', subscriptionStart: '21-08-2026', subscriptionDue: '21-08-2027' },
  { id: 'sub-3', badgeIndex: 3, vehicle_number: 'HR12AY6674', subscriptionStart: '13-02-2026', subscriptionDue: '13-02-2027' },
  { id: 'sub-4', badgeIndex: 4, vehicle_number: '0000', subscriptionStart: '28-07-2026', subscriptionDue: '28-07-2027' },
];

export const defaultSettings = {
  language: 'English',
  alertNotification: true,
  sound: true,
  vibration: true,
  voiceAssistance: false,
  landingPage: 'Dashboard' as const,
  zoomIn: false,
  routeDraw: false,
  livemapAnimation: false,
  saveFilterState: false,
  enable12HoursTimeFormat: false,
};

