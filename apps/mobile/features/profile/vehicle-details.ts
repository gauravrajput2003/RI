import type { Vehicle } from '../../types/models';
import type { VehicleCardDetail } from './types';
import { demoVehicleDetails } from '../demo/data';

export function vehicleDetails(vehicles: Vehicle[] | undefined, demoMode: boolean): VehicleCardDetail[] {
  if (demoMode) return demoVehicleDetails;
  return (vehicles ?? []).map(vehicle => ({
    id: vehicle.id, vehicle_number: vehicle.vehicle_number,
    timestamp: vehicle.latestLocation?.server_received_at ? new Date(vehicle.latestLocation.server_received_at).toLocaleString() : 'Unavailable',
    speed: vehicle.latestLocation?.speed ?? null,
    // The fleet list contract does not include these fields or per-vehicle subscriptions.
    overspeed: null, mileage: null, odometer: vehicle.odometer,
    alias: vehicle.alias ?? '', remark: '', subscriptionStart: 'Unavailable', subscriptionDue: 'Unavailable',
    visual: vehicle.vehicle_type?.toLowerCase().includes('scooter') ? 'scooter' : vehicle.vehicle_type?.toLowerCase().includes('car') ? 'car' : 'bike',
  }));
}
