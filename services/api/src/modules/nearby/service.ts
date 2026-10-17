import {nearbyCategories,type NearbyCategory,type NearbyCenter,type NearbyPlace,type NearbyResult} from '@fleet/shared-types';
import {env} from '../../config/env.js';
import {AppError} from '../../lib/errors.js';
import {findVehicle,latestLocation} from '../vehicles/repository.js';
import {parseDetails,parsePlaces,providerRequest,validCoordinate} from './provider.js';

type CacheItem={expires:number;value:unknown};
const cache=new Map<string,CacheItem>(),pending=new Map<string,Promise<unknown>>();
let starts:number[]=[];
async function cached<T>(key:string,work:()=>Promise<T>):Promise<T>{
 const now=Date.now();for(const [id,item] of cache)if(item.expires<=now)cache.delete(id);
 const hit=cache.get(key);if(hit)return hit.value as T;
 const existing=pending.get(key);if(existing)return existing as Promise<T>;
 starts=starts.filter(time=>time>now-1000);
 if(starts.length>=4||pending.size>=4)throw new AppError(429,'PLACES_BUSY','Nearby search is busy. Please wait a moment and retry.');
 starts.push(now);
 const task=work().then(value=>{if(cache.size>=200)cache.delete(cache.keys().next().value!);cache.set(key,{value,expires:Date.now()+300000});return value}).finally(()=>pending.delete(key));
 pending.set(key,task);return task;
}
export function vehicleCenter(point:Record<string,unknown>|undefined,vehicleId:string,now=Date.now()):NearbyCenter{
 if(!point||point.vehicle_id!==vehicleId||point.gps_valid!==true||!validCoordinate(point.latitude,point.longitude))throw new AppError(422,'GPS_UNAVAILABLE','This vehicle has no valid recorded GPS position. Nearby cannot use a cell tower or your phone’s location.');
 const raw=point.tracker_timestamp,timestamp=raw instanceof Date?raw.getTime():typeof raw==='string'?Date.parse(raw):NaN;
 const timeUncertain=!Number.isFinite(timestamp)||timestamp>now+60000;
 return {latitude:point.latitude as number,longitude:point.longitude as number,recordedAt:Number.isFinite(timestamp)?new Date(timestamp).toISOString():null,stale:timeUncertain||now-timestamp>600000,timeUncertain};
}
const permitted=new Map<string,{expires:number;places:NearbyPlace[]}>();
const scopeKey=(actor:string,vehicle:string,category:NearbyCategory)=>`${actor}:${vehicle}:${category}`;
export async function nearbySearch(actor:string,vehicle:string,category:NearbyCategory,radius:number):Promise<NearbyResult>{
 // Ownership and current device assignment are checked before every cache access.
 const result=await latestLocation(vehicle,actor),center=vehicleCenter(result.rows[0],vehicle),mapping=nearbyCategories[category];
 const places=await cached(`search:${category}:${radius}:${center.latitude}:${center.longitude}`,async()=>{
  const body=await providerRequest('places',{categories:mapping.provider,filter:`circle:${center.longitude},${center.latitude},${radius}`,bias:`proximity:${center.longitude},${center.latitude}`,limit:'20',lang:'en',...(mapping.name?{name:mapping.name}:{})},env.GEOAPIFY_API_KEY);
  return parsePlaces(body,category,center.latitude,center.longitude,radius);
 });
 for(const [key,value] of permitted)if(value.expires<=Date.now())permitted.delete(key);
 if(permitted.size>=200)permitted.delete(permitted.keys().next().value!);
 permitted.set(scopeKey(actor,vehicle,category),{places,expires:Date.now()+300000});
 return {category,center,places,radius,attribution:'Powered by Geoapify · © OpenStreetMap contributors',
  limitation:category==='cng'?'CNG search matches fuel stations named CNG. Untagged or differently named CNG stations may be missing. Confirm fuel availability with the station.':category==='petrol'?'Fuel-station results may include diesel or other fuels. Confirm petrol availability with the station.':null};
}
export async function nearbyDetails(actor:string,vehicle:string,category:NearbyCategory,id:string){
 if(!(await findVehicle(vehicle,actor)).rows[0])throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');
 const allowed=permitted.get(scopeKey(actor,vehicle,category)),place=allowed&&allowed.expires>Date.now()?allowed.places.find(p=>p.id===id):null;
 if(!place)throw new AppError(404,'PLACE_NOT_FOUND','This result expired or is not part of this vehicle’s nearby search. Refresh the results.');
 return cached(`details:${id}`,async()=>parseDetails(await providerRequest('place-details',{id,features:'details',lang:'en'},env.GEOAPIFY_API_KEY),place)).then(details=>({...place,phone:details.phone,openingHours:details.openingHours}));
}
