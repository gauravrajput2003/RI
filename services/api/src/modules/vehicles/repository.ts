import {query} from '../../db/pool.js';
export const listVehicles=(owner:string,limit:number,cursor?:string)=>query('SELECT id,vehicle_number,alias,vehicle_type,odometer,active,created_at FROM vehicles WHERE owner_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[owner,cursor??null,limit]);
export const findVehicle=(id:string,owner:string)=>query('SELECT id,vehicle_number,alias,vehicle_type,image_url,remark,mileage,odometer,overspeed_limit,active,created_at,updated_at FROM vehicles WHERE id=$1 AND owner_id=$2',[id,owner]);
/** Device-wide cached fields can survive reassignment and partial updates.
 * Read a location attributed to this vehicle instead of disclosing that cache. */
export const latestLocation=(id:string,owner:string)=>query(`
  SELECT l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,
    l.ignition,l.gps_valid,l.satellites,l.battery_percent,l.gsm_signal,
    CASE WHEN ds.last_location_at>=a.assigned_at THEN ds.state ELSE NULL END AS state
  FROM vehicles v JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.unassigned_at IS NULL
  JOIN locations l ON l.device_id=a.device_id AND l.vehicle_id=v.id AND l.server_received_at>=a.assigned_at
  LEFT JOIN device_status ds ON ds.device_id=a.device_id
  WHERE v.id=$1 AND v.owner_id=$2 ORDER BY l.server_received_at DESC LIMIT 1`,[id,owner]);
export const history=(id:string,owner:string,from:Date,to:Date,limit:number)=>query('SELECT id,tracker_timestamp,server_received_at,latitude,longitude,speed,course,ignition,satellites,gps_valid FROM locations WHERE vehicle_id=$1 AND EXISTS(SELECT 1 FROM vehicles WHERE id=$1 AND owner_id=$2) AND tracker_timestamp BETWEEN $3 AND $4 ORDER BY tracker_timestamp DESC LIMIT $5',[id,owner,from,to,limit]);
