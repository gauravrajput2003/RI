import {query} from '../../db/pool.js';
import {activityQuery, vehicleActivityJoin} from './activity.js';
export const listVehicles=(owner:string,limit:number,cursor?:string)=>activityQuery(`
  SELECT v.id,v.vehicle_number,v.alias,v.vehicle_type,v.odometer,v.active,v.created_at,activity.*
  FROM vehicles v ${vehicleActivityJoin}
  WHERE v.owner_id=$1 AND ($2::uuid IS NULL OR v.id>$2) ORDER BY v.id LIMIT $3`,[owner,cursor??null,limit]);
export const findVehicle=(id:string,owner:string)=>activityQuery(`
  SELECT v.id,v.vehicle_number,v.alias,v.vehicle_type,v.image_url,v.remark,v.mileage,v.odometer,v.overspeed_limit,v.active,v.created_at,v.updated_at,activity.*
  FROM vehicles v ${vehicleActivityJoin} WHERE v.id=$1 AND v.owner_id=$2`,[id,owner]);
/** Device-wide cached coordinates can survive reassignment. Read only a location
 * attributed to this vehicle, with activity status derived independently. */
export const latestLocation=(id:string,owner:string)=>activityQuery(`
  SELECT l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,
    l.ignition,l.gps_valid,l.satellites,l.battery_percent,l.gsm_signal,activity.*
  FROM vehicles v JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.unassigned_at IS NULL
  JOIN locations l ON l.device_id=a.device_id AND l.vehicle_id=v.id AND l.server_received_at>=a.assigned_at
  ${vehicleActivityJoin}
  WHERE v.id=$1 AND v.owner_id=$2 ORDER BY l.server_received_at DESC LIMIT 1`,[id,owner]);
export const history=(id:string,owner:string,from:Date,to:Date,limit:number)=>query('SELECT id,tracker_timestamp,server_received_at,latitude,longitude,speed,course,ignition,satellites,gps_valid FROM locations WHERE vehicle_id=$1 AND EXISTS(SELECT 1 FROM vehicles WHERE id=$1 AND owner_id=$2) AND tracker_timestamp BETWEEN $3 AND $4 ORDER BY tracker_timestamp DESC LIMIT $5',[id,owner,from,to,limit]);
/** Internal committed-telemetry publisher only; customer reads use the scoped functions above. */
export const publishedVehicleActivity=(id:string)=>activityQuery(`SELECT activity.* FROM vehicles v ${vehicleActivityJoin} WHERE v.id=$1`,[id]);
