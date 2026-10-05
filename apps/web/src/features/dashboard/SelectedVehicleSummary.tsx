import {useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {ChevronDown,ChevronUp,Clock3,Gauge,MapPin,MoreVertical,Navigation,PauseCircle,Radio,Route,Timer,TrendingUp,X} from 'lucide-react';
import type {FleetVehicle} from '../../types';
import {coordinates,dateTime,speed} from '../../lib/format';
import {PermissionAction} from '../permissions/PermissionAction';
import {PERMISSIONS} from '../../../../../packages/shared-types/src/permissions';

const duration=(value:number|null)=>value==null?'Unavailable':`${Math.floor(value/3600).toString().padStart(2,'0')}:${Math.floor(value%3600/60).toString().padStart(2,'0')}`;
const distance=(value:number|null)=>value==null?'Unavailable':`${Number(value).toFixed(2)} Km`;
const statusLabel=(value:string)=>value.charAt(0)+value.slice(1).toLowerCase();

function Metric({icon,label,value,tone}:{icon:ReactNode;label:string;value:ReactNode;tone:string}){
 return <div className={`summary-metric metric-${tone}`}>{icon}<span>{label}</span><strong>{value}</strong></div>;
}

export function SelectedVehicleSummary({vehicle,onClose}:{vehicle:FleetVehicle;onClose:()=>void}){
 const [expanded,setExpanded]=useState(false),[more,setMore]=useState(false);
 return <section className={`vehicle-summary ${expanded?'expanded':''}`} aria-label={`${vehicle.vehicle_number} details`}>
  <button type="button" className="summary-expand-toggle" aria-label={expanded?'Collapse vehicle details':'Expand vehicle details'} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?<ChevronDown/>:<ChevronUp/>}</button>
  <header className="summary-title">
   <strong>{vehicle.vehicle_number}</strong>
   <div className="summary-actions"><PermissionAction permission={PERMISSIONS.playbackView}><Link className="summary-action" to={`/dashboard/playback?vehicleId=${encodeURIComponent(vehicle.id)}`}>History</Link></PermissionAction><button type="button" className="summary-action" onClick={()=>setMore(value=>!value)} aria-expanded={more}>More<MoreVertical/></button><button type="button" className="summary-close" onClick={onClose} aria-label="Clear selected vehicle"><X/></button></div>
  </header>
  <div className="summary-metric-row summary-primary">
   <Metric icon={<Gauge/>} label="Speed" value={speed(vehicle.speed)} tone="orange"/>
   <Metric icon={<Radio/>} label="Status" value={statusLabel(vehicle.fleet_status)} tone="blue"/>
   <Metric icon={<Route/>} label="Distance" value={distance(vehicle.today_distance_km)} tone="purple"/>
   <Metric icon={<Timer/>} label="Running Duration" value={duration(vehicle.today_running_seconds)} tone="green"/>
   <Metric icon={<PauseCircle/>} label="Stoppage Duration" value={duration(vehicle.today_stopped_seconds)} tone="pink"/>
   <Metric icon={<Gauge/>} label="Avg Speed" value={speed(vehicle.today_avg_speed)} tone="violet"/>
  </div>
  {expanded&&<>
   <div className="summary-metric-row summary-secondary">
    <Metric icon={<MapPin/>} label="Location" value={coordinates(vehicle.latitude,vehicle.longitude)} tone="pink"/>
    <Metric icon={<Clock3/>} label="Since" value={dateTime(vehicle.status_since_at)} tone="blue"/>
    <Metric icon={<Navigation/>} label="Distance from Last Stop" value={distance(vehicle.distance_from_last_stop_km)} tone="purple"/>
    <Metric icon={<Timer/>} label="Duration from Last Stop" value={duration(vehicle.duration_from_last_stop_seconds)} tone="green"/>
    <Metric icon={<PauseCircle/>} label="Duration At Last Stop" value={duration(vehicle.duration_at_last_stop_seconds)} tone="pink"/>
    <Metric icon={<TrendingUp/>} label="Max Speed" value={speed(vehicle.today_max_speed)} tone="red"/>
   </div>
   <div className="summary-address"><Navigation/><span>Address</span><strong>{vehicle.address||'Unavailable'}</strong></div>
  </>}
  {more&&<div className="summary-more"><span>Last update</span><strong>{dateTime(vehicle.server_received_at)}</strong><span>Owner</span><strong>{vehicle.owner_email}</strong></div>}
 </section>;
}
