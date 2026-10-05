import {Bike,BusFront,CarFront,Truck} from 'lucide-react';
import {vehicleAppearance,vehicleRasterAsset,type VehicleVisualIcon,type VehicleVisualState} from '../../../../../packages/shared-utils/src/index';

const icons:Record<VehicleVisualIcon,typeof CarFront>={
  'two-wheeler':Bike,
  'directions-car':CarFront,
  'local-shipping':Truck,
  'airport-shuttle':BusFront,
};

export function vehicleIconAssetPath(type?:string|null,state?:VehicleVisualState){
  const asset=vehicleRasterAsset(type,state);
  return asset ? `/assets/vehicle-icons/vehicles/${asset.type}/${asset.state}.png` : null;
}

export function VehicleIcon({type,state,size='md',className=''}:{type?:string|null;state?:VehicleVisualState;size?:'sm'|'md'|'lg';className?:string}){
  const appearance=vehicleAppearance(type,state),Icon=icons[appearance.icon],assetPath=vehicleIconAssetPath(type,state);
  return <span className={`vehicle-icon vehicle-icon-${size} ${assetPath?'vehicle-icon-raster':''} ${className}`.trim()} style={{color:appearance.color,backgroundColor:assetPath?'transparent':appearance.background}} title={`${appearance.label} ${appearance.type}`} aria-label={`${appearance.label} ${appearance.type}`}>{assetPath?<img src={assetPath} alt="" aria-hidden="true"/>:<Icon aria-hidden="true"/>}</span>;
}
