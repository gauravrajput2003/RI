import {randomUUID} from 'node:crypto';
import {pool} from '../src/db/pool.js';
import {env,relayModels} from '../src/config/env.js';
import {relaySafety,relayModelCommand,validateProbeProfiles,redactRelayText,type RelaySnapshot} from '@fleet/shared-types';
import {runRestoreProbe,probeRecommendation,type ProbeContext,type ProbeEvidence} from '../src/modules/vehicles/relay-probe-runner.js';
import {encodeRelay} from '../../tracker/src/protocols/gt06/commands.js';
import {relayWireEvidence} from '../../tracker/src/services/relay-models.js';
const args=process.argv.slice(2),arg=(name:string)=>{const at=args.indexOf(name);return at>=0?args[at+1]:undefined;};
try{
 const allowed=new Set(['--imei','--profiles','--action','--send','--confirm','--show-config']);
 const seen=new Set<string>();
 for(let index=0;index<args.length;index++){
  const option=args[index];if(!allowed.has(option)||seen.has(option))throw new Error('Invalid/duplicate option. Quote comma-separated --profiles and supply credentials only through the environment.');seen.add(option);
  if(['--imei','--profiles','--action'].includes(option)){if(!args[index+1]||args[index+1].startsWith('--'))throw new Error('Missing option value. Quote comma-separated --profiles.');index++;}
 }
 const imei=arg('--imei'),profiles=(arg('--profiles')??'').split(','),send=args.includes('--send');
 if(!imei||!/^\d{15}$/.test(imei))throw new Error('Supply --imei IMEI --profiles A,B (1 to 8 explicit configured profiles).');
 validateProbeProfiles(relayModels,profiles);
 if(arg('--action')&&arg('--action')!=='unlock')throw new Error('Probe mode refuses lock/cut; only unlock / HFYD restore is allowed.');
 const token=process.env.RI_RELAY_TEST_TOKEN;
 if(send&&(!args.includes('--confirm')||!token))throw new Error('Sending requires --send --confirm and RI_RELAY_TEST_TOKEN in the environment.');
 if(env.NODE_ENV==='production')throw new Error('Run this local operator tool outside production mode against the authenticated API.');
 const vehicles=(await pool.query<{id:string}>(`SELECT a.vehicle_id AS id FROM vehicle_device_assignments a JOIN devices d ON d.id=a.device_id WHERE a.unassigned_at IS NULL AND d.imei=$1`,[imei])).rows;
 if(vehicles.length!==1)throw new Error('Exactly one assigned vehicle is required.');const vehicle=vehicles[0].id;
 const base=process.env.RI_RELAY_TEST_API??'http://127.0.0.1:3000/api/v1';
 const request=async<T>(path:string,method='GET',body?:unknown):Promise<T>=>{
  const response=await fetch(`${base}/vehicles/${vehicle}/relay${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(response.status===204)return undefined as T;
  const result=await response.json() as {data:T;error?:{message?:string}};
  if(!response.ok)throw new Error(redactRelayText(relayModels,result.error?.message??`API rejected probe (${response.status})`));return result.data;
 };
 const localContext=async():Promise<ProbeContext>=>{
  const v=(await pool.query<{snapshot:RelaySnapshot}>('SELECT relay_command_snapshot($1) snapshot',[vehicle])).rows[0].snapshot;
  return {vehicleId:vehicle,deviceId:v.device_id,assignmentId:v.assignment_id,connectionId:v.connection_id,availability:relaySafety(v),speed:v.speed,currentSpeed:v.current_speed,ignition:v.ignition,gpsValid:v.gps_valid,gpsAt:v.tracker_timestamp};
 };
 const result=await runRestoreProbe({context:()=>send?request<ProbeContext>('/probe'):localContext(),submit:(profile,connectionId)=>request('/commands','POST',{action:'unlock',confirmed:true,idempotencyKey:randomUUID(),probeProfile:profile,probeConnectionId:connectionId}),status:id=>request<ProbeEvidence>(`/commands/${id}`),cancel:id=>request(`/commands/${id}`,'DELETE')},{profiles,models:relayModels,send,confirm:args.includes('--confirm'),hasToken:Boolean(token),action:arg('--action'),preview:profile=>{const config=relayModelCommand(relayModels,profile,'unlock');return relayWireEvidence(encodeRelay('unlock',1,config),config.text,profile).hex;},print:line=>console.log(line)});
 if(result.winner){
  const config=probeRecommendation(relayModels[result.winner],args.includes('--show-config'));
  // Explicit config export only: --show-config is never used in logs/errors or by the agent.
  console.log('Recommended GT06_RELAY_MODELS entry:');console.log(JSON.stringify({[result.winner]:config},null,2));
 }
 if(result.stoppedReason)process.exitCode=1;
}catch(error){console.error(redactRelayText(relayModels,error instanceof Error?error.message:'Probe failed'));process.exitCode=1;}finally{await pool.end();}
