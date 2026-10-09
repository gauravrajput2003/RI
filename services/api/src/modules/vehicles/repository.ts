import {query} from '../../db/pool.js';
import {displayedAddresses} from '../cellular/service.js';
import {activityQuery, vehicleActivityJoin, usableLocationOrder} from './activity.js';
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
  SELECT l.vehicle_id,cell_latest.metadata AS cellular_metadata,cell_latest.protocol AS cell_protocol,cell_latest.server_received_at AS cell_observed_at,l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,
    NULLIF(l.metadata->>'address','') AS address,l.metadata->>'address_attribution' AS address_attribution,
    COALESCE(activity.current_ignition,l.ignition) AS ignition,l.gps_valid,l.satellites,l.battery_percent,l.gsm_signal,activity.*
  FROM vehicles v JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.unassigned_at IS NULL
  JOIN locations l ON l.device_id=a.device_id AND l.vehicle_id=v.id AND l.server_received_at>=a.assigned_at
  LEFT JOIN LATERAL (
    SELECT c.metadata,c.protocol,c.server_received_at FROM locations c
    WHERE c.vehicle_id=v.id AND c.device_id=a.device_id AND c.server_received_at>=a.assigned_at
      AND (c.metadata ? 'cell' OR c.metadata ? 'cellId')
    ORDER BY c.server_received_at DESC,c.id DESC LIMIT 1
  ) cell_latest ON true
  ${vehicleActivityJoin} JOIN user_scope scope ON scope.id=v.owner_id
  WHERE v.id=$2 ORDER BY ${usableLocationOrder} LIMIT 1`,[owner,id]);return {...result,rows:await displayedAddresses(result.rows)}};
export const history=(id:string,owner:string,from:Date,to:Date,limit:number)=>query(`${userScopeCte} SELECT l.id,l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,l.course,l.ignition,l.satellites,l.gps_valid,l.metadata,l.protocol FROM locations l JOIN vehicles v ON v.id=l.vehicle_id JOIN user_scope scope ON scope.id=v.owner_id WHERE l.vehicle_id=$2 AND l.tracker_timestamp BETWEEN $3 AND $4 ORDER BY l.tracker_timestamp DESC LIMIT $5`,[owner,id,from,to,limit]).then(async result=>({...result,rows:await displayedAddresses(result.rows,true)}));
/** Internal committed-telemetry publisher only; customer reads use the scoped functions above. */
export const publishedVehicleActivity=(id:string)=>activityQuery(`SELECT activity.*,cell_latest.metadata AS cellular_metadata,cell_latest.protocol AS cell_protocol,cell_latest.server_received_at AS cell_observed_at
  FROM vehicles v ${vehicleActivityJoin}
  LEFT JOIN LATERAL (SELECT l.metadata,l.protocol,l.server_received_at FROM vehicle_device_assignments a
    JOIN locations l ON l.vehicle_id=a.vehicle_id AND l.device_id=a.device_id AND l.server_received_at>=a.assigned_at
    WHERE a.vehicle_id=v.id AND a.unassigned_at IS NULL AND (l.metadata ? 'cell' OR l.metadata ? 'cellId')
    ORDER BY l.server_received_at DESC,l.id DESC LIMIT 1) cell_latest ON true WHERE v.id=$1`,[id]);
