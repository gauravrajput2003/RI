import type {PoolClient} from 'pg';
import {randomUUID,createHmac} from 'node:crypto';
import {relaySafety,parseRelayModels,validateProbeProfiles,relayProfileCanonical,type RelaySnapshot,type RelayAction,type RelayCommand,type VehicleRelay} from '@fleet/shared-types';
import {env} from '../../config/env.js';
import {transaction} from '../../db/pool.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';

async function snapshot(client:PoolClient,actor:string,id:string,lock=false):Promise<RelaySnapshot>{
 const visible=await client.query(`${userScopeCte} SELECT v.id FROM vehicles v JOIN user_scope s ON s.id=v.owner_id WHERE v.id=$2${lock?' FOR UPDATE OF v':''}`,[actor,id]);
 if(!visible.rows[0])throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');
 return (await client.query<{snapshot:RelaySnapshot}>('SELECT relay_command_snapshot($1) snapshot',[id])).rows[0].snapshot;
}
export const relayAvailability=relaySafety;
const fields=`id,vehicle_id AS "vehicleId",action,status,result_code AS code,result_message AS message,created_at AS "createdAt",probe_profile AS "probeProfile"`;
export async function vehicleRelay(actor:string,id:string):Promise<VehicleRelay>{
 return transaction(async client=>{
  const v=await snapshot(client,actor,id),availability=relaySafety(v);
  const history=(await client.query<RelayCommand>(`SELECT ${fields} FROM vehicle_relay_commands WHERE vehicle_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20`,[id])).rows;
  const latest=(await client.query<{status:string;action:RelayAction;assignment_id:string;connection_id:string;command_profile:string}>(`SELECT status,action,assignment_id,connection_id,command_profile FROM vehicle_relay_commands WHERE vehicle_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,[id])).rows[0];
  const confirmed=latest?.status==='succeeded'&&latest.assignment_id===v.assignment_id&&latest.connection_id===v.connection_id&&latest.command_profile===v.relay_profile;
  const state=confirmed?(latest.action==='lock'?'locked':'unlocked'):'unknown';
  const pending=history.some(command=>command.status==='pending'||command.status==='sent');
  const reason=pending?{code:'RELAY_COMMAND_PENDING',message:'Waiting for the tracker response. Do not send a second command.'}:availability;
  return {vehicleId:v.id,vehicleNumber:v.vehicle_number,vehicleType:v.vehicle_type,configured:v.relay_configured,protocol:v.protocol,state,
   stateMessage:confirmed?'Tracker reported this result. Physical relay wiring is not independently measured.':'No matching successful tracker response for the current assignment and connection.',
   canLock:reason.code==='RELAY_READY'&&state!=='locked',canUnlock:reason.code==='RELAY_READY'&&state!=='unlocked',...reason,history,requestKey:randomUUID()};
 });
}
export async function requestRelay(actor:string,id:string,action:RelayAction,key:string,probe?:{profile:string;connectionId:string}):Promise<RelayCommand>{
 return transaction(async client=>{
  const v=await snapshot(client,actor,id,true);
  let digest:string|null=null;
  if(probe){
   if(action!=='unlock')throw new AppError(400,'RELAY_PROBE_RESTORE_ONLY','Probe mode only allows unlock / HFYD restore.');
   const profiles=parseRelayModels(env.GT06_RELAY_MODELS??'{}');
   try{validateProbeProfiles(profiles,[probe.profile]);}catch{throw new AppError(400,'RELAY_PROBE_PROFILE','Requested restore probe profile is not configured.');}
   if(!env.INTERNAL_TRACKER_SECRET)throw new AppError(503,'RELAY_PROBE_CONFIGURATION','Probe configuration signature is unavailable.');
   digest=createHmac('sha256',env.INTERNAL_TRACKER_SECRET).update(relayProfileCanonical(profiles[probe.profile])).digest('hex');
   if(v.connection_id!==probe.connectionId)throw new AppError(409,'RELAY_CONNECTION_CHANGED','Tracker connection changed. Probe aborted.');
  }
  await client.query(`UPDATE vehicle_relay_commands SET status='timed_out',result_code='RELAY_TIMEOUT',result_message='No confirmed response before deadline. Command is not retried.',completed_at=now(),updated_at=now() WHERE vehicle_id=$1 AND status IN ('pending','sent') AND COALESCE(expires_at,created_at+interval '20 seconds')<=now()`,[id]);
  const previous=(await client.query<RelayCommand>(`SELECT ${fields} FROM vehicle_relay_commands WHERE actor_id=$1 AND vehicle_id=$2 AND idempotency_key=$3`,[actor,id,key])).rows[0];
  if(previous){if(previous.action!==action||(previous.probeProfile??null)!==(probe?.profile??null))throw new AppError(409,'IDEMPOTENCY_CONFLICT','This request key was already used for a different action or profile.');return previous;}
  const pending=(await client.query(`SELECT id FROM vehicle_relay_commands WHERE vehicle_id=$1 AND status IN ('pending','sent') LIMIT 1`,[id])).rows[0];
  const reason=pending?{code:'RELAY_COMMAND_PENDING',message:'A command is already pending. Wait for its result.'}:relaySafety(v);
  const ready=reason.code==='RELAY_READY';
  return (await client.query<RelayCommand>(`INSERT INTO vehicle_relay_commands(actor_id,vehicle_id,device_id,protocol,action,idempotency_key,status,result_code,result_message,assignment_id,owner_id,connection_id,command_profile,server_flag,dispatch_before,expires_at,probe_profile,probe_profile_digest)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CASE WHEN $14 THEN nextval('relay_server_flag_seq') END,now()+interval '5 seconds',now()+interval '20 seconds',$15,$16) RETURNING ${fields}`,
   [actor,id,v.device_id,v.protocol,action,key,ready?'pending':'rejected',ready?'RELAY_QUEUED':reason.code,ready?'Request accepted for immediate dispatch. Result is not confirmed.':reason.message,v.assignment_id,v.owner_id,v.connection_id,v.relay_profile,ready,probe?.profile??null,digest])).rows[0];
 });
}
export async function relayProbeContext(actor:string,id:string){return transaction(async client=>{
 const v=await snapshot(client,actor,id);
 return {vehicleId:id,vehicleNumber:v.vehicle_number,deviceId:v.device_id,assignmentId:v.assignment_id,connectionId:v.connection_id,availability:relaySafety(v),speed:v.speed,currentSpeed:v.current_speed,ignition:v.ignition,gpsValid:v.gps_valid,gpsAt:v.tracker_timestamp};
});}
export async function relayCommandEvidence(actor:string,id:string,commandId:string){return transaction(async client=>{
 await snapshot(client,actor,id);
 const row=(await client.query(`SELECT id,status,result_code AS code,result_message AS message,probe_profile AS profile,connection_id AS "connectionId",command_hex_redacted AS hex,response_text AS reply,expires_at AS "expiresAt",heartbeat_relay_state AS "heartbeatRelayState",heartbeat_matches AS "heartbeatMatches",heartbeat_observed_at AS "heartbeatObservedAt" FROM vehicle_relay_commands WHERE vehicle_id=$1 AND id=$2`,[id,commandId])).rows[0];
 if(!row)throw new AppError(404,'RELAY_COMMAND_NOT_FOUND','Relay command not found');return row;
});}
export async function cancelRelayProbe(actor:string,id:string,commandId:string){return transaction(async client=>{
 await snapshot(client,actor,id,true);
 await client.query("UPDATE vehicle_relay_commands SET status='rejected',result_code='RELAY_PROBE_ABORTED',result_message='Probe stopped before dispatch.',completed_at=now(),updated_at=now() WHERE id=$1 AND vehicle_id=$2 AND probe_profile IS NOT NULL AND status='pending'",[commandId,id]);
 // Sent bytes cannot be recalled; keep them outstanding until reply/deadline, never retry.
});}
