import { query } from '../../db/pool.js';
import { userScopeCte } from '../authorization/scope.js';

export const playbackPoints=(actorId:string,vehicleId:string,from:Date,to:Date,limit:number)=>query(`${userScopeCte}
  SELECT l.id,l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,l.course,l.ignition,l.gps_valid,l.odometer
  FROM locations l JOIN vehicles v ON v.id=l.vehicle_id JOIN user_scope scope ON scope.id=v.owner_id
  WHERE l.vehicle_id=$2 AND COALESCE(l.tracker_timestamp,l.server_received_at)>=$3 AND COALESCE(l.tracker_timestamp,l.server_received_at)<$4
  ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at) ASC,l.server_received_at ASC,l.id ASC LIMIT $5`,
  [actorId,vehicleId,from,to,limit]);
