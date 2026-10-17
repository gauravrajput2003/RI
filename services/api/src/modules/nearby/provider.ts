import {nearbyCategories,type NearbyCategory,type NearbyPlace} from '@fleet/shared-types';
import {AppError} from '../../lib/errors.js';

const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown,max=500)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):null;
export const validCoordinate=(lat:unknown,lon:unknown):lat is number=>typeof lat==='number'&&typeof lon==='number'&&Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0);
export function distanceMeters(lat:number,lon:number,a:number,b:number){
 const radians=(n:number)=>n*Math.PI/180,dlat=radians(a-lat),dlon=radians(b-lon);
 const h=Math.sin(dlat/2)**2+Math.cos(radians(lat))*Math.cos(radians(a))*Math.sin(dlon/2)**2;
 return Math.round(12742000*Math.asin(Math.min(1,Math.sqrt(h))));
}
export function parsePlaces(body:unknown,category:NearbyCategory,lat:number,lon:number,radius:number):NearbyPlace[]{
 const features=record(body).features;
 if(!Array.isArray(features))throw new AppError(502,'PLACES_INVALID','The places provider returned an invalid response. Please retry.');
 const unique=new Map<string,NearbyPlace>();
 for(const feature of features.slice(0,60)){
  const p=record(record(feature).properties),id=text(p.place_id,600);
  if(!id||!validCoordinate(p.lat,p.lon))continue;
  const latitude=p.lat as number,longitude=p.lon as number,distance=distanceMeters(lat,lon,latitude,longitude);
  if(distance>radius)continue;
  unique.set(id,{id,name:text(p.name)??text(p.address_line1)??nearbyCategories[category].label,latitude,longitude,
   address:text(p.formatted,1500)??text(p.address_line2),type:nearbyCategories[category].label,distanceMeters:distance,
   phone:text(record(p.contact).phone,100),openingHours:text(p.opening_hours)});
 }
 return [...unique.values()].sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,20);
}
export function parseDetails(body:unknown,place:NearbyPlace):NearbyPlace{
 const features=record(body).features;
 if(!Array.isArray(features))throw new AppError(502,'PLACES_INVALID','Place details are unavailable. Retry later.');
 const p=features.map(f=>record(record(f).properties)).find(p=>p.place_id===place.id||(p.feature_type==='details'&&!p.place_id));
 if(!p)return place;
 // Retain the search's identity and coordinates; details may contain polygon geometry.
 return {...place,phone:text(record(p.contact).phone,100)??place.phone,openingHours:text(p.opening_hours)??place.openingHours};
}
export async function providerRequest(path:'places'|'place-details',params:Record<string,string>,key:string,fetcher:typeof fetch=fetch){
 if(!key)throw new AppError(503,'PLACES_NOT_CONFIGURED','Nearby places are not configured. Ask your administrator to configure the server Geoapify key.');
 const url=new URL(`https://api.geoapify.com/v2/${path}`);url.search=new URLSearchParams({...params,apiKey:key}).toString();
 try{
  const response=await fetcher(url,{signal:AbortSignal.timeout(8000)});
  if(response.status===429)throw new AppError(429,'PLACES_RATE_LIMITED','The places provider limit was reached. Please wait and retry.');
  if(response.status===401||response.status===403)throw new AppError(503,'PLACES_CONFIGURATION','The server places key is unavailable or restricted. Contact your administrator.');
  if(!response.ok)throw new AppError(502,'PLACES_UNAVAILABLE','The places provider is temporarily unavailable. Please retry.');
  return await response.json() as unknown;
 }catch(error){
  if(error instanceof AppError)throw error;
  // Never propagate fetch errors containing credential-bearing URLs into logs.
  throw new AppError(502,'PLACES_UNAVAILABLE','The places provider could not be reached. Please retry.');
 }
}
