import {Bike,BusFront,CarFront,Truck} from 'lucide-react';
import {vehicleAppearance,type VehicleVisualIcon,type VehicleVisualState,type VehicleVisualType} from '../../../../../packages/shared-utils/src/index';

const icons:Record<VehicleVisualIcon,typeof CarFront>={
  'two-wheeler':Bike,
  'directions-car':CarFront,
  'local-shipping':Truck,
  'airport-shuttle':BusFront,
};

const rasterVehicleTypes = new Set<VehicleVisualType>(['bike','car','scooter','bus','truck']);
const rasterState:Record<string,'running'|'stopped'|'idle'|'unreachable'>={
  running:'running',
  overspeed:'running',
  stopped:'stopped',
  idle:'idle',
  unreachable:'unreachable',
  new:'unreachable',
  inactive:'unreachable',
};

export function vehicleIconAssetPath(type?:string|null,state?:VehicleVisualState){
  const appearance=vehicleAppearance(type,state);
  if(!rasterVehicleTypes.has(appearance.type))return null;
  return `/assets/vehicle-icons/vehicles/${appearance.type}/${rasterState[appearance.key]}.png`;
}

export function VehicleIcon({type,state,size='md',className=''}:{type?:string|null;state?:VehicleVisualState;size?:'sm'|'md'|'lg';className?:string}){
  const appearance=vehicleAppearance(type,state),Icon=icons[appearance.icon],assetPath=vehicleIconAssetPath(type,state);
  return <span className={`vehicle-icon vehicle-icon-${size} ${assetPath?'vehicle-icon-raster':''} ${className}`.trim()} style={{color:appearance.color,backgroundColor:assetPath?'transparent':appearance.background}} title={`${appearance.label} ${appearance.type}`} aria-label={`${appearance.label} ${appearance.type}`}>{assetPath?<img src={assetPath} alt="" aria-hidden="true"/>:<Icon aria-hidden="true"/>}</span>;
}
