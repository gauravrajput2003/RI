import {randomUUID,createHmac} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import type {Socket} from 'node:net';
import {relaySafety,hasEffectivePermission,PERMISSIONS,type PermissionKey,type RelayAction,type RelaySnapshot} from '@fleet/shared-types';
import {encodeRelay,decodeCommandReply,relayReplyResult} from '../protocols/gt06/commands.js';
import {TrackerSockets,type TrackerBinding} from '../transport/tracker-sockets.js';
import {relayModelCommand,relayWireEvidence,redactRelayReply,type RelayModels} from './relay-models.js';
import {relayProfileCanonical,relayProfileFormat,validateProbeProfiles} from '@fleet/shared-types';
import {heartbeatRelayInfo} from '../protocols/gt06/heartbeat.js';

type Binding=TrackerBinding;
interface Command {id:string;vehicle_id:string;device_id:string;actor_id:string;owner_id:string;assignment_id:string;connection_id:string;command_profile:string;action:RelayAction;server_flag:string;dispatch_before:Date;expires_at:Date;status:string;expected_response:string|null;probe_profile:string|null;probe_profile_digest:string|null}
const snapshot=async(client:PoolClient,id:string)=>(await client.query<{snapshot:RelaySnapshot}>('SELECT relay_command_snapshot($1) snapshot',[id])).rows[0].snapshot;

export class RelayDispatcher {
 readonly instanceId=randomUUID();private bindings=new TrackerSockets();private busy=false;private bindingWork=new Map<string,Promise<void>>();
 constructor(private pool:Pool,private onError:(error:unknown)=>void=()=>{},private log:(fields:Record<string,unknown>,message:string)=>void=()=>{},private models:RelayModels={},private profileKey=''){}
 async bind(deviceId:string,connectionId:string,protocol:string,socket:Socket,imei=deviceId){
  const binding={imei,deviceId,connectionId,protocol,socket},previous=this.bindings.replace(binding);
  this.log({imei,deviceId,connectionId,previousConnectionId:previous?.connectionId},previous&&previous.socket!==socket?'tracker registry replaced':'tracker registry bound');
  // Serialize lease writes for the same IMEI, including overlapping asynchronous logins.
  const work=(this.bindingWork.get(imei)??Promise.resolve()).catch(()=>{}).then(async()=>{
   if(this.bindings.get(imei)!==binding||socket.destroyed)return;
   await this.pool.query(`INSERT INTO tracker_connections(device_id,connection_id,instance_id,protocol,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 seconds') ON CONFLICT(device_id) DO UPDATE SET connection_id=EXCLUDED.connection_id,instance_id=EXCLUDED.instance_id,protocol=EXCLUDED.protocol,expires_at=EXCLUDED.expires_at,updated_at=now()`,[deviceId,connectionId,this.instanceId,protocol]);
   if(socket.destroyed||this.bindings.get(imei)!==binding)await this.unbind(connectionId,socket);
  });
  this.bindingWork.set(imei,work);
  try{await work;}catch(error){this.bindings.remove(connectionId,socket);socket.destroy(new Error('Tracker registry binding failed'));throw error;}
  finally{if(this.bindingWork.get(imei)===work)this.bindingWork.delete(imei);}
 }
 async unbind(connectionId:string,socket?:Socket){
  const current=this.bindings.byConnection(connectionId);if(current&&socket&&current.socket!==socket)return;
  this.bindings.remove(connectionId,socket);
  await this.pool.query('DELETE FROM tracker_connections WHERE connection_id=$1 AND instance_id=$2',[connectionId,this.instanceId]);
  const lost=await this.pool.query<{id:string}>(`UPDATE vehicle_relay_commands SET status='timed_out',result_code='RELAY_CONNECTION_LOST',result_message='Tracker connection closed. Result is unknown; command will not be replayed.',completed_at=now(),updated_at=now() WHERE connection_id=$1 AND status IN ('pending','sent') RETURNING id`,[connectionId]);
  for(const c of lost.rows)this.log({commandId:c.id,connectionId,status:'timed_out'},'relay connection lost');
 }
 private async transaction<T>(work:(client:PoolClient)=>Promise<T>){const client=await this.pool.connect();try{await client.query('BEGIN');const value=await work(client);await client.query('COMMIT');return value;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
 private async actorAllowed(client:PoolClient,c:Command){
  const actor=(await client.query<{role:string}>(`WITH RECURSIVE scope AS(SELECT id FROM users WHERE id=$1 AND active UNION ALL SELECT u.id FROM users u JOIN scope s ON u.owner_id=s.id) SELECT actor.role FROM users actor WHERE actor.id=$1 AND actor.active AND actor.role IN ('SUPER_ADMIN','ADMIN','CLIENT') AND EXISTS(SELECT 1 FROM vehicles v JOIN scope s ON v.owner_id=s.id WHERE v.id=$2) FOR SHARE OF actor`,[c.actor_id,c.vehicle_id])).rows[0];
  if(!actor)return false;if(actor.role!=='ADMIN')return true;
  const grants=(await client.query<{permission_key:PermissionKey}>('SELECT permission_key FROM admin_permissions WHERE admin_id=$1 AND allowed=true',[c.actor_id])).rows.map(row=>row.permission_key);
  return hasEffectivePermission(grants,PERMISSIONS.vehicleEdit);
 }
 private async guard(client:PoolClient,c:Command,binding:Binding){
  await client.query('SELECT id FROM devices WHERE id=$1 FOR UPDATE',[c.device_id]);
  const lease=(await client.query(`SELECT 1 FROM tracker_connections WHERE device_id=$1 AND connection_id=$2 AND instance_id=$3 AND expires_at>now() FOR SHARE`,[c.device_id,binding.connectionId,this.instanceId])).rows[0];
  if(!lease||binding.socket.destroyed||!binding.socket.writable||c.connection_id!==binding.connectionId)return {code:'RELAY_CONNECTION_CHANGED',message:'Tracker connection changed. Command was not sent.'};
  const s=await snapshot(client,c.vehicle_id);
  if(!s||s.device_id!==c.device_id||s.assignment_id!==c.assignment_id||s.owner_id!==c.owner_id||s.relay_profile!==c.command_profile)return {code:'RELAY_ASSIGNMENT_CHANGED',message:'Device, owner, assignment or relay profile changed. Command was not sent.'};
  if(!await this.actorAllowed(client,c))return {code:'RELAY_ACCESS_CHANGED',message:'Command permission was revoked. Command was not sent.'};
  if(c.probe_profile){
   try{
    validateProbeProfiles(this.models,[c.probe_profile]);
    if(c.action!=='unlock'||!this.profileKey||createHmac('sha256',this.profileKey).update(relayProfileCanonical(this.models[c.probe_profile])).digest('hex')!==c.probe_profile_digest)throw new Error();
   }catch{return {code:'RELAY_PROBE_CONFIGURATION',message:'Restore probe profile differs between API and tracker. Command was not sent.'};}
  }
  return relaySafety(s,new Date(),c.action);
 }
 private async fail(client:PoolClient,id:string,code:string,message:string,status='rejected'){await client.query('UPDATE vehicle_relay_commands SET status=$2,result_code=$3,result_message=$4,completed_at=now(),updated_at=now() WHERE id=$1 AND status IN (\'pending\',\'sent\')',[id,status,code,message]);}
 async tick(){
  if(this.busy)return;this.busy=true;
  try{
   for(const b of this.bindings.values())if(!b.socket.destroyed&&!this.bindingWork.has(b.imei)){
    const lease=await this.pool.query(`INSERT INTO tracker_connections(device_id,connection_id,instance_id,protocol,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 seconds') ON CONFLICT(device_id) DO UPDATE SET expires_at=EXCLUDED.expires_at,updated_at=now() WHERE tracker_connections.connection_id=$2 AND tracker_connections.instance_id=$3 RETURNING device_id`,[b.deviceId,b.connectionId,this.instanceId,b.protocol]);
    if(!lease.rows.length){this.log({imei:b.imei,connectionId:b.connectionId},'tracker connection superseded by another process');b.socket.destroy();}
   }
   const expired=await this.pool.query<{id:string}>(`UPDATE vehicle_relay_commands SET status='timed_out',result_code='RELAY_TIMEOUT',result_message='No confirmed tracker response before deadline. State is unknown; command will not be retried.',completed_at=now(),updated_at=now() WHERE status IN ('pending','sent') AND COALESCE(expires_at,created_at+interval '20 seconds')<=now() RETURNING id`);
   for(const c of expired.rows)this.log({commandId:c.id,status:'timed_out'},'relay response deadline expired');
   const pending=(await this.pool.query<Command>(`SELECT * FROM vehicle_relay_commands WHERE status='pending' AND device_id=ANY($1::uuid[]) ORDER BY created_at LIMIT 20`,[[...this.bindings.values()].map(b=>b.deviceId)])).rows;
   for(const c of pending){const b=this.bindings.byDevice(c.device_id);if(b)await this.dispatch(c,b);}
  }catch(error){this.onError(error);}finally{this.busy=false;}
 }
 private async dispatch(candidate:Command,b:Binding){
  // Persist the attempt BEFORE the write. A process crash can never cause replay.
  const claimed=await this.transaction(async client=>{
   await client.query('SELECT id FROM vehicles WHERE id=$1 FOR UPDATE',[candidate.vehicle_id]);
   const c=(await client.query<Command>("SELECT * FROM vehicle_relay_commands WHERE id=$1 AND status='pending' FOR UPDATE SKIP LOCKED",[candidate.id])).rows[0];if(!c)return false;
   if(+new Date(c.dispatch_before)<Date.now()){await this.fail(client,c.id,'RELAY_QUEUE_EXPIRED','Dispatch window expired. Command was not sent.');return false;}
   const reason=await this.guard(client,c,b);if(reason.code!=='RELAY_READY'){await this.fail(client,c.id,reason.code,reason.message);return false;}
   await client.query("UPDATE vehicle_relay_commands SET status='sent',sent_at=now(),result_code='RELAY_DISPATCHING',result_message='Dispatch attempt started; tracker result is not confirmed.',updated_at=now() WHERE id=$1",[c.id]);return true;
  });if(!claimed)return;
  await this.transaction(async client=>{
   await client.query('SELECT id FROM vehicles WHERE id=$1 FOR UPDATE',[candidate.vehicle_id]);
   const c=(await client.query<Command>("SELECT * FROM vehicle_relay_commands WHERE id=$1 AND status='sent' FOR UPDATE",[candidate.id])).rows[0];if(!c)return;
   const reason=await this.guard(client,c,b);
   if(reason.code!=='RELAY_READY'||+new Date(c.dispatch_before)<Date.now()){await this.fail(client,c.id,reason.code==='RELAY_READY'?'RELAY_QUEUE_EXPIRED':reason.code,reason.code==='RELAY_READY'?'Dispatch window expired; command was not sent.':reason.message);return;}
   const device=(await client.query<{model:string|null}>('SELECT model FROM devices WHERE id=$1',[c.device_id])).rows[0];
   let config:ReturnType<typeof relayModelCommand>;
   const profile=c.probe_profile??device.model;
   try{config=relayModelCommand(this.models,profile,c.action);}catch(error){await this.fail(client,c.id,'RELAY_MODEL_CONFIGURATION',error instanceof Error?error.message:'Invalid relay model configuration');return;}
   const frame=encodeRelay(c.action,Number(c.server_flag),config),evidence=relayWireEvidence(frame,config.text,profile);
   await client.query('UPDATE vehicle_relay_commands SET command_hex_redacted=$2,expected_response=$3 WHERE id=$1',[c.id,evidence.hex,config.success]);
   this.log({imei:b.imei,deviceId:b.deviceId,connectionId:b.connectionId,commandId:c.id,serverFlag:Number(c.server_flag),profile:profile??'CONCOX_GT06_DYD',format:profile?relayProfileFormat(this.models[profile],c.action):{languageField:true,hasPassword:false},...evidence},'relay outbound command');
   try{b.socket.write(frame,error=>{if(error)void this.pool.query("UPDATE vehicle_relay_commands SET status='failed',result_code='RELAY_WRITE_FAILED',result_message='TCP write failed. Physical state is unknown; command will not be retried.',completed_at=now() WHERE id=$1 AND status='sent'",[c.id]).catch(this.onError);});}
   catch{await this.fail(client,c.id,'RELAY_WRITE_FAILED','TCP write failed. Physical state is unknown; command will not be retried.','failed');}
  });
 }
 async receive(connectionId:string,frame:Buffer){
  const b=this.bindings.byConnection(connectionId);
  if(!b||b.protocol!=='GT06')return false;const reply=decodeCommandReply(frame);if(!reply)return false;
  const found=(await this.pool.query<Command>("SELECT * FROM vehicle_relay_commands WHERE device_id=$1 AND connection_id=$2 AND server_flag=$3 AND status='sent'",[b.deviceId,connectionId,reply.serverFlag])).rows[0];
  const evidence=redactRelayReply(this.models,reply.text,frame.toString('hex'));
  this.log({imei:b.imei,connectionId,commandId:found?.id,serverFlag:reply.serverFlag,...evidence,matched:Boolean(found)},'relay inbound response');
  if(!found)return true;
  await this.transaction(async client=>{
   await client.query('SELECT id FROM vehicles WHERE id=$1 FOR UPDATE',[found.vehicle_id]);
   const c=(await client.query<Command>("SELECT * FROM vehicle_relay_commands WHERE id=$1 AND status='sent' FOR UPDATE",[found.id])).rows[0];if(!c)return;
   if(+new Date(c.expires_at)<=Date.now()){await this.fail(client,c.id,'RELAY_TIMEOUT','Late response ignored. Result was not confirmed within the deadline.','timed_out');return;}
   const s=await snapshot(client,c.vehicle_id);
   if(!s||s.assignment_id!==c.assignment_id||s.connection_id!==connectionId||s.owner_id!==c.owner_id){await this.fail(client,c.id,'RELAY_ASSIGNMENT_CHANGED','Response belongs to an obsolete assignment or connection.','failed');return;}
   const expected=c.expected_response;
   const defaultResult=relayReplyResult(c.action,reply.text);
   const result=expected?(reply.text.toUpperCase()===expected.toUpperCase()?'succeeded':defaultResult==='failed'||/\b(?:FAIL(?:ED)?|ERROR)\b/i.test(reply.text)?'failed':null):defaultResult;
   if(!result){await client.query("UPDATE vehicle_relay_commands SET response_text=$2,updated_at=now() WHERE id=$1",[c.id,evidence.text.slice(0,240)]);this.log({commandId:c.id,text:evidence.text},'relay response text unrecognized; awaiting exact configured success');return;}
   await client.query('UPDATE vehicle_relay_commands SET status=$2,result_code=$3,result_message=$4,response_text=$5,completed_at=now(),updated_at=now() WHERE id=$1',[c.id,result,result==='succeeded'?'RELAY_CONFIRMED':'RELAY_DEVICE_REJECTED',result==='succeeded'?`Tracker confirmed ${c.action}.`:'Tracker rejected the command; physical state is not confirmed.',evidence.text.slice(0,240)]);
   this.log({commandId:c.id,status:result,text:evidence.text},'relay command completed');
  });return true;
 }
 async heartbeat(connectionId:string,frame:Buffer,at=new Date()){
  const binding=this.bindings.byConnection(connectionId),info=heartbeatRelayInfo(frame);
  if(!binding||binding.protocol!=='GT06'||!info)return;
  await this.pool.query(`UPDATE device_status SET relay_state_reported=$2,relay_terminal_info=$3,relay_reported_at=$4,relay_reported_connection_id=$5 WHERE device_id=$1 AND EXISTS(SELECT 1 FROM tracker_connections WHERE device_id=$1 AND connection_id=$5 AND instance_id=$6)`,[binding.deviceId,info.relay_state_reported,info.terminalInfo,at,connectionId,this.instanceId]);
  this.log({imei:binding.imei,connectionId,...info},'relay state reported by heartbeat');
  // Frames on this connection are processed in order. A reply and the next heartbeat
  // may share one TCP chunk/receipt time, earlier than the DB commit timestamp.
  const observed=await this.pool.query<{id:string;action:RelayAction;heartbeat_matches:boolean}>(`UPDATE vehicle_relay_commands SET heartbeat_relay_state=$3,heartbeat_terminal_info=$4,heartbeat_observed_at=$5,heartbeat_matches=(action='lock')=$3 WHERE id=(SELECT id FROM vehicle_relay_commands WHERE device_id=$1 AND connection_id=$2 AND status='succeeded' AND heartbeat_observed_at IS NULL ORDER BY completed_at DESC LIMIT 1) RETURNING id,action,heartbeat_matches`,[binding.deviceId,connectionId,info.relay_state_reported,info.terminalInfo,at]);
  for(const row of observed.rows)this.log({imei:binding.imei,connectionId,commandId:row.id,action:row.action,terminalInfo:info.terminalInfo,relay_state_reported:info.relay_state_reported,matches:row.heartbeat_matches,warning:!row.heartbeat_matches},row.heartbeat_matches?'relay success corroborated by heartbeat':'relay heartbeat mismatch after success; reply result retained');
 }
}
