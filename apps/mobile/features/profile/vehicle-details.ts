import type { Vehicle } from '../../types/models';
import type { VehicleCardDetail } from './types';
import { demoVehicleDetails } from '../demo/data';
import { normalizeVehicleType } from '../../../../packages/shared-utils/src/index';
const billingDate=(value?:string|null)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleDateString('en-GB'):'Unavailable';

export function vehicleDetails(vehicles: Vehicle[] | undefined, demoMode: boolean): VehicleCardDetail[] {
  if (demoMode) return demoVehicleDetails;
  return (vehicles ?? []).map(vehicle => ({
    id: vehicle.id, vehicle_number: vehicle.vehicle_number,
    timestamp: vehicle.latestLocation?.server_received_at ? new Date(vehicle.latestLocation.server_received_at).toLocaleString() : 'Unavailable',
    speed: vehicle.latestLocation?.speed ?? null,
    overspeed: vehicle.overspeed_limit??null, mileage: vehicle.mileage??null, odometer: vehicle.odometer,
    alias: vehicle.alias ?? '', remark: vehicle.remark??'', subscriptionStart: billingDate(vehicle.billing_start), subscriptionDue: billingDate(vehicle.billing_due),
    visual: normalizeVehicleType(vehicle.vehicle_type),
  }));
}
