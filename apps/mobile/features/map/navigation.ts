import {Linking,Platform} from 'react-native';
import type {Coordinate} from './LeafletMap';
type Destination={latitude?:number|null;longitude?:number|null};
export function validDestination(point?:Destination|null):point is Coordinate{
 return typeof point?.latitude==='number'&&typeof point.longitude==='number'&&Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)&&Math.abs(point.latitude)<=90&&Math.abs(point.longitude)<=180&&(point.latitude!==0||point.longitude!==0);
}
export function vehicleDirectionsUrl(point?:Destination|null){
 if(!validDestination(point))throw new Error('This vehicle has no valid GPS coordinates for directions.');
 return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${point.latitude},${point.longitude}`)}&travelmode=driving`;
}
export async function openVehicleDirections(point?:Destination|null){
 const fallback=vehicleDirectionsUrl(point),target=`${point!.latitude},${point!.longitude}`;
 const native=Platform.OS==='android'?`google.navigation:q=${encodeURIComponent(target)}&mode=d`:`comgooglemaps://?daddr=${encodeURIComponent(target)}&directionsmode=driving`;
 // Opening directly avoids iOS scheme-query / Android package-visibility restrictions.
 try{await Linking.openURL(native);return}catch{/* Try the universal Maps link. */}
 try{await Linking.openURL(fallback)}catch{throw new Error('Could not open Google Maps or a browser. Please try again.')}
}
