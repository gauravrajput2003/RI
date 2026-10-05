import type { ImageSourcePropType } from 'react-native';
import { vehicleRasterAsset, type VehicleVisualState } from '../../../../packages/shared-utils/src/index';
import bike_running from '../../../web/public/assets/vehicle-icons/vehicles/bike/running.png';
import bike_stopped from '../../../web/public/assets/vehicle-icons/vehicles/bike/stopped.png';
import bike_idle from '../../../web/public/assets/vehicle-icons/vehicles/bike/idle.png';
import bike_unreachable from '../../../web/public/assets/vehicle-icons/vehicles/bike/unreachable.png';
import car_running from '../../../web/public/assets/vehicle-icons/vehicles/car/running.png';
import car_stopped from '../../../web/public/assets/vehicle-icons/vehicles/car/stopped.png';
import car_idle from '../../../web/public/assets/vehicle-icons/vehicles/car/idle.png';
import car_unreachable from '../../../web/public/assets/vehicle-icons/vehicles/car/unreachable.png';
import scooter_running from '../../../web/public/assets/vehicle-icons/vehicles/scooter/running.png';
import scooter_stopped from '../../../web/public/assets/vehicle-icons/vehicles/scooter/stopped.png';
import scooter_idle from '../../../web/public/assets/vehicle-icons/vehicles/scooter/idle.png';
import scooter_unreachable from '../../../web/public/assets/vehicle-icons/vehicles/scooter/unreachable.png';
import bus_running from '../../../web/public/assets/vehicle-icons/vehicles/bus/running.png';
import bus_stopped from '../../../web/public/assets/vehicle-icons/vehicles/bus/stopped.png';
import bus_idle from '../../../web/public/assets/vehicle-icons/vehicles/bus/idle.png';
import bus_unreachable from '../../../web/public/assets/vehicle-icons/vehicles/bus/unreachable.png';
import truck_running from '../../../web/public/assets/vehicle-icons/vehicles/truck/running.png';
import truck_stopped from '../../../web/public/assets/vehicle-icons/vehicles/truck/stopped.png';
import truck_idle from '../../../web/public/assets/vehicle-icons/vehicles/truck/idle.png';
import truck_unreachable from '../../../web/public/assets/vehicle-icons/vehicles/truck/unreachable.png';

const artwork = {
  bike: { running: bike_running, stopped: bike_stopped, idle: bike_idle, unreachable: bike_unreachable },
  car: { running: car_running, stopped: car_stopped, idle: car_idle, unreachable: car_unreachable },
  scooter: { running: scooter_running, stopped: scooter_stopped, idle: scooter_idle, unreachable: scooter_unreachable },
  bus: { running: bus_running, stopped: bus_stopped, idle: bus_idle, unreachable: bus_unreachable },
  truck: { running: truck_running, stopped: truck_stopped, idle: truck_idle, unreachable: truck_unreachable },
};

export function vehicleImageSource(type?: string | null, state?: VehicleVisualState): ImageSourcePropType | null {
  const asset = vehicleRasterAsset(type, state);
  return asset ? artwork[asset.type][asset.state] : null;
}
