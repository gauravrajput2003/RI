export interface VehicleAlert {id:string;vehicleId:string;vehicleNumber:string;eventType:string;message:string;occurredAt:string;userId?:string;voiceOnly?:boolean}
export const spokenAlert=(alert:VehicleAlert)=>alert.message.replace(alert.vehicleNumber,alert.vehicleNumber.replace(/\s/g,'').split('').join(' '));
export function parseVehicleAlert(value:unknown):VehicleAlert|null {
 if(!value||typeof value!=='object')return null;
 const row=value as Record<string,unknown>;
 if(!['VEHICLE_RUNNING','VEHICLE_IDLE','VEHICLE_STOPPED'].includes(String(row.eventType)))return null;
 for(const key of ['id','vehicleId','vehicleNumber','message','occurredAt'])if(typeof row[key]!=='string'||!row[key])return null;
 const age=Date.now()-new Date(row.occurredAt as string).getTime();
 if(!Number.isFinite(age)||age< -60000||age>300000)return null;
 return row as unknown as VehicleAlert;
}
const listeners=new Set<(payload:unknown)=>void>();
export function publishMobileAlert(payload:unknown){for(const listener of listeners)listener(payload);}
export function subscribeMobileAlerts(listener:(payload:unknown)=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}

export function createVoiceQueue(speak:(text:string,done:()=>void)=>void){
 let queue:string[]=[],busy=false,generation=0;
 const advance=()=>{if(busy||!queue.length)return;busy=true;const current=generation;
  speak(queue.shift()!,()=>{if(current!==generation)return;busy=false;advance();});};
 return {add:(text:string)=>{if(queue.length<20){queue.push(text);advance();}},clear:()=>{generation++;queue=[];busy=false;}};
}
