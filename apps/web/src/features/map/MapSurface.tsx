import {useEffect,useMemo} from 'react';import {MapContainer,Marker,Polyline,Popup,TileLayer,Tooltip,useMap} from 'react-leaflet';import L from 'leaflet';import type {FleetVehicle,PlaybackPoint} from '../../types';import 'leaflet/dist/leaflet.css';
import {renderToStaticMarkup} from 'react-dom/server';
import {VehicleIcon} from '../vehicles/VehicleIcon';
import {VehiclePopup} from '../dashboard/VehiclePopup';
import {getVehicleIcon,getVehicleStatus} from '../../utils/vehicleIcons.js';
type Point={id:string;latitude:number|null;longitude:number|null;status?:string;label?:string;vehicleType?:string|null};
function Fit({points,selected,maxZoom=13}:{points:Point[];selected?:Point;maxZoom?:number}){
 const map=useMap();
 useEffect(()=>{
  const container=map.getContainer();let frame=0;
  const fit=()=>{
   // A mounted map may be hidden by the phone list view or fullscreen table.
   // Leaflet cannot project a flight with a zero-size viewport.
   if(!container.clientWidth||!container.clientHeight){map.stop();return}
   map.invalidateSize({animate:false,pan:false});
   if(selected?.latitude!=null&&selected.longitude!=null){
    map.setView([selected.latitude,selected.longitude],15,{animate:false});
    // Fitting is deferred to a frame; remeasure after it so Leaflet can keep
    // the card inside the viewport rather than undoing its initial auto-pan.
    map.eachLayer(layer=>{if(layer instanceof L.Popup)layer.update()});
    return;
   }
   const valid=points.filter(p=>p.latitude!=null&&p.longitude!=null);
   if(valid.length)map.fitBounds(L.latLngBounds(valid.map(p=>[p.latitude!,p.longitude!])),{padding:[34,34],maxZoom});
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)};
  schedule();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(schedule);observer?.observe(container);
  window.addEventListener('resize',schedule);
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',schedule)};
 },[map,points,selected,maxZoom]);
 return null;
}
function ResizeAwareMap(){const map=useMap();useEffect(()=>{let frame=0;const invalidate=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>map.invalidateSize({animate:false,pan:false}))};invalidate();const container=map.getContainer();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(invalidate);observer?.observe(container);window.addEventListener('resize',invalidate);return()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',invalidate)}},[map]);return null}
function markerIcon(type:string|null|undefined,status='UNREACHABLE',active=false){return L.divIcon({className:`fleet-marker-shell ${active?'active':''}`,html:renderToStaticMarkup(<VehicleIcon type={type} state={status as FleetVehicle['fleet_status']} size="md"/>),iconSize:[42,38],iconAnchor:[21,19]})}
function endpointIcon(kind:'start'|'end'){return L.divIcon({className:'route-endpoint-shell',html:`<span class="route-endpoint ${kind}">${kind==='start'?'S':'E'}</span>`,iconSize:[30,30],iconAnchor:[15,15]})}
// Stable React keys retain Leaflet markers; react-leaflet updates their
// position with setLatLng and changed icons with setIcon.
function FleetVehicleMarker({vehicle,selectedId,showPopup,onSelect}:{vehicle:FleetVehicle;selectedId:string|null;showPopup:boolean;onSelect:(id:string|null)=>void}){
 const status=getVehicleStatus(vehicle),heading=vehicle.heading??vehicle.course??0;
 const icon=useMemo(()=>getVehicleIcon(L,vehicle.vehicle_type,status,heading),[vehicle.vehicle_type,status,heading]);
 return <Marker position={[vehicle.latitude!,vehicle.longitude!]} icon={icon} bubblingMouseEvents={false} zIndexOffset={vehicle.id===selectedId?1000:0} eventHandlers={{click:()=>onSelect(vehicle.id===selectedId&&showPopup?null:vehicle.id)}}><Tooltip>{vehicle.vehicle_number}</Tooltip></Marker>;
}
export function FleetMap({vehicles,selectedId,onSelect,showPopup=true,onPopupClose,mapType='street'}:{vehicles:FleetVehicle[];selectedId:string|null;onSelect:(id:string|null)=>void;showPopup?:boolean;onPopupClose?:()=>void;mapType?:'street'|'satellite'}){const points=useMemo(()=>vehicles.map(v=>({id:v.id,latitude:v.latitude,longitude:v.longitude,status:v.fleet_status,label:v.vehicle_number,vehicleType:v.vehicle_type})),[vehicles]);const selected=points.find(p=>p.id===selectedId);const vehicle=vehicles.find(v=>v.id===selectedId);const popupPosition=useMemo(()=>selected?.latitude!=null&&selected.longitude!=null?[selected.latitude,selected.longitude] as [number,number]:null,[selected?.latitude,selected?.longitude]);return <MapContainer center={[22.8,79.1]} zoom={5} className="map"><ResizeAwareMap/><TileLayer key={mapType} attribution={mapType==='satellite'?'Tiles Â© Esri â€” Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community':'&copy; OpenStreetMap contributors'} url={mapType==='satellite'?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}/><Fit points={points} selected={selected}/>{vehicles.filter(v=>v.latitude!=null&&v.longitude!=null).map(v=><FleetVehicleMarker key={v.id} vehicle={v} selectedId={selectedId} showPopup={showPopup} onSelect={onSelect}/>)}{showPopup&&vehicle&&popupPosition&&<Popup key={vehicle.id} position={popupPosition} offset={[0,-24]} className="fleet-vehicle-popup" closeButton={false} closeOnClick={false} closeOnEscapeKey={false} minWidth={0} maxWidth={380} autoPanPaddingTopLeft={[12,112]} autoPanPaddingBottomRight={[12,12]}><VehiclePopup vehicle={vehicle} onClose={onPopupClose??(()=>onSelect(null))}/></Popup>}</MapContainer>}
export function PlaybackMap({points,index,position,vehicleType,mapType='street'}:{points:PlaybackPoint[];index:number;position?:{latitude:number;longitude:number};vehicleType?:string|null;mapType?:'street'|'satellite'}){
 const valid=useMemo(()=>points.filter((p):p is PlaybackPoint&{latitude:number;longitude:number}=>p.gps_valid&&p.latitude!=null&&p.longitude!=null),[points]);
 const active=points[index];
 const route=useMemo(()=>valid.map(p=>[p.latitude,p.longitude] as [number,number]),[valid]);
 const fitPoints=useMemo(()=>valid.map(p=>({id:p.id,latitude:p.latitude,longitude:p.longitude})),[valid]);
 const focus=position??(active?.gps_valid&&active.latitude!=null&&active.longitude!=null?{latitude:active.latitude,longitude:active.longitude}:undefined);
 const icon=useMemo(()=>markerIcon(vehicleType,active?.speed!=null&&active.speed>5?'RUNNING':active?.ignition===true?'IDLE':active?.ignition===false?'STOPPED':'ONLINE',true),[vehicleType,active?.speed,active?.ignition]);
 const first=valid[0],last=valid.at(-1);
 return <MapContainer center={first?[first.latitude,first.longitude]:[22.8,79.1]} zoom={13} className="map"><ResizeAwareMap/><TileLayer key={mapType} attribution={mapType==='satellite'?'Tiles Â© Esri â€” Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community':'&copy; OpenStreetMap contributors'} url={mapType==='satellite'?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}/><Fit points={fitPoints} maxZoom={17}/>{route.length>1&&<Polyline positions={route} pathOptions={{color:'#087ca7',weight:5,opacity:.85}}/>}{first&&<Marker position={[first.latitude,first.longitude]} icon={endpointIcon('start')}><Tooltip>Route start</Tooltip></Marker>}{last&&last.id!==first?.id&&<Marker position={[last.latitude,last.longitude]} icon={endpointIcon('end')}><Tooltip>Route end</Tooltip></Marker>}{focus&&<Marker zIndexOffset={1000} position={[focus.latitude,focus.longitude]} icon={icon}><Tooltip>Playback vehicle Â· {vehicleType||'vehicle'}</Tooltip></Marker>}</MapContainer>;
}
