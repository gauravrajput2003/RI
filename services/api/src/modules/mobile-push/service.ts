import {randomUUID,createHash} from 'node:crypto';
import {query,transaction} from '../../db/pool.js';
import {hasPermissionForUser} from '../authorization/permissions.js';
import {PERMISSIONS} from '@fleet/shared-types';
import {logger} from '../../lib/logger.js';
import {env} from '../../config/env.js';

export function stateAlert(state:string,vehicleNumber:string) {
 const messages:Record<string,string>={MOVING:`Vehicle ${vehicleNumber} has started.`,IDLE:`Vehicle ${vehicleNumber} is idle.`,STOPPED:`Vehicle ${vehicleNumber} has stopped.`};
 const eventTypes:Record<string,string>={MOVING:'VEHICLE_RUNNING',IDLE:'VEHICLE_IDLE',STOPPED:'VEHICLE_STOPPED'};
 return messages[state]?{message:messages[state],eventType:eventTypes[state]}:null;
}
export const refreshHash=(token:string)=>createHash('sha256').update(token).digest('hex');

// Recheck ownership, active login and notification permission at delivery time.
async function recipients(vehicleId:string) {
 const result=await query<{id:string;user_id:string;expo_token:string|null;platform:string;sound:boolean;vibration:boolean;voice:boolean;voice_vehicles:string[];enabled_at:Date|string}>(`
 WITH RECURSIVE owners AS (SELECT owner_id id FROM vehicles WHERE id=$1
 UNION ALL SELECT u.owner_id FROM users u JOIN owners o ON u.id=o.id WHERE u.owner_id IS NOT NULL)
 SELECT d.*,GREATEST(d.updated_at,COALESCE((SELECT p.updated_at FROM mobile_vehicle_notification_preferences p WHERE p.user_id=d.user_id AND p.vehicle_id=$1),d.updated_at)) enabled_at FROM mobile_push_devices d JOIN users u ON u.id=d.user_id
 WHERE d.enabled AND u.active AND d.user_id IN (SELECT id FROM owners)
 AND EXISTS(SELECT 1 FROM refresh_tokens t WHERE t.user_id=d.user_id AND t.token_hash=d.refresh_token_hash AND t.revoked_at IS NULL AND t.expires_at>now())
 AND NOT EXISTS(SELECT 1 FROM mobile_vehicle_notification_preferences p WHERE p.user_id=d.user_id AND p.vehicle_id=$1 AND p.muted)`,[vehicleId]);
 const allowed=[];
 for(const device of result.rows)if(await hasPermissionForUser(device.user_id,PERMISSIONS.notificationsView))allowed.push(device);
 return allowed;
}

export async function collectTransitions(emit:(userId:string,payload:Record<string,unknown>)=>void) {
 if(!(await query('SELECT 1 FROM mobile_push_devices WHERE enabled LIMIT 1')).rows.length)return;
 const vehicles=await query<{id:string;vehicle_number:string;state:string;state_since_at:Date|null}>(`SELECT v.id,v.vehicle_number,s.state_since_at,
 CASE WHEN d.last_seen_at IS NULL OR d.last_seen_at<now()-($1::int*interval '1 minute') THEN 'UNREACHABLE' ELSE s.state::text END state
 FROM vehicles v JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.unassigned_at IS NULL
 JOIN devices d ON d.id=a.device_id JOIN device_status s ON s.device_id=d.id
 WHERE v.active AND d.active AND s.updated_at>=a.assigned_at`,[env.NO_SIGNAL_TIMEOUT_MINUTES]);
 for(const vehicle of vehicles.rows){
  const devices=await recipients(vehicle.id);
  if(!devices.length)continue;
  const result=await transaction(async client=>{
   await client.query('INSERT INTO mobile_vehicle_transitions(vehicle_id,state) VALUES($1,$2) ON CONFLICT DO NOTHING',[vehicle.id,vehicle.state]);
   const prior=(await client.query<{state:string;sequence:string}>('SELECT state,sequence FROM mobile_vehicle_transitions WHERE vehicle_id=$1 FOR UPDATE',[vehicle.id])).rows[0];
   if(prior.state===vehicle.state)return null;
   const sequence=Number(prior.sequence)+1;
   await client.query('UPDATE mobile_vehicle_transitions SET state=$2,sequence=$3,updated_at=now() WHERE vehicle_id=$1',[vehicle.id,vehicle.state,sequence]);
   const alert=stateAlert(vehicle.state,vehicle.vehicle_number);
   const targets=devices.filter(device=>vehicle.state_since_at&&+new Date(device.enabled_at)<=+new Date(vehicle.state_since_at));
   // Reconnection is a baseline, not a fresh start/stop event.
   if(!alert||!targets.length||!stateAlert(prior.state,vehicle.vehicle_number)||Date.now()-+new Date(vehicle.state_since_at!)>300000)return null;
   const payload={id:randomUUID(),vehicleId:vehicle.id,vehicleNumber:vehicle.vehicle_number,...alert,occurredAt:new Date(vehicle.state_since_at!).toISOString()};
   await client.query(`INSERT INTO notification_history(id,vehicle_id,event_type,message,occurred_at,dedup_key,metadata) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,[payload.id,vehicle.id,alert.eventType,alert.message,payload.occurredAt,`mobile:${vehicle.id}:${sequence}`,JSON.stringify({source:'mobile-state-transition'})]);
   for(const device of targets.filter(device=>device.expo_token))await client.query(`INSERT INTO mobile_push_outbox(event_id,device_id,vehicle_id,sequence,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[payload.id,device.id,vehicle.id,sequence,JSON.stringify(payload)]);
   return {payload,users:[...new Set(targets.map(device=>device.user_id))]};
  });
  if(result)for(const userId of result.users)emit(userId,result.payload);
 }
}

export function pushMessages(device:{expo_token:string|null;platform:string;sound:boolean;vibration:boolean;voice:boolean;user_id:string;voice_vehicles?:string[]},payload:Record<string,unknown>) {
 const data={...payload,userId:device.user_id};
 const kind=String(payload.eventType??'VEHICLE_RUNNING').replace('VEHICLE_','').toLowerCase();
 const genericSound=`vehicle-${kind}.wav`;
 const plate=String(payload.vehicleNumber??'').replace(/[^A-Za-z0-9]/g,'').slice(0,16).toLowerCase();
 const iosSound=`vehicle-${payload.vehicleId}-${plate}-${String(payload.eventType).toLowerCase()}.caf`;
 const prepared=device.platform==='ios'&&device.voice_vehicles?.includes(String(payload.vehicleId));
 const sound=device.voice?(prepared?iosSound:genericSound):device.sound?'default':undefined;
 const channelId=device.voice?`vehicle-voice-${kind}-${device.vibration?'vibrate':'quiet'}`:`vehicle-alerts-${device.sound?'sound':'silent'}-${device.vibration?'vibrate':'quiet'}`;
 const messages:Record<string,unknown>[]=[{to:device.expo_token,title:'Vehicle alert',body:payload.message,
  data,sound,channelId,priority:'high',ttl:300}];
 // Separate silent headless event enables best-effort Android TTS without
 // sacrificing OS-rendered notification delivery if background JS is delayed.
 if(device.voice&&device.platform==='android')messages.push({to:device.expo_token,data:{...data,voiceOnly:true},priority:'high',ttl:300});
 return messages;
}

let busy=false;
export async function flushPushOutbox(fetcher:typeof fetch=fetch){
 if(busy)return;busy=true;
 try{
  const pending=await query<{id:string;vehicle_id:string;device_id:string;payload:Record<string,unknown>;attempts:number}>(`UPDATE mobile_push_outbox SET next_attempt_at=now()+interval '90 seconds' WHERE id IN (SELECT id FROM mobile_push_outbox WHERE sent_at IS NULL AND expires_at>now() AND next_attempt_at<=now() ORDER BY next_attempt_at LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING *`);
  for(const row of pending.rows){
   const device=(await recipients(row.vehicle_id)).find(item=>item.id===row.device_id);
   if(!device){await query('UPDATE mobile_push_outbox SET sent_at=now(),receipt_checked=true WHERE id=$1',[row.id]);continue;}
   try{
    const response=await fetcher('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pushMessages(device,row.payload)),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Push transport failed');
    const body=await response.json() as {data?:{status:string;id?:string;details?:{error?:string}}[]};
    const tickets=body.data;
    if(!tickets?.length)throw new Error('Push ticket missing');
    if(tickets.some(ticket=>ticket.details?.error==='DeviceNotRegistered'))await query('UPDATE mobile_push_devices SET enabled=false WHERE id=$1',[device.id]);
    if(tickets[0].status!=='ok')throw new Error('Push ticket rejected');
    await query('UPDATE mobile_push_outbox SET sent_at=now(),ticket_id=$2 WHERE id=$1',[row.id,tickets[0].id??null]);
   }catch{
    await query(`UPDATE mobile_push_outbox SET attempts=attempts+1,next_attempt_at=now()+($2::int*interval '1 second') WHERE id=$1`,[row.id,Math.min(120,5*2**Math.min(row.attempts,5))]);
    logger.warn('Vehicle push delivery deferred');
   }
  }
  const receipts=await query<{id:string;ticket_id:string;device_id:string}>(`SELECT id,ticket_id,device_id FROM mobile_push_outbox WHERE sent_at<now()-interval '15 minutes' AND NOT receipt_checked AND ticket_id IS NOT NULL LIMIT 100`);
  if(receipts.rows.length){
   const response=await fetcher('https://exp.host/--/api/v2/push/getReceipts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:receipts.rows.map(row=>row.ticket_id)}),signal:AbortSignal.timeout(10000)});
   if(response.ok){const body=await response.json() as {data?:Record<string,{status:string;details?:{error?:string}}>};
    for(const row of receipts.rows){const receipt=body.data?.[row.ticket_id];if(!receipt)continue;
     if(receipt.details?.error==='DeviceNotRegistered')await query('UPDATE mobile_push_devices SET enabled=false WHERE id=$1',[row.device_id]);
     if(receipt.status==='error')logger.warn('Vehicle push receipt reports delivery failure');
     await query('UPDATE mobile_push_outbox SET receipt_checked=true WHERE id=$1',[row.id]);
    }
   }
  }
 }finally{busy=false;}
}
