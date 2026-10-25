import {expect,it,vi} from 'vitest';
import {parseRelayModels} from '@fleet/shared-types';
import {runRestoreProbe,probeRecommendation,type ProbeContext,type ProbeEvidence,type ProbeTransport} from './relay-probe-runner.js';
const models=parseRelayModels(JSON.stringify({PDF:{lock:'DYD#',unlock:'HFYD#',languageField:false,lockSuccess:'DYD=Success!',unlockSuccess:'HFYD=Success!'},LANG:{lock:'DYD#',unlock:'HFYD#',languageField:true,lockSuccess:'DYD=Success!',unlockSuccess:'HFYD=Success!'},OPERATOR:{lock:'DYD,{password}#',unlock:'HFYD,{password}#',password:'876543',languageField:false,lockSuccess:'DYD=Success!',unlockSuccess:'HFYD=Success!'}}));
const context=():ProbeContext=>({vehicleId:'vehicle',deviceId:'device',assignmentId:'assignment',connectionId:'connection',availability:{code:'RELAY_READY',message:'ready'},speed:0,currentSpeed:0,ignition:false,gpsValid:true,gpsAt:new Date(0).toISOString()});
const evidence=(id:string,status:string,code='',reply:string|null=null):ProbeEvidence=>({id,status,code,connectionId:'connection',hex:'redacted hex',reply,expiresAt:new Date(20000).toISOString()});
function fixture(){
 let time=0;const output:string[]=[];
 const transport:ProbeTransport={context:vi.fn(async()=>context()),submit:vi.fn(async profile=>({id:profile,createdAt:new Date(time).toISOString()})),status:vi.fn(async id=>evidence(id,'succeeded','RELAY_CONFIRMED','HFYD=Success!')),cancel:vi.fn(async()=>{})};
 const options={profiles:['PDF','LANG'],models,send:true,confirm:true,hasToken:true,preview:()=> 'masked preview',print:(line:string)=>output.push(line),now:()=>time,sleep:async(ms:number)=>{time+=ms;}};
 return {transport,options,output,time:()=>time};
}
it('defaults to a dry run, lists blockers and plans, and sends nothing',async()=>{
 const f=fixture();f.transport.context=async()=>({...context(),availability:{code:'RELAY_GPS_STALE',message:'stale'}});
 await runRestoreProbe(f.transport,{...f.options,send:false});expect(f.transport.submit).not.toHaveBeenCalled();expect(f.output.join(' ')).toContain('RELAY_GPS_STALE');expect(f.output.join(' ')).toContain('masked preview');
});
it('requires explicit max-eight profiles and refuses cut or missing confirmation/token',async()=>{
 const f=fixture();
 for(const change of [{profiles:[]},{profiles:Array(9).fill('PDF')},{profiles:['NOT_CONFIGURED']},{action:'lock'},{confirm:false},{hasToken:false}])await expect(runRestoreProbe(f.transport,{...f.options,...change})).rejects.toThrow();
 expect(f.transport.submit).not.toHaveBeenCalled();
});
it('waits for each negative reply and stops at the first success',async()=>{
 const f=fixture(),calls:string[]=[];let firstDone=false;
 f.transport.submit=vi.fn(async profile=>{if(profile==='LANG')expect(firstDone).toBe(true);calls.push(profile);return {id:profile};});
 f.transport.status=async id=>{if(id==='PDF'){firstDone=true;return evidence(id,'failed','RELAY_DEVICE_REJECTED','HFYD=Fail!');}return evidence(id,'succeeded','RELAY_CONFIRMED','HFYD=Success!');};
 const result=await runRestoreProbe(f.transport,{...f.options,profiles:['PDF','LANG','OPERATOR']});
 expect(calls).toEqual(['PDF','LANG']);expect(result.winner).toBe('LANG');expect(result.attempts[0].interpretation).toContain('not a password rejection');
});
it('waits the whole existing deadline before advancing and never replays a timeout',async()=>{
 const f=fixture(),sent:string[]=[],deadlines=new Map<string,number>();
 f.transport.submit=vi.fn(async profile=>{if(profile==='LANG')expect(f.time()).toBeGreaterThanOrEqual(20000);sent.push(profile);deadlines.set(profile,f.time()+20000);return {id:profile,createdAt:new Date(f.time()).toISOString()};});
 f.transport.status=async id=>({...evidence(id,'sent'),expiresAt:new Date(deadlines.get(id)!).toISOString()});
 const result=await runRestoreProbe(f.transport,f.options);expect(sent).toEqual(['PDF','LANG']);expect(f.time()).toBe(40000);expect(result.attempts.map(row=>row.result)).toEqual(['timeout','timeout']);expect(f.output.join(' ')).toContain('connection/reply handling');
});
it.each(['socket','safety','assignment'])('aborts immediately on mid-run %s change and cancels pending dispatch',async reason=>{
 const f=fixture();let submitted=false;
 f.transport.submit=vi.fn(async()=>{submitted=true;return {id:'one'};});
 f.transport.context=async()=>submitted?({...context(),...(reason==='socket'?{connectionId:'new'}:reason==='assignment'?{assignmentId:'new'}:{availability:{code:'RELAY_NOT_STATIONARY',message:'moving'}})}):context();
 const result=await runRestoreProbe(f.transport,f.options);expect(f.transport.submit).toHaveBeenCalledOnce();expect(f.transport.cancel).toHaveBeenCalledWith('one');expect(result.stoppedReason).toBeTruthy();
});
it('does not retry transport failures and redacts supplied credentials in errors/recommendations',async()=>{
 const f=fixture();f.transport.status=async()=>{throw new Error('failure with 876543');};
 await runRestoreProbe(f.transport,{...f.options,profiles:['OPERATOR']});expect(f.transport.submit).toHaveBeenCalledOnce();expect(f.output.join(' ')).not.toContain('876543');
 expect(probeRecommendation(models.OPERATOR).password).toBe('REPLACE_ME');expect(JSON.stringify(probeRecommendation(models.OPERATOR))).not.toContain('876543');
});
