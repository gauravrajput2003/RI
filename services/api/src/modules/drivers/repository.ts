import type {Driver,DriverInput,VehicleDriver} from '@fleet/shared-types';
import {query,transaction} from '../../db/pool.js';
import {userScopeCte} from '../authorization/scope.js';
import {AppError} from '../../lib/errors.js';

const fields=`d.id,d.name,d.mobile,d.licence_number,d.created_at,
 (a.id IS NOT NULL) AS assigned,
 CASE WHEN v.owner_id IN (SELECT id FROM user_scope) THEN a.vehicle_id END AS vehicle_id,
 CASE WHEN v.owner_id IN (SELECT id FROM user_scope) THEN v.vehicle_number END AS vehicle_number`;
const joins=`LEFT JOIN vehicle_driver_assignments a ON a.driver_id=d.id AND a.unassigned_at IS NULL LEFT JOIN vehicles v ON v.id=a.vehicle_id`;
async function vehicleOwner(actor:string,vehicle:string){
 const row=(await query<{owner_id:string}>(`${userScopeCte} SELECT owner_id FROM vehicles WHERE id=$2 AND owner_id IN(SELECT id FROM user_scope)`,[actor,vehicle])).rows[0];
 if(!row)throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');return row.owner_id;
}
export async function listDrivers(actor:string,limit:number,cursor?:string,vehicle?:string){
 const owner=vehicle?await vehicleOwner(actor,vehicle):null;
 return (await query<Driver>(`${userScopeCte} SELECT ${fields} FROM drivers d ${joins}
  WHERE d.owner_id IN(SELECT id FROM user_scope) AND ($4::uuid IS NULL OR d.owner_id=$4)
   AND ($2::uuid IS NULL OR (d.created_at,d.id)<(SELECT c.created_at,c.id FROM drivers c WHERE c.id=$2 AND c.owner_id IN(SELECT id FROM user_scope) AND ($4::uuid IS NULL OR c.owner_id=$4)))
  ORDER BY d.created_at DESC,d.id DESC LIMIT $3`,[actor,cursor??null,limit,owner])).rows;
}
export async function createDriver(actor:string,input:DriverInput,vehicle?:string){
 return transaction(async client=>{
  let owner=actor;
  if(vehicle){
   const row=(await client.query<{owner_id:string}>(`${userScopeCte} SELECT v.owner_id FROM vehicles v WHERE v.id=$2 AND v.owner_id IN(SELECT id FROM user_scope) FOR SHARE OF v`,[actor,vehicle])).rows[0];
   if(!row)throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');owner=row.owner_id;
  }
  const created=(await client.query<Driver>(`INSERT INTO drivers(owner_id,name,mobile,licence_number) VALUES($1,$2,$3,$4)
   ON CONFLICT(owner_id,licence_key) DO NOTHING RETURNING id,name,mobile,licence_number,created_at,false AS assigned,NULL::uuid AS vehicle_id,NULL::text AS vehicle_number`,[owner,input.name,input.mobile,input.licenceNumber])).rows[0];
  if(created)return {driver:created,created:true};
  const existing=(await client.query<Driver>(`SELECT d.id,d.name,d.mobile,d.licence_number,d.created_at,(a.id IS NOT NULL) AS assigned,
   CASE WHEN v.owner_id=$1 THEN a.vehicle_id END AS vehicle_id,CASE WHEN v.owner_id=$1 THEN v.vehicle_number END AS vehicle_number
   FROM drivers d ${joins} WHERE d.owner_id=$1 AND d.licence_key=regexp_replace(upper($2),'[^A-Z0-9]','','g')`,[owner,input.licenceNumber])).rows[0];
  if(existing&&existing.name===input.name&&existing.mobile===input.mobile)return {driver:existing,created:false};
  throw new AppError(409,'DRIVER_EXISTS','This licence number is already saved. Select the existing driver from Driver List.');
 });
}
export async function currentDriver(actor:string,vehicle:string):Promise<VehicleDriver>{
 await vehicleOwner(actor,vehicle);
 const row=(await query<{assignment_id:string;assigned_at:string;driver:Driver|null}>(`${userScopeCte} SELECT a.id AS assignment_id,a.assigned_at,
  CASE WHEN d.owner_id=v.owner_id AND d.owner_id IN(SELECT id FROM user_scope) THEN json_build_object('id',d.id,'name',d.name,'mobile',d.mobile,'licence_number',d.licence_number,'created_at',d.created_at,'assigned',true,'vehicle_id',a.vehicle_id,'vehicle_number',v.vehicle_number) END AS driver
  FROM vehicle_driver_assignments a JOIN drivers d ON d.id=a.driver_id JOIN vehicles v ON v.id=a.vehicle_id WHERE a.vehicle_id=$2 AND v.owner_id IN(SELECT id FROM user_scope) AND a.unassigned_at IS NULL`,[actor,vehicle])).rows[0];
 return {assignmentId:row?.assignment_id??null,assignedAt:row?.assigned_at??null,driver:row?.driver??null};
}
export async function assignDriver(actor:string,vehicle:string,driver:string,expected:string|null):Promise<VehicleDriver>{
 try{return await transaction(async client=>{
  const v=(await client.query<{owner_id:string}>(`${userScopeCte} SELECT v.owner_id FROM vehicles v WHERE v.id=$2 AND v.owner_id IN(SELECT id FROM user_scope) FOR UPDATE OF v`,[actor,vehicle])).rows[0];
  if(!v)throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');
  const d=(await client.query<Driver&{owner_id:string}>(`${userScopeCte} SELECT d.* FROM drivers d WHERE d.id=$2 AND d.owner_id IN(SELECT id FROM user_scope) FOR UPDATE OF d`,[actor,driver])).rows[0];
  if(!d)throw new AppError(404,'DRIVER_NOT_FOUND','Driver not found');
  if(d.owner_id!==v.owner_id)throw new AppError(409,'DRIVER_OWNER_MISMATCH','Choose a driver belonging to this vehicle’s owner. Add the driver from this vehicle’s Driver List.');
  const current=(await client.query<{id:string;driver_id:string;assigned_at:string}>('SELECT id,driver_id,assigned_at FROM vehicle_driver_assignments WHERE vehicle_id=$1 AND unassigned_at IS NULL',[vehicle])).rows[0];
  const responseDriver:Driver={id:d.id,name:d.name,mobile:d.mobile,licence_number:d.licence_number,created_at:d.created_at,assigned:true,vehicle_id:vehicle,vehicle_number:null};
  if(current?.driver_id===driver)return {assignmentId:current.id,assignedAt:current.assigned_at,driver:responseDriver};
  if((current?.id??null)!==expected)throw new AppError(409,'ASSIGNMENT_CHANGED','The vehicle’s driver changed. Refresh the list before assigning.');
  if((await client.query('SELECT 1 FROM vehicle_driver_assignments WHERE driver_id=$1 AND unassigned_at IS NULL',[driver])).rows.length)throw new AppError(409,'DRIVER_ASSIGNED','This driver is already assigned to another vehicle. Choose an available driver.');
  if(current)await client.query('UPDATE vehicle_driver_assignments SET unassigned_at=now() WHERE id=$1',[current.id]);
  const saved=(await client.query<{id:string;assigned_at:string}>('INSERT INTO vehicle_driver_assignments(vehicle_id,driver_id,assigned_by) VALUES($1,$2,$3) RETURNING id,assigned_at',[vehicle,driver,actor])).rows[0];
  return {assignmentId:saved.id,assignedAt:saved.assigned_at,driver:responseDriver};
 });}catch(error){
  if(error&&typeof error==='object'&&'code' in error&&error.code==='23505')throw new AppError(409,'DRIVER_ASSIGNED','This driver or vehicle was assigned by another request. Refresh and retry.');
  throw error;
 }
}
