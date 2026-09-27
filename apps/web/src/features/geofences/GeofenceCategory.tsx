import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent} from 'react';
import {
  Ban,Banknote,BriefcaseBusiness,Building,Building2,BusFront,Church,CircleDollarSign,CircleDot,CircleParking,
  CircleUserRound,Construction,Factory,Fence,FerrisWheel,Fuel,Hospital,Hotel,House,Landmark,LandPlot,LogIn,
  LogOut,Mail,Map,MapPin,MapPinHouse,Milk,MoonStar,Mountain,Navigation,Package,Plane,Recycle,Route,School,
  Shield,ShieldAlert,Ship,Theater,TrafficCone,TrainFront,TrainFrontTunnel,Trash2,Umbrella,University,Utensils,
  Warehouse,Waves,Wrench,Check,ChevronDown,type LucideIcon,
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
  const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),selected=geofenceCategories.find(item=>item.key===value);
  useEffect(()=>{const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[]);
  const choose=(key:string)=>{onChange(key);setOpen(false)};
  const keyDown=(event:KeyboardEvent<HTMLButtonElement>)=>{
    if(event.key==='Escape'){setOpen(false);return}
    if(event.key==='Enter'||event.key===' '){event.preventDefault();setOpen(current=>!current);return}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();setOpen(true);
      const index=Math.max(0,geofenceCategories.findIndex(item=>item.key===value)),offset=event.key==='ArrowDown'?1:-1;
      onChange(geofenceCategories[(index+offset+geofenceCategories.length)%geofenceCategories.length].key);
    }
  };
  return <div className="geofence-category-select" ref={root}>
    <button type="button" className="geofence-category-trigger" role="combobox" aria-label="Category *" aria-controls="geofence-category-options" aria-expanded={open} aria-haspopup="listbox" disabled={disabled} onClick={()=>setOpen(current=>!current)} onKeyDown={keyDown}>
      {selected?<><GeofenceCategoryIcon icon={selected.icon} color={selected.color}/><span>{selected.label}</span></>:<span className="geofence-category-placeholder">Select category</span>}<ChevronDown className="geofence-category-chevron"/>
    </button>
    {open&&<div id="geofence-category-options" className="geofence-category-options" role="listbox" aria-label="Geofence categories">
      {geofenceCategories.map(category=><button type="button" role="option" aria-selected={category.key===value} key={category.key} onClick={()=>choose(category.key)}><GeofenceCategoryIcon icon={category.icon} color={category.color}/><span>{category.label}</span>{category.key===value&&<Check className="geofence-category-check"/>}</button>)}
    </div>}
  </div>;
}
