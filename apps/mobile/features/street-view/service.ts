import {Linking} from 'react-native';
import {getLatestLocation} from '../../services/api/vehicles';
import {requireOnline} from '../../services/api/mobile';
import {useAuthStore} from '../../store/authStore';
import {useLiveVehicleStore} from '../../store/liveVehicleStore';
import type {Location} from '../../types/models';

export interface StreetPosition {latitude:number;longitude:number;recordedAt:string|null;stale:boolean;timeUncertain:boolean}
export function validGps(id:string,point:Location|null|undefined):point is Location&{latitude:number;longitude:number}{
 return Boolean(point&&(!point.vehicle_id||point.vehicle_id===id)&&point.gps_valid===true&&
  typeof point.latitude==='number'&&Number.isFinite(point.latitude)&&Math.abs(point.latitude)<=90&&
  typeof point.longitude==='number'&&Number.isFinite(point.longitude)&&Math.abs(point.longitude)<=180&&
  !(point.latitude===0&&point.longitude===0));
}
const gpsTime=(point:Location)=>Date.parse(point.tracker_timestamp??'');
export function selectStreetPosition(id:string,fetched:Location|null,live?:Location,now=Date.now()):StreetPosition{
 if(fetched?.vehicle_id&&fetched.vehicle_id!==id)throw new Error('The location does not belong to the selected vehicle. Retry GPS.');
 let point=validGps(id,fetched)?fetched:null;
 // Only a newer GPS fix can replace the freshly authorized API result. A newer
 // heartbeat receipt must not make cached, old coordinates look fresh.
 if(point&&validGps(id,live)&&Number.isFinite(gpsTime(live))&&(!point||!Number.isFinite(gpsTime(point))||gpsTime(live)>gpsTime(point)))point=live;
 if(!point)throw new Error('No valid recorded GPS position is available for this vehicle. Street View cannot use a tower area or the phone’s location.');
 const timestamp=gpsTime(point),uncertain=!Number.isFinite(timestamp)||timestamp>now+60000;
 return {latitude:point.latitude,longitude:point.longitude,recordedAt:Number.isFinite(timestamp)?point.tracker_timestamp!:null,
  stale:uncertain||now-timestamp>600000,timeUncertain:uncertain};
}
export async function loadStreetPosition(id:string,signal:AbortSignal){
 requireOnline();const session=useAuthStore.getState().sessionKey;
 if(!session)throw new Error('Sign in again to load this vehicle’s GPS position.');
 const point=await getLatestLocation(id,signal);
 if(signal.aborted||useAuthStore.getState().sessionKey!==session)throw new Error('The session or selected vehicle changed.');
 // Never fall back to cached data after an API authorization/network failure.
 return selectStreetPosition(id,point,useLiveVehicleStore.getState().byVehicleId[id]);
}
export function googleLocationUrl(point:StreetPosition,mode:'street'|'map'){
 if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)throw new Error('Invalid GPS coordinates.');
 const coordinates=encodeURIComponent(`${point.latitude},${point.longitude}`);
 return mode==='street'?`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coordinates}`:
  `https://www.google.com/maps/search/?api=1&query=${coordinates}`;
}
export async function openGoogleLocation(point:StreetPosition,mode:'street'|'map'){
 requireOnline();
 try{await Linking.openURL(googleLocationUrl(point,mode));return mode;}
 catch{
  if(mode==='street'){try{requireOnline();await Linking.openURL(googleLocationUrl(point,'map'));return 'map';}catch{/* Report failure without changing the target location. */}}
  throw new Error('Could not open Google Maps or a browser. Check your connection and available apps, then retry.');
 }
}
