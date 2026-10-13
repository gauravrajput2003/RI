import {AddressAttribution} from './AddressAttribution';
import {X} from 'lucide-react';
import type {FleetVehicle} from '../../types';
import {coordinates,dateTime,speed} from '../../lib/format';
const km=(value:number|null)=>value==null?'Unavailable':`${Number(value).toFixed(1)} km`;
export function VehiclePopup({vehicle,onClose}:{vehicle:FleetVehicle;onClose?:()=>void}){
 const fields=[
  {label:'Speed',icon:'speed.png',value:speed(vehicle.speed)},
  {label:'Today KM',icon:'km.png',value:km(vehicle.today_distance_km)},
  {label:'Status',icon:'status.png',value:vehicle.fleet_status||'Unavailable'},
  {label:'Since',icon:'since.png',value:dateTime(vehicle.status_since_at)},
  {label:'Location',icon:'location.png',value:coordinates(vehicle.latitude,vehicle.longitude)},
  {label:'Last Update',icon:'time.png',value:dateTime(vehicle.server_received_at)},
 ];
 return <article className="map-popup" aria-label={`${vehicle.vehicle_number} map details`} onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onPointerDown={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose?.()}}}>
  <header><strong>{vehicle.vehicle_number}</strong>{onClose&&<button type="button" onClick={onClose} aria-label="Close vehicle details"><X/></button>}</header>
  <div className="map-popup-fields">
   {fields.map(field=><div className="map-popup-field" key={field.label}><img src={`/assets/Map/${field.icon}`} alt=""/><span>{field.label}</span><b>{field.value}</b></div>)}
   <div className="map-popup-field wide"><img src="/assets/Map/address.png" alt=""/><span>Address</span><b>{vehicle.address||'Unavailable'}<AddressAttribution value={vehicle.address_attribution}/></b></div>
  </div>
 </article>;
}
