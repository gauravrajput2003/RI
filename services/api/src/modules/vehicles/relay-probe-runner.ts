import {relayProfileFormat,validateProbeProfiles,redactRelayText,type RelayModels,type RelayModel} from '@fleet/shared-types';
export interface ProbeContext {vehicleId:string;deviceId:string|null;assignmentId:string|null;connectionId:string|null;availability:{code:string;message:string};speed:number|null;currentSpeed:number|null;ignition:boolean|null;gpsValid:boolean|null;gpsAt:string|null}
export interface ProbeEvidence {id:string;status:string;code:string;connectionId:string|null;hex:string|null;reply:string|null;expiresAt:string|null;heartbeatMatches?:boolean|null}
export interface ProbeTransport {context():Promise<ProbeContext>;submit(profile:string,connectionId:string):Promise<{id:string;createdAt?:string}>;status(id:string):Promise<ProbeEvidence>;cancel(id:string):Promise<void>}
export interface ProbeAttempt {profile:string;format:ReturnType<typeof relayProfileFormat>;connectionId:string|null;hex:string|null;reply:string|null;result:'success'|'negative reply'|'timeout'|'connection lost'|'aborted'|'rejected';interpretation:string;heartbeatMatches?:boolean|null}
export interface ProbeOptions {profiles:string[];models:RelayModels;send?:boolean;confirm?:boolean;hasToken?:boolean;action?:string;preview(profile:string):string;print(text:string):void;now?:()=>number;sleep?:(ms:number)=>Promise<void>}
export function probeBlockers(context:ProbeContext){
 const result=new Set<string>();if(context.availability.code!=='RELAY_READY')result.add(context.availability.code);
 if(!context.connectionId)result.add('RELAY_OFFLINE');if(context.speed!==0||context.currentSpeed!==0)result.add('SPEED_NOT_ZERO_OR_UNKNOWN');if(context.ignition!==false)result.add('IGNITION_ON_OR_UNKNOWN');if(context.gpsValid!==true)result.add('GPS_INVALID');return [...result];
}
export function probeRecommendation(profile:RelayModel,showConfig=false){
 if(showConfig)return {...profile};
 const result={...profile};
 for(const action of ['lock','unlock'] as const)result[action]=result[action].replace(/^(DYD|HFYD),[^#{}]+#$/i,'$1,{password}#');
 if(profile.password||result.lock.includes('{password}')||result.unlock.includes('{password}'))result.password='REPLACE_ME';
 return result;
}
/** Sequential restore-only probes. No retries, guessed candidates, model writes or safety bypass. */
export async function runRestoreProbe(transport:ProbeTransport,options:ProbeOptions){
 const {profiles,models}=options;validateProbeProfiles(models,profiles);
 if(options.action&&options.action!=='unlock')throw new Error('Probe mode refuses lock/cut; only unlock / HFYD restore is allowed.');
 if(options.send&&(!options.confirm||!options.hasToken))throw new Error('Sending requires --send --confirm and RI_RELAY_TEST_TOKEN.');
 const now=options.now??Date.now,sleep=options.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 const print=(value:unknown)=>options.print(redactRelayText(models,typeof value==='string'?value:JSON.stringify(value)));
 const initial=await transport.context(),attempts:ProbeAttempt[]=[];
 print({mode:options.send?'restore probe':'DRY RUN — no commands sent',context:initial,blockers:probeBlockers(initial),plan:profiles.map(name=>({profile:name,format:relayProfileFormat(models[name]),redactedPreviewHex:options.preview(name),previewServerFlag:1}))});
 if(!options.send){print('Profile | languageField | password form | result');for(const name of profiles){const format=relayProfileFormat(models[name]);print(`${name} | ${format.languageField} | ${format.hasPassword?'with password':'without password'} | DRY RUN`);}return {attempts,winner:undefined as string|undefined,stoppedReason:undefined as string|undefined};}
 const ready=(context:ProbeContext)=>context.availability.code==='RELAY_READY';
 const sameConnection=(context:ProbeContext)=>context.availability.code!=='RELAY_OFFLINE'&&context.connectionId===initial.connectionId&&context.deviceId===initial.deviceId&&context.assignmentId===initial.assignmentId;
 if(!ready(initial)||!initial.connectionId){print(`ABORTED: ${initial.availability.code} — ${initial.availability.message}`);return {attempts,winner:undefined,stoppedReason:initial.availability.code};}
 let winner:string|undefined,stoppedReason:string|undefined;
 for(const profile of profiles){
  let id:string|undefined,evidence:ProbeEvidence|undefined;
  const row:ProbeAttempt={profile,format:relayProfileFormat(models[profile]),connectionId:initial.connectionId,hex:null,reply:null,result:'aborted',interpretation:''};
  try{
   const before=await transport.context();
   if(!sameConnection(before)||!ready(before)){row.result=sameConnection(before)?'aborted':'connection lost';row.interpretation=sameConnection(before)?before.availability.code:'Connection or assignment changed; do not replay.';stoppedReason=row.interpretation;attempts.push(row);print(row);break;}
   const accepted=await transport.submit(profile,initial.connectionId);id=accepted.id;
   let deadline=accepted.createdAt?Date.parse(accepted.createdAt)+20000:now()+20000;
   if(!Number.isFinite(deadline))deadline=now()+20000;
   for(;;){
    const context=await transport.context();
    if(!sameConnection(context)||!ready(context)){
     evidence=await transport.status(id);row.hex=evidence.hex;row.reply=evidence.reply;
     row.result=sameConnection(context)?'aborted':'connection lost';row.interpretation=sameConnection(context)?context.availability.code:'Connection or assignment changed; do not replay.';stoppedReason=row.interpretation;await transport.cancel(id);break;
    }
    evidence=await transport.status(id);row.hex=evidence.hex;row.reply=evidence.reply;row.heartbeatMatches=evidence.heartbeatMatches;
    if(evidence.expiresAt&&Number.isFinite(Date.parse(evidence.expiresAt)))deadline=Date.parse(evidence.expiresAt);
    if(evidence.status==='succeeded'){row.result='success';row.interpretation='Success reply: this profile works. Heartbeat is secondary evidence.';winner=profile;break;}
    if(evidence.code==='RELAY_CONNECTION_LOST'||evidence.code==='RELAY_CONNECTION_CHANGED'){row.result='connection lost';row.interpretation='Socket dropped; abort without replay.';stoppedReason=evidence.code;break;}
    if(evidence.status==='failed'&&evidence.code==='RELAY_DEVICE_REJECTED'){
     row.result='negative reply';row.interpretation=/(?:Fail!|Unvalued Fix!?|Speed Limit)/i.test(evidence.reply??'')?'Command/password accepted; device condition failed. This is not a password rejection.':'Negative device reply; reason retained, acceptance is not established.';break;
    }
    if(evidence.status==='timed_out'||now()>=deadline){row.result='timeout';row.interpretation='No reply by the existing deadline. Do not replay this attempt.';break;}
    if(!['pending','sent'].includes(evidence.status)){row.result='rejected';row.interpretation=evidence.code;stoppedReason=evidence.code;break;}
    await sleep(Math.min(500,Math.max(1,deadline-now())));
   }
  }catch(error){
   row.result='aborted';row.interpretation=redactRelayText(models,error instanceof Error?error.message:'Probe transport failed');stoppedReason='Transport error; command outcome may be unknown. No retries.';
   if(id)try{await transport.cancel(id);}catch{print('Pending cancellation could not be confirmed; do not retry the command.');}
  }
  row.reply=row.reply?redactRelayText(models,row.reply):null;attempts.push(row);print(row);
  if(winner||stoppedReason)break;
 }
 print('Profile | languageField | password form | result | interpretation');
 for(const row of attempts)print(`${row.profile} | ${row.format.languageField} | ${row.format.hasPassword?'with password':'without password'} | ${row.result} | ${row.interpretation}`);
 if(attempts.length&&attempts.every(row=>row.result==='timeout'))print('All profiles timed out: wrong format/password OR connection/reply handling. Check stable connectionId, outbound hex logs, inbound raw frames, and whether your supplied list tested both language-field variants.');
 return {attempts,winner,stoppedReason};
}
