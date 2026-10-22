import type {LiveMapData} from '@fleet/shared-types';
import {query} from '../../db/pool.js';
import {env} from '../../config/env.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';
import {findVehicle} from './repository.js';
import {mobileHistorySql} from '../reports/mobile.js';
import {mobileDailyRows,type MobilePoint} from '../reports/mobile-calculations.js';
import {localDateKey,validPosition} from '../reports/calculations.js';
import {playbackPoints} from '../playback/repository.js';
const numeric=(value:unknown)=>value!=null&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
export function livePath(points:MobilePoint[]):LiveMapData['path']{
 const paths:LiveMapData['path']=[];let active:LiveMapData['path'][number]=[],previous:MobilePoint|undefined;
 const close=()=>{if(active.length>1)paths.push(active);active=[]};
 for(const p of points){
  if(!validPosition(p)||Math.abs(p.latitude!)>90||Math.abs(p.longitude!)>180||(p.latitude===0&&p.longitude===0)){close();previous=undefined;continue}
  const coordinate={latitude:p.latitude!,longitude:p.longitude!};
  const connected=previous&&previous.device_id===p.device_id&&p.has_distance_pair&&Number(p.segment_distance_km)>0;
  const same=previous&&previous.device_id===p.device_id&&previous.latitude===p.latitude&&previous.longitude===p.longitude;
  if(!connected&&!same)close();if(!active.length&&connected)active.push({latitude:previous!.latitude!,longitude:previous!.longitude!});
  if(!same||!active.length)active.push(coordinate);previous=p;
 }
 close();return paths;
}
/** Read-only daily metrics; absence of fixes or ignition never becomes a zero. */
export async function liveMapData(actor:string,id:string,now=new Date()):Promise<LiveMapData>{
 const vehicle=(await findVehicle(id,actor)).rows[0];if(!vehicle)throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');
 const timeZone='Asia/Kolkata',day=localDateKey(now,timeZone),start=new Date(`${day}T00:00:00+05:30`),end=new Date(+now+1);
 const history=await query<MobilePoint>(mobileHistorySql,[actor,id,start,end,timeZone,env.MOVEMENT_THRESHOLD_KPH]);
 if(history.rows.length>250000)throw new AppError(413,'HISTORY_TOO_LARGE','Today has too many packets to summarize. Use a shorter playback range.');
 const summary=mobileDailyRows(history.rows,timeZone,env.MOVEMENT_THRESHOLD_KPH,env.OFFLINE_TIMEOUT_SECONDS,env.NO_SIGNAL_TIMEOUT_MINUTES*60)[0];
 const result:LiveMapData={vehicleId:id,generatedAt:now.toISOString(),day,timeZone,todayKm:summary?.km??null,totalKm:numeric('odometer' in vehicle?vehicle.odometer:null),todayRunningSeconds:summary?.runningSeconds??null,todayIdleSeconds:summary?.idleSeconds??null,todayStoppedSeconds:summary?.stoppedSeconds??null,avgSpeed:summary?.avgSpeed??null,maxSpeed:summary?.maxSpeed??null,fromLastStopKm:null,fromLastStopSeconds:null,path:[],pathUnavailable:null};
 if(history.rows.length<=5000)result.path=livePath(history.rows);else result.pathUnavailable='Today path exceeds 5,000 packets. Open Play Back for the recorded history.';
 const stop=(await query<{observed_at:Date;device_id:string}>(`${userScopeCte} SELECT COALESCE(l.tracker_timestamp,l.server_received_at) observed_at,l.device_id FROM locations l JOIN vehicles v ON v.id=l.vehicle_id JOIN user_scope s ON s.id=v.owner_id JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.device_id=l.device_id AND a.unassigned_at IS NULL WHERE v.id=$2 AND l.server_received_at>=a.assigned_at AND l.gps_valid AND l.position IS NOT NULL AND l.latitude BETWEEN -90 AND 90 AND l.longitude BETWEEN -180 AND 180 AND NOT(l.latitude=0 AND l.longitude=0) AND l.ignition=false AND l.speed>=0 AND l.speed<=$3 AND COALESCE(l.tracker_timestamp,l.server_received_at)<=$4 ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at) DESC,l.server_received_at DESC,l.id DESC LIMIT 1`,[actor,id,env.MOVEMENT_THRESHOLD_KPH,now])).rows[0];
 if(stop&&+now-+new Date(stop.observed_at)<=31*86400000){
  const route=await playbackPoints(actor,id,new Date(stop.observed_at),end,250001,false);
  const points=route.rows as Array<{device_id:string;tracker_timestamp:Date|null;server_received_at:Date;cumulative_distance_km:number}>;
  const last=points.at(-1);
  if(points.length<=250000&&last&&points.every(p=>p.device_id===stop.device_id)){
   result.fromLastStopSeconds=Math.max(0,(+new Date(last.tracker_timestamp??last.server_received_at)-+new Date(stop.observed_at))/1000);
   result.fromLastStopKm=points.length>1?numeric(last.cumulative_distance_km):null;
  }
 }
 // No extrapolated times after the last observation; state durations may be unavailable.
 return result;
}
