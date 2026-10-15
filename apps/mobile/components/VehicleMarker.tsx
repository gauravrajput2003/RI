import {memo} from 'react';
import {SvgXml} from 'react-native-svg';
import {Marker} from '../features/map/LeafletMap';
import {STATUS_COLORS,ICON_SIZE,getVehicleStatus,getVehicleSvg,normalizeType} from '../utils/vehicleIcons';
export type MapVehicle={id:string;vehicle_number?:string;vehicle_type?:string|null;type?:string|null;latitude:number;longitude:number;heading?:number|null;course?:number|null;status?:string;state?:string;speed?:number|null;ignition?:boolean|null;lastSeen?:string|null};
function visual(vehicle:MapVehicle){
 const type=normalizeType(vehicle.type??vehicle.vehicle_type),status=getVehicleStatus(vehicle);
 const angle=Number(vehicle.heading??vehicle.course??0),heading=Number.isFinite(angle)?((angle%360)+360)%360:0;
 return {type,status,heading};
}
export const VehicleMarker=memo(function VehicleMarker({vehicle,onPress,selected=false}:{vehicle:MapVehicle;onPress:()=>void;selected?:boolean}){
 const {type,status,heading}=visual(vehicle),[width,height]=ICON_SIZE[type],svg=getVehicleSvg(type,status);
 const title=`${vehicle.vehicle_number??vehicle.id} · ${status} · ${vehicle.speed==null?'Speed unavailable':`${Math.round(vehicle.speed)} km/h`}`;
 // Leaflet renders this same XML directly in its WebView. Unlike native Google
 // map snapshots, it needs no tracksViewChanges timers or repeated rasterizing.
 return <Marker coordinate={{latitude:vehicle.latitude,longitude:vehicle.longitude}} rotation={heading} pinColor={STATUS_COLORS[status].main} svg={svg} iconSize={[width,height]} zIndexOffset={selected?1000:0} title={title} onPress={onPress}><SvgXml xml={svg} width={width} height={height}/></Marker>;
},(previous,next)=>{
 const a=previous.vehicle,b=next.vehicle,va=visual(a),vb=visual(b);
 return a.id===b.id&&a.latitude===b.latitude&&a.longitude===b.longitude&&a.vehicle_number===b.vehicle_number&&a.speed===b.speed&&va.type===vb.type&&va.status===vb.status&&va.heading===vb.heading&&previous.selected===next.selected&&previous.onPress===next.onPress;
});
