import {requireOptionalNativeModule} from 'expo';
import {getVehicles} from '../api/vehicles';
import {spokenAlert,type VehicleAlert} from './events';
export function vehicleSoundName(id:string,number:string,eventType:string){
 const plate=number.replace(/[^A-Za-z0-9]/g,'').slice(0,16).toLowerCase();
 return `vehicle-${id}-${plate}-${eventType.toLowerCase()}.caf`;
}
export async function prepareIosVehicleSounds(isCurrent:()=>boolean):Promise<string[]>{
 const module=requireOptionalNativeModule<{prepareSound(text:string,name:string):Promise<string>}>('VehicleVoice');
 if(!module)throw new Error('Install a build containing vehicle voice sounds');
 const ready:string[]=[],events=[['VEHICLE_RUNNING','has started'],['VEHICLE_IDLE','is idle'],['VEHICLE_STOPPED','has stopped']] as const;
 let cursor:string|undefined;
 do{
  const page=await getVehicles(cursor);
  for(const vehicle of page.data){
   if(!isCurrent())return [];
   if(!vehicle.active)continue;
   for(const [eventType,phrase] of events){
    const alert={vehicleNumber:vehicle.vehicle_number,message:`Vehicle ${vehicle.vehicle_number} ${phrase}.`} as VehicleAlert;
    await module.prepareSound(spokenAlert(alert),vehicleSoundName(vehicle.id,vehicle.vehicle_number,eventType));
    if(!isCurrent())return [];
   }
   ready.push(vehicle.id);
  }
  const next=page.nextCursor;
  if(!next||next===cursor)break;cursor=next;
 }while(isCurrent());
 return ready;
}
