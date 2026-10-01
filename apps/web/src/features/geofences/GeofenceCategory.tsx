import {type CSSProperties} from 'react';
import {SearchableSelect} from '../../components/ui/SearchableSelect';
import {
  Ban,Banknote,BriefcaseBusiness,Building,Building2,BusFront,Church,CircleDollarSign,CircleDot,CircleParking,
  CircleUserRound,Construction,Factory,Fence,FerrisWheel,Fuel,Hospital,Hotel,House,Landmark,LandPlot,LogIn,
  LogOut,Mail,Map,MapPin,MapPinHouse,Milk,MoonStar,Mountain,Navigation,Package,Plane,Recycle,Route,School,
  Shield,ShieldAlert,Ship,Theater,TrafficCone,TrainFront,TrainFrontTunnel,Trash2,Umbrella,University,Utensils,
  Warehouse,Waves,Wrench,type LucideIcon,
} from 'lucide-react';
import {geofenceCategories,type GeofenceCategoryIconKey} from '../../../../../packages/shared-types/src/geofences';

const categoryIcons:Record<GeofenceCategoryIconKey,LucideIcon>={
  Ban,Banknote,BriefcaseBusiness,Building,Building2,BusFront,Church,CircleDollarSign,CircleDot,CircleParking,
  CircleUserRound,Construction,Factory,Fence,FerrisWheel,Fuel,Hospital,Hotel,House,Landmark,LandPlot,LogIn,
  LogOut,Mail,Map,MapPin,MapPinHouse,Milk,MoonStar,Mountain,Navigation,Package,Plane,Recycle,Route,School,
  Shield,ShieldAlert,Ship,Theater,TrafficCone,TrainFront,TrainFrontTunnel,Trash2,Umbrella,University,Utensils,
  Warehouse,Waves,Wrench,
};

export function GeofenceCategoryIcon({icon,color}:{icon:GeofenceCategoryIconKey;color:string}){
  const Icon=categoryIcons[icon];
  return <span className="geofence-category-icon" style={{'--category-color':color} as CSSProperties} aria-hidden="true"><Icon/></span>;
}

export function GeofenceCategoryBadge({categoryKey}:{categoryKey:string}){
  const category=geofenceCategories.find(item=>item.key===categoryKey);
  if(!category)return <span className="geofence-category"><GeofenceCategoryIcon icon="MapPin" color="#718096"/>{categoryKey}</span>;
  return <span className="geofence-category"><GeofenceCategoryIcon icon={category.icon} color={category.color}/>{category.label}</span>;
}

export function GeofenceCategorySelect({value,onChange,disabled=false}:{value:string;onChange:(key:string)=>void;disabled?:boolean}){
 const render=(option:{value:string;label:string})=>{const category=geofenceCategories.find(item=>item.key===option.value);return category?<><GeofenceCategoryIcon icon={category.icon} color={category.color}/><span>{category.label}</span></>:option.label};
 return <div className="geofence-category-select"><SearchableSelect aria-label="Category *" required value={value} onChange={onChange} placeholder="Select category" isDisabled={disabled} options={geofenceCategories.map(category=>({value:category.key,label:category.label}))} renderOption={render} renderValue={render}/></div>;
}
