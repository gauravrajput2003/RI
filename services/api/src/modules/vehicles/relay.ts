import type {PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {relayProtocolSupport,type RelayAction,type RelayCommand,type VehicleRelay} from '@fleet/shared-types';
import {transaction} from '../../db/pool.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';

interface Snapshot {
 id:string;vehicle_number:string;vehicle_type:string|null;active:boolean;relay_configured:boolean;
 assignment_count:number;device_id:string|null;device_active:boolean|null;device_owner_matches:boolean|null;protocol:string|null;
}
async function snapshot(client:PoolClient,actor:string,id:string,lock=false):Promise<Snapshot>{
 const row=(await client.query<Snapshot>(`${userScopeCte}
 SELECT v.id,v.vehicle_number,v.vehicle_type,v.active,v.relay_configured,
  a.assignment_count,a.device_id,d.active AS device_active,d.owner_id=v.owner_id AS device_owner_matches,d.protocol
 FROM vehicles v JOIN user_scope s ON s.id=v.owner_id
 LEFT JOIN LATERAL (SELECT count(*)::int AS assignment_count,(array_agg(device_id))[1] AS device_id
  FROM vehicle_device_assignments WHERE vehicle_id=v.id AND unassigned_at IS NULL) a ON true
 LEFT JOIN devices d ON d.id=a.device_id WHERE v.id=$2${lock?' FOR UPDATE OF v':''}`, [actor,id])).rows[0];
 if(!row)throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');return row;
}
export function relayAvailability(v:Snapshot){
 if(!v.active)return {code:'VEHICLE_INACTIVE',message:'This vehicle is inactive. Command was not sent.'};
 if(!v.relay_configured)return {code:'RELAY_DISABLED',message:'Relay control is not enabled for this vehicle.'};
 if(v.assignment_count!==1||!v.device_id||!v.device_active||v.device_owner_matches!==true)return {code:'RELAY_DEVICE_UNAVAILABLE',message:'A single active tracker belonging to this vehicle’s owner must be assigned. Command was not sent.'};
 const support=relayProtocolSupport(v.protocol);
 return {code:support.code,message:support.message};
}
const fields=`id,vehicle_id AS "vehicleId",action,status,result_code AS code,result_message AS message,created_at AS "createdAt"`;
export async function vehicleRelay(actor:string,id:string):Promise<VehicleRelay>{
 return transaction(async client=>{
  const v=await snapshot(client,actor,id),availability=relayAvailability(v);
  const history=(await client.query<RelayCommand>(`SELECT ${fields} FROM vehicle_relay_commands WHERE vehicle_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20`,[id])).rows;
  return {vehicleId:v.id,vehicleNumber:v.vehicle_number,vehicleType:v.vehicle_type,configured:v.relay_configured,
   protocol:v.protocol,state:'unknown',stateMessage:'Relay state is not confirmed by this tracker adapter.',
   canLock:false,canUnlock:false,...availability,history,requestKey:randomUUID()};
 });
}
/** Fail closed: there is deliberately no TCP, raw command, or dispatch fallback.
 * Future verified support must add transport/ACK correlation and revalidate fresh
 * assigned-device GPS, speed and model-specific safety at actual dispatch time. */
export async function requestRelay(actor:string,id:string,action:RelayAction,key:string):Promise<RelayCommand>{
 return transaction(async client=>{
  const v=await snapshot(client,actor,id,true);
  const previous=(await client.query<RelayCommand>(`SELECT ${fields} FROM vehicle_relay_commands WHERE actor_id=$1 AND vehicle_id=$2 AND idempotency_key=$3`,[actor,id,key])).rows[0];
  if(previous){if(previous.action!==action)throw new AppError(409,'IDEMPOTENCY_CONFLICT','This request key was already used for a different action.');return previous;}
  const pending=(await client.query(`SELECT id FROM vehicle_relay_commands WHERE vehicle_id=$1 AND status IN ('pending','sent') LIMIT 1`,[id])).rows[0];
  const reason=pending?{code:'RELAY_COMMAND_PENDING',message:'A command is already pending. Wait for its result before trying again.'}:relayAvailability(v);
  return (await client.query<RelayCommand>(`INSERT INTO vehicle_relay_commands(actor_id,vehicle_id,device_id,protocol,action,idempotency_key,status,result_code,result_message)
   VALUES($1,$2,$3,$4,$5,$6,'rejected',$7,$8) RETURNING ${fields}`,[actor,id,v.device_id,v.protocol,action,key,reason.code,reason.message])).rows[0];
 });
}
