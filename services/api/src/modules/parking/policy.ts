import {distanceMeters,validCoordinate} from '../nearby/provider.js';
export interface ParkingPoint {id:string;latitude:number|null;longitude:number|null;gps_valid:boolean;tracker_timestamp:Date|string|null;server_received_at:Date|string;speed:number|null;metadata?:Record<string,unknown>}
export const PARKING_POLICY={maxAgeSeconds:120,consecutive:3,hysteresisMeters:5};
export function pointQuality(p:ParkingPoint,now:Date,radius:number,policy=PARKING_POLICY){
 const gps=p.tracker_timestamp==null?NaN:+new Date(p.tracker_timestamp),received=+new Date(p.server_received_at);
 const accuracy=p.metadata?.accuracyMeters??p.metadata?.accuracy_meters??p.metadata?.accuracy;
 if(!p.gps_valid||!validCoordinate(p.latitude,p.longitude))return false;
 if(!Number.isFinite(gps)||!Number.isFinite(received)||+now-gps>policy.maxAgeSeconds*1000||+now-received>policy.maxAgeSeconds*1000||gps>+now+30000||received>+now+30000)return false;
 if(p.speed!=null&&(!Number.isFinite(Number(p.speed))||Number(p.speed)<0||Number(p.speed)>200))return false;
 if(accuracy!=null&&(!Number.isFinite(Number(accuracy))||Number(accuracy)<0||Number(accuracy)>radius))return false;
 return true;
}
export function classification(p:ParkingPoint,origin:{latitude:number;longitude:number},radius:number,policy=PARKING_POLICY){
 const distance=distanceMeters(origin.latitude,origin.longitude,p.latitude!,p.longitude!);
 const accuracy=Number(p.metadata?.accuracyMeters??p.metadata?.accuracy_meters??p.metadata?.accuracy??0);
 return {distance,outside:distance-accuracy>radius+policy.hysteresisMeters,inside:distance+accuracy<Math.max(0,radius-policy.hysteresisMeters)};
}
