import {randomUUID} from 'node:crypto';
import {pool} from '../src/db/pool.js';
import {env} from '../src/config/env.js';
import {relaySafety,type RelaySnapshot} from '@fleet/shared-types';

// Uses the existing authenticated route and all production safety checks; no raw TCP bypass.
const args=process.argv.slice(2),value=(name:string)=>args[args.indexOf(name)+1];
try{
 if(!args.includes('--imei')||!args.includes('--action'))throw new Error('Usage: relay-test.ts --imei IMEI --action lock|unlock [--send --confirm]. Default is read-only. For send set RI_RELAY_TEST_TOKEN to an authorized API access token.');
 if(env.NODE_ENV==='production')throw new Error('Development script is disabled in production.');
 const imei=value('--imei'),action=value('--action');if(!/^\d{15}$/.test(imei)||!['lock','unlock'].includes(action))throw new Error('Expected 15-digit IMEI and lock/unlock action');
 const vehicles=(await pool.query<{id:string}>(`SELECT v.id FROM vehicles v JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.unassigned_at IS NULL JOIN devices d ON d.id=a.device_id WHERE d.imei=$1`,[imei])).rows;
 if(vehicles.length!==1)throw new Error('Exactly one assigned vehicle is required');
 const id=vehicles[0].id;
 const snapshot=(await pool.query<{snapshot:RelaySnapshot}>('SELECT relay_command_snapshot($1) snapshot',[id])).rows[0].snapshot;
 const recent=(await pool.query('SELECT status,result_code,created_at,sent_at,completed_at FROM vehicle_relay_commands WHERE vehicle_id=$1 ORDER BY created_at DESC LIMIT 5',[id])).rows;
 console.log(JSON.stringify({imei,vehicle:snapshot.vehicle_number,action,availability:relaySafety(snapshot),connectionId:snapshot.connection_id,connectionExpiresAt:snapshot.connection_expires_at,lastSeenAt:snapshot.last_seen_at,gpsAt:snapshot.tracker_timestamp,recent,readOnly:!args.includes('--send')},null,2));
 if(args.includes('--send')){
  if(!args.includes('--confirm'))throw new Error('--send requires --confirm: this controls a physical relay');
  const token=process.env.RI_RELAY_TEST_TOKEN;if(!token)throw new Error('RI_RELAY_TEST_TOKEN is required; do not put tokens in command arguments');
  const base=process.env.RI_RELAY_TEST_API??'http://127.0.0.1:3000/api/v1';
  const response=await fetch(`${base}/vehicles/${id}/relay/commands`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action,confirmed:true,idempotencyKey:randomUUID()})});
  const body=await response.json() as {data?:{id:string};error?:{message:string}};
  if(!response.ok)throw new Error(body.error?.message??`API rejected request (${response.status})`);
  const deadline=Date.now()+25000;let previous='';
  while(Date.now()<deadline){
   const row=(await pool.query<{status:string;result_code:string;command_hex_redacted:string|null;response_text:string|null}>('SELECT status,result_code,command_hex_redacted,response_text FROM vehicle_relay_commands WHERE id=$1',[body.data!.id])).rows[0];
   const output=JSON.stringify({commandId:body.data!.id,...row});if(output!==previous){console.log(output);previous=output;}
   if(!['pending','sent'].includes(row.status))break;
   await new Promise(resolve=>setTimeout(resolve,500));
  }
 }
}catch(error){console.error(error instanceof Error?error.message:'Relay diagnostic failed');process.exitCode=1;}finally{await pool.end();}
