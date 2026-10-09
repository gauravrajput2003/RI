import {query} from '../../db/pool.js';
import {enrichAddresses} from '../geocoding/service.js';
import {activityQuery, vehicleActivityJoin} from './activity.js';
import {userScopeCte} from '../authorization/scope.js';
export const listVehicles=(owner:string,limit:number,cursor?:string)=>activityQuery(`
  ${userScopeCte}
  SELECT v.id,v.vehicle_number,v.alias,v.vehicle_type,v.odometer,v.active,v.created_at,v.remark,v.mileage,v.overspeed_limit,v.billing_start,v.billing_due,activity.*
  FROM vehicles v ${vehicleActivityJoin}
  JOIN user_scope scope ON scope.id=v.owner_id
  WHERE ($2::uuid IS NULL OR v.id>$2) ORDER BY v.id LIMIT $3`,[owner,cursor??null,limit]);
export const findVehicle=(id:string,owner:string)=>activityQuery(`
  ${userScopeCte}
  SELECT v.id,v.vehicle_number,v.alias,v.vehicle_type,v.image_url,v.remark,v.mileage,v.odometer,v.overspeed_limit,v.active,v.created_at,v.updated_at,activity.*
  FROM vehicles v ${vehicleActivityJoin} JOIN user_scope scope ON scope.id=v.owner_id WHERE v.id=$2`,[owner,id]);
/** Device-wide cached coordinates can survive reassignment. Read only a location
 * attributed to this vehicle, with activity status derived independently. */
export const latestLocation=async(id:string,owner:string)=>{const result=await activityQuery(`
  ${userScopeCte}
  SELECT l.vehicle_id,l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,
    NULLIF(l.metadata->>'address','') AS address,l.metadata->>'address_attribution' AS address_attribution,
    COALESCE(activity.current_ignition,l.ignition) AS ignition,l.gps_valid,l.satellites,l.battery_percent,l.gsm_signal,activity.*
  FROM vehicles v JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.unassigned_at IS NULL
  JOIN locations l ON l.device_id=a.device_id AND l.vehicle_id=v.id AND l.server_received_at>=a.assigned_at
  ${vehicleActivityJoin} JOIN user_scope scope ON scope.id=v.owner_id
  WHERE v.id=$2 ORDER BY l.server_received_at DESC LIMIT 1`,[owner,id]);return {...result,rows:await enrichAddresses(result.rows)}};
export const history=(id:string,owner:string,from:Date,to:Date,limit:number)=>query(`${userScopeCte} SELECT l.id,l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,l.course,l.ignition,l.satellites,l.gps_valid FROM locations l JOIN vehicles v ON v.id=l.vehicle_id JOIN user_scope scope ON scope.id=v.owner_id WHERE l.vehicle_id=$2 AND l.tracker_timestamp BETWEEN $3 AND $4 ORDER BY l.tracker_timestamp DESC LIMIT $5`,[owner,id,from,to,limit]);
/** Internal committed-telemetry publisher only; customer reads use the scoped functions above. */
export const publishedVehicleActivity=(id:string)=>activityQuery(`SELECT activity.* FROM vehicles v ${vehicleActivityJoin} WHERE v.id=$1`,[id]);
