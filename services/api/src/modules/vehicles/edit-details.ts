import {z} from 'zod';
import {query} from '../../db/pool.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';

export const vehicleDetailsBody=z.object({
 vehicleNumber:z.string().trim().min(1).max(80).optional(),
 vehicleType:z.string().trim().min(1).max(80).optional(),
 mileage:z.number().finite().min(0).max(1_000_000_000).nullable().optional(),
 odometer:z.number().finite().min(0).max(1_000_000_000_000).nullable().optional(),
 overspeedLimit:z.number().finite().positive().max(300).nullable().optional(),
 alias:z.string().trim().max(120).nullable().optional(),
 remark:z.string().trim().max(500).nullable().optional(),
 gpsLocation:z.string().trim().max(500).nullable().optional(),
}).strict().refine(value=>Object.keys(value).length>0,'Choose a field to update');
export async function updateVehicleDetails(actorId:string,id:string,input:z.infer<typeof vehicleDetailsBody>){
 const fields={vehicleNumber:'vehicle_number',vehicleType:'vehicle_type',mileage:'mileage',odometer:'odometer',overspeedLimit:'overspeed_limit',alias:'alias',remark:'remark',gpsLocation:'gps_location'} as const;
 const entries=Object.entries(input).filter(([,value])=>value!==undefined) as Array<[keyof typeof fields,unknown]>;
 try{
  const result=await query(`${userScopeCte} UPDATE vehicles v SET ${entries.map(([key],index)=>`${fields[key]}=$${index+3}`).join(',')},updated_at=now()
   WHERE v.id=$2 AND v.owner_id IN (SELECT id FROM user_scope)
   RETURNING v.id,v.vehicle_number,v.vehicle_type,v.mileage,v.odometer,v.overspeed_limit,v.alias,v.remark,v.gps_location,v.updated_at`,[actorId,id,...entries.map(([,value])=>value)]);
  if(!result.rows[0])throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');
  return result.rows[0];
 }catch(error){
  if(error&&typeof error==='object'&&'code' in error&&error.code==='23505')throw new AppError(409,'VEHICLE_CONFLICT','Vehicle number already exists');
  throw error;
 }
}
