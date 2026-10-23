import {logger} from '../../lib/logger.js';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {PERMISSIONS,type ParkingInput,type ParkingMode} from '@fleet/shared-types';
import {hasPermissionForUser} from '../authorization/permissions.js';
import {query,transaction} from '../../db/pool.js';
import {env} from '../../config/env.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';
import {pointQuality,classification,type ParkingPoint} from './policy.js';
import {enqueueParkingPush} from '../mobile-push/service.js';

export const parkingPolicy=()=>({maxAgeSeconds:env.PARKING_GPS_MAX_AGE_SECONDS??120,consecutive:env.PARKING_CONSECUTIVE_READINGS??3,hysteresisMeters:env.PARKING_HYSTERESIS_METERS??5});
interface Vehicle {id:string;owner_id:string;vehicle_number:string;active:boolean;device_id:string|null;assignment_id:string|null;device_active:boolean|null;device_owner:string|null;last_seen_at:Date|null;assignment_count:number}
export interface ParkingRow {vehicle_id:string;owner_id:string;device_id:string;assignment_id:string;enabled:boolean;version:number;activation_id:string;latitude:number;longitude:number;reference_at:Date;activated_at:Date;radius_m:number;reference_accuracy_m:number|null;repeat_minutes:number;boundary_state:'inside'|'outside'|'unknown';outside_count:number;inside_count:number;cursor_at:Date;cursor_id:string;last_gps_at:Date|null;last_point:ParkingPoint|null;last_distance_m:number|null;quality_ok:boolean;movement_id:string|null;last_movement_at:Date|null;last_alert_at:Date|null;alert_sequence:string}
async function scopedVehicle(client:PoolClient,actor:string,id:string,lock=false):Promise<Vehicle>{
 const row=(await client.query<Vehicle>(`${userScopeCte} SELECT v.id,v.owner_id,v.vehicle_number,v.active,
  a.id AS assignment_id,a.device_id,d.active AS device_active,d.owner_id AS device_owner,d.last_seen_at,
  (SELECT count(*)::int FROM vehicle_device_assignments WHERE vehicle_id=v.id AND unassigned_at IS NULL) assignment_count
 FROM vehicles v JOIN user_scope scope ON scope.id=v.owner_id
 LEFT JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.unassigned_at IS NULL
 LEFT JOIN devices d ON d.id=a.device_id WHERE v.id=$2${lock?' FOR UPDATE OF v':''}`,[actor,id])).rows[0];
 if(!row)throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');return row;
}
function assignmentReady(v:Vehicle,p?:ParkingRow){return v.active&&v.assignment_count===1&&v.device_active===true&&v.device_owner===v.owner_id&&Boolean(v.device_id)&&(!p||(p.device_id===v.device_id&&p.assignment_id===v.assignment_id&&p.owner_id===v.owner_id));}
function online(v:Vehicle,now:Date){return v.last_seen_at!=null&&+now-+new Date(v.last_seen_at)<=parkingPolicy().maxAgeSeconds*1000;}
async function latest(client:PoolClient,v:Vehicle){return (await client.query<ParkingPoint>(`SELECT l.id,l.latitude,l.longitude,l.gps_valid,l.tracker_timestamp,l.server_received_at,l.speed,l.metadata
 FROM locations l JOIN vehicle_device_assignments a ON a.id=$3 AND a.device_id=l.device_id AND a.vehicle_id=l.vehicle_id
 WHERE l.vehicle_id=$1 AND l.device_id=$2 AND l.server_received_at>=a.assigned_at
 ORDER BY l.server_received_at DESC,l.id DESC LIMIT 1`,[v.id,v.device_id,v.assignment_id])).rows[0];}
const iso=(d:Date|string|null)=>d==null?null:new Date(d).toISOString();
export async function parkingStatus(actor:string,id:string,now=new Date()):Promise<ParkingMode>{
 return transaction(async client=>{
  const v=await scopedVehicle(client,actor,id),saved=(await client.query<ParkingRow>('SELECT * FROM parking_modes WHERE vehicle_id=$1',[id])).rows[0];
  const p=saved?.owner_id===v.owner_id?saved:undefined;
  const fix=assignmentReady(v)?await latest(client,v):undefined;
  const available=assignmentReady(v)&&online(v,now)&&Boolean(fix&&pointQuality(fix,now,p?.radius_m??20,parkingPolicy()));
  const monitoring=Boolean(p?.enabled&&assignmentReady(v,p)&&online(v,now)&&p.quality_ok&&p.last_point&&pointQuality(p.last_point,now,p.radius_m,parkingPolicy()));
  const pushRegistered=Boolean((await client.query(`SELECT 1 FROM mobile_push_devices d WHERE d.user_id=$1 AND d.enabled AND d.expo_token IS NOT NULL
   AND EXISTS(SELECT 1 FROM refresh_tokens t WHERE t.user_id=d.user_id AND t.token_hash=d.refresh_token_hash AND t.revoked_at IS NULL AND t.expires_at>now())
   AND NOT EXISTS(SELECT 1 FROM mobile_vehicle_notification_preferences p WHERE p.user_id=$1 AND p.vehicle_id=$2 AND p.muted) LIMIT 1`,[actor,id])).rows[0]);
  const pushAvailable=pushRegistered&&await hasPermissionForUser(actor,PERMISSIONS.notificationsView);
  const history=(await client.query<ParkingMode['history'][number]>(`SELECT id,event_type AS "eventType",message,occurred_at AS "occurredAt",metadata FROM notification_history WHERE vehicle_id=$1 AND event_type IN ('PARKING_MOVEMENT','PARKING_REMINDER','PARKING_RETURNED') AND metadata->>'ownerId'=$2 ORDER BY occurred_at DESC,id DESC LIMIT 20`,[id,v.owner_id])).rows;
  return {vehicleId:id,vehicleNumber:v.vehicle_number,enabled:p?.enabled??false,version:saved?.version??null,radius:p?.radius_m??20,repeatMinutes:p?.repeat_minutes??1,
   activatedAt:iso(p?.activated_at??null),referenceAt:iso(p?.reference_at??null),reference:p&&p.owner_id===v.owner_id?{latitude:p.latitude,longitude:p.longitude}:null,
   boundaryState:p?.boundary_state??'unknown',lastEvaluatedAt:iso(p?.last_gps_at??null),distanceMeters:p?.last_distance_m??null,monitoring,
   pushAvailable,canEnable:available,message:p?.enabled?(monitoring?'Monitoring fresh GPS readings.':'Monitoring paused: fresh, reliable GPS and the original assigned tracker are required.'):(available?'Ready to capture the latest vehicle GPS position.':'A fresh, valid GPS position from one active assigned tracker is required.'),history};
 });
}
async function cancelQueued(client:PoolClient,id:string){await client.query("UPDATE mobile_push_outbox SET cancelled_at=now(),last_error='Parking configuration changed' WHERE vehicle_id=$1 AND source='parking' AND sent_at IS NULL AND cancelled_at IS NULL",[id]);}
export async function saveParking(actor:string,id:string,input:ParkingInput,now=new Date()){
 await transaction(async client=>{
  const v=await scopedVehicle(client,actor,id,true),p=(await client.query<ParkingRow>('SELECT * FROM parking_modes WHERE vehicle_id=$1 FOR UPDATE',[id])).rows[0];
  const owned=p?.owner_id===v.owner_id?p:undefined;
  if(!p&&!input.enabled)return;
  if(owned&&owned.enabled===input.enabled&&(!input.enabled||(owned.radius_m===input.radius&&owned.repeat_minutes===input.repeatMinutes)))return;
  if((p?.version??null)!==input.expectedVersion)throw new AppError(409,'PARKING_CHANGED','Parking Mode changed. Refresh before saving.');
  if(!input.enabled){
   if(p)await client.query('UPDATE parking_modes SET enabled=false,version=version+1,updated_by=$2,updated_at=$3 WHERE vehicle_id=$1',[id,actor,now]);
  }else if(owned?.enabled){
   if(owned.reference_accuracy_m!=null&&owned.reference_accuracy_m>input.radius)throw new AppError(409,'PARKING_ACCURACY','The saved parking reference is not accurate enough for this radius. Disable and enable again with a more precise GPS fix.');
   if(!assignmentReady(v,owned))throw new AppError(409,'PARKING_ASSIGNMENT_CHANGED','Tracker assignment changed. Disable Parking Mode and enable it again with a fresh position.');
   await client.query("UPDATE parking_modes SET radius_m=$2,repeat_minutes=$3,version=version+1,boundary_state='unknown',outside_count=0,inside_count=0,movement_id=NULL,last_alert_at=NULL,updated_by=$4,updated_at=$5 WHERE vehicle_id=$1",[id,input.radius,input.repeatMinutes,actor,now]);
  }else{
   if(!assignmentReady(v))throw new AppError(409,'PARKING_DEVICE_UNAVAILABLE','A single active tracker belonging to this vehicle must be assigned.');
   const point=await latest(client,v);
   if(!online(v,now)||!point||!pointQuality(point,now,input.radius,parkingPolicy()))throw new AppError(409,'PARKING_GPS_UNAVAILABLE','A fresh, valid GPS position is required. Parking Mode was not enabled.');
   await client.query(`INSERT INTO parking_modes(vehicle_id,owner_id,device_id,assignment_id,enabled,activation_id,latitude,longitude,reference_at,activated_at,radius_m,repeat_minutes,cursor_at,cursor_id,last_gps_at,last_point,last_distance_m,updated_by,reference_accuracy_m)
    VALUES($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10,$11,$12,$13,$8,$14,0,$15,$16)
    ON CONFLICT(vehicle_id) DO UPDATE SET owner_id=EXCLUDED.owner_id,device_id=EXCLUDED.device_id,assignment_id=EXCLUDED.assignment_id,enabled=true,version=parking_modes.version+1,activation_id=EXCLUDED.activation_id,
    reference_accuracy_m=EXCLUDED.reference_accuracy_m,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,reference_at=EXCLUDED.reference_at,activated_at=EXCLUDED.activated_at,radius_m=EXCLUDED.radius_m,repeat_minutes=EXCLUDED.repeat_minutes,
    cursor_at=EXCLUDED.cursor_at,cursor_id=EXCLUDED.cursor_id,last_gps_at=EXCLUDED.last_gps_at,last_point=EXCLUDED.last_point,last_distance_m=0,quality_ok=true,boundary_state='inside',outside_count=0,inside_count=0,movement_id=NULL,last_movement_at=NULL,last_alert_at=NULL,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.activated_at`,
    [id,v.owner_id,v.device_id,v.assignment_id,randomUUID(),point.latitude,point.longitude,point.tracker_timestamp,now,input.radius,input.repeatMinutes,point.server_received_at,point.id,JSON.stringify(point),actor,point.metadata?.accuracyMeters??point.metadata?.accuracy_meters??point.metadata?.accuracy??null]);
  }
  await cancelQueued(client,id);
  await client.query(`INSERT INTO events(vehicle_id,device_id,event_type,occurred_at,payload) VALUES($1,$2,$3,$4,$5)`,[id,v.device_id,input.enabled?'PARKING_ENABLED':'PARKING_DISABLED',now,JSON.stringify({actorId:actor,radius:input.radius,repeatMinutes:input.repeatMinutes})]);
 });
 return parkingStatus(actor,id,now);
}
export interface ParkingNotification {id:string;vehicleId:string;vehicleNumber:string;eventType:string;message:string;occurredAt:string;latitude:number;longitude:number;parkingVersion:number;radius:number;movementId:string|null}
async function notify(client:PoolClient,p:ParkingRow,v:Vehicle,eventType:string,now:Date,push:boolean):Promise<ParkingNotification>{
 const message=`${eventType==='PARKING_REMINDER'?'Parking reminder':eventType==='PARKING_RETURNED'?'Parking return':'Parking Movement Alert'}: Vehicle ${v.vehicle_number} ${eventType==='PARKING_RETURNED'?'returned inside':'is beyond'} its ${p.radius_m} m parking boundary. Detected at ${now.toISOString()}. Last GPS: ${p.last_point!.latitude}, ${p.last_point!.longitude}.`;
 const payload:ParkingNotification={id:randomUUID(),vehicleId:p.vehicle_id,vehicleNumber:v.vehicle_number,eventType,message,occurredAt:now.toISOString(),latitude:p.last_point!.latitude!,longitude:p.last_point!.longitude!,parkingVersion:p.version,radius:p.radius_m,movementId:p.movement_id};
 p.alert_sequence=String(Number(p.alert_sequence)+1);
 await client.query(`INSERT INTO notification_history(id,vehicle_id,event_type,message,latitude,longitude,occurred_at,metadata,dedup_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[payload.id,p.vehicle_id,eventType,message,payload.latitude,payload.longitude,now,JSON.stringify({...payload,ownerId:p.owner_id}),`parking:${p.vehicle_id}:${p.alert_sequence}`]);
 if(push)await enqueueParkingPush(client,p.vehicle_id,Number(p.alert_sequence),payload as unknown as Record<string,unknown>);
 return payload;
}
export async function processParkingVehicle(id:string,now=new Date()):Promise<ParkingNotification[]>{
 return transaction(async client=>{
  // Same vehicle -> parking lock order as configuration writes and deliveries.
  const raw=(await client.query<{owner_id:string}>('SELECT owner_id FROM vehicles WHERE id=$1 FOR SHARE',[id])).rows[0];if(!raw)return [];
  const p=(await client.query<ParkingRow>('SELECT * FROM parking_modes WHERE vehicle_id=$1 AND enabled FOR UPDATE SKIP LOCKED',[id])).rows[0];if(!p)return [];
  const v=await scopedVehicle(client,raw.owner_id,id);if(!assignmentReady(v,p)||!online(v,now))return [];
  const points=(await client.query<ParkingPoint>(`SELECT id,latitude,longitude,gps_valid,tracker_timestamp,server_received_at,speed,metadata FROM locations WHERE vehicle_id=$1 AND device_id=$2 AND (server_received_at,id)>($3::timestamptz,$4::uuid) ORDER BY server_received_at,id LIMIT 500`,[id,p.device_id,p.cursor_at,p.cursor_id])).rows;
  const notifications:ParkingNotification[]=[];
  for(const point of points){
   p.cursor_at=new Date(point.server_received_at);p.cursor_id=point.id;
   if(!pointQuality(point,now,p.radius_m,parkingPolicy())){p.quality_ok=false;p.outside_count=0;p.inside_count=0;continue;}
   const gps=+new Date(point.tracker_timestamp!);if(p.last_gps_at&&gps<=+new Date(p.last_gps_at))continue;
   if(p.last_gps_at&&gps-+new Date(p.last_gps_at)>parkingPolicy().maxAgeSeconds*1000){p.outside_count=0;p.inside_count=0;}
   const c=classification(point,p,p.radius_m,parkingPolicy());p.last_point=point;p.last_gps_at=new Date(gps);p.last_distance_m=c.distance;p.quality_ok=true;
   p.outside_count=c.outside?p.outside_count+1:0;p.inside_count=c.inside?p.inside_count+1:0;
   if(p.boundary_state!=='outside'&&p.outside_count>=parkingPolicy().consecutive){p.boundary_state='outside';p.movement_id=randomUUID();p.last_movement_at=now;p.last_alert_at=now;notifications.push(await notify(client,p,v,'PARKING_MOVEMENT',now,true));}
   else if(p.boundary_state!=='inside'&&p.inside_count>=parkingPolicy().consecutive){const wasOutside=p.boundary_state==='outside';p.boundary_state='inside';p.last_alert_at=null;if(wasOutside)notifications.push(await notify(client,p,v,'PARKING_RETURNED',now,false));p.movement_id=null;await cancelQueued(client,id);}
  }
  if(p.boundary_state==='outside'&&p.outside_count>=parkingPolicy().consecutive&&p.quality_ok&&p.last_point&&pointQuality(p.last_point,now,p.radius_m,parkingPolicy())&&p.last_alert_at&&+now-+new Date(p.last_alert_at)>=p.repeat_minutes*60000){p.last_alert_at=now;notifications.push(await notify(client,p,v,'PARKING_REMINDER',now,true));}
  await client.query(`UPDATE parking_modes SET boundary_state=$2,outside_count=$3,inside_count=$4,cursor_at=$5,cursor_id=$6,last_gps_at=$7,last_point=$8,last_distance_m=$9,quality_ok=$10,movement_id=$11,last_movement_at=$12,last_alert_at=$13,alert_sequence=$14 WHERE vehicle_id=$1`,[id,p.boundary_state,p.outside_count,p.inside_count,p.cursor_at,p.cursor_id,p.last_gps_at,JSON.stringify(p.last_point),p.last_distance_m,p.quality_ok,p.movement_id,p.last_movement_at,p.last_alert_at,p.alert_sequence]);
  return notifications;
 });
}
export async function processParkingModes(){const active=await query<{vehicle_id:string}>('SELECT vehicle_id FROM parking_modes WHERE enabled ORDER BY vehicle_id');const notifications:ParkingNotification[]=[];for(const p of active.rows){try{notifications.push(...await processParkingVehicle(p.vehicle_id));}catch(error){logger.error({err:error,vehicleId:p.vehicle_id},'Parking evaluation failed; persisted state retained');}}return notifications;}
