import {Linking,Share} from 'react-native';
import {nearbyCategories,type NearbyCategory,type NearbyCenter,type NearbyPlace,type NearbyResult} from '../../../../packages/shared-types/src/nearby';
import {api} from '../../services/api/client';
import {requireOnline} from '../../services/api/mobile';
import {loadStreetPosition} from '../street-view/service';
import {useAuthStore} from '../../store/authStore';
export {nearbyCategories,nearbyCategoryIds} from '../../../../packages/shared-types/src/nearby';
export type {NearbyCategory,NearbyCenter,NearbyPlace,NearbyResult} from '../../../../packages/shared-types/src/nearby';

export async function loadNearby(vehicleId:string,category:NearbyCategory,radius:number,signal:AbortSignal):Promise<NearbyResult>{
 requireOnline();const session=useAuthStore.getState().sessionKey;
 if(!session)throw new Error('Sign in again to search nearby.');
 const {data}=await api.get<{data:NearbyResult}>(`/vehicles/${encodeURIComponent(vehicleId)}/nearby`,{params:{category,radius},signal});
 if(signal.aborted||useAuthStore.getState().sessionKey!==session)throw new Error('The session or vehicle selection changed.');
 return data.data;
}
export async function loadNearbyDetails(vehicleId:string,category:NearbyCategory,placeId:string,signal:AbortSignal){
 requireOnline();return (await api.get<{data:NearbyPlace}>(`/vehicles/${encodeURIComponent(vehicleId)}/nearby/details`,{params:{category,placeId},signal})).data.data;
}
export function nearbyGoogleUrl(category:NearbyCategory,point:NearbyCenter){
 if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)throw new Error('Invalid vehicle GPS coordinates.');
 return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nearbyCategories[category].query} near ${point.latitude},${point.longitude}`)}`;
}
export async function handleOpenNearbyInGoogleMaps(category:NearbyCategory,vehicleId:string,signal:AbortSignal,reviewStale:(point:NearbyCenter)=>Promise<boolean>){
 const session=useAuthStore.getState().sessionKey;
 const point=await loadStreetPosition(vehicleId,signal);
 if(point.stale&&!await reviewStale(point))return;
 if(signal.aborted||useAuthStore.getState().sessionKey!==session)return;
 requireOnline();
 try{await Linking.openURL(nearbyGoogleUrl(category,point));}
 catch{throw new Error('Could not open Google Maps or a browser. Check your connection and available apps, then retry.');}
}
// This handler has no URL-opening path. The first icon only changes internal navigation.
export function handleShowNearbyInApp(category:NearbyCategory,vehicle:{id:string;vehicle_number:string},navigate:(params:{vehicleId:string;vehicleNumber:string;category:NearbyCategory})=>void){
 navigate({vehicleId:vehicle.id,vehicleNumber:vehicle.vehicle_number,category});
}
const coordinates=(place:NearbyPlace)=>{
 if(!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude)||Math.abs(place.latitude)>90||Math.abs(place.longitude)>180)throw new Error('This place has no valid coordinates.');
 return `${place.latitude},${place.longitude}`;
};
export async function placeAction(action:'directions'|'call'|'share',place:NearbyPlace,center:NearbyCenter){
 const target=coordinates(place);
 if(action==='share'){await Share.share({message:[place.name,place.address,`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`].filter(Boolean).join('\n')});return;}
 if(action==='call'){
  const number=place.phone?.split(';')[0].replace(/[^+\d]/g,'');
  if(!number||!/^\+?\d{5,20}$/.test(number))throw new Error('No usable phone number was provided for this place.');
  try{await Linking.openURL(`tel:${number}`);}catch{throw new Error('No calling app is available.');}return;
 }
 requireOnline();
 const origin=coordinates({...place,latitude:center.latitude,longitude:center.longitude});
 const url=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(target)}&travelmode=driving`;
 try{await Linking.openURL(url);}catch{throw new Error('Could not open directions in Google Maps or a browser.');}
}
