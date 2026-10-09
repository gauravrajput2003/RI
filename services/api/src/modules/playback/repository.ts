import {displayedAddresses} from '../cellular/service.js';
import { query } from '../../db/pool.js';
import { userScopeCte } from '../authorization/scope.js';

export const playbackPoints=(actorId:string,vehicleId:string,from:Date,to:Date,limit:number)=>query(`${userScopeCte}, scoped_points AS (
  SELECT l.id,l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,l.course,l.ignition,l.gps_valid,l.odometer,l.position,l.metadata,l.protocol,
    COALESCE(l.tracker_timestamp,l.server_received_at) AS observed_at
  FROM locations l JOIN vehicles v ON v.id=l.vehicle_id JOIN user_scope scope ON scope.id=v.owner_id
  WHERE l.vehicle_id=$2 AND COALESCE(l.tracker_timestamp,l.server_received_at)>=$3 AND COALESCE(l.tracker_timestamp,l.server_received_at)<$4
  ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at) ASC,l.server_received_at ASC,l.id ASC LIMIT $5
), measured AS (
  SELECT *,lag(position) OVER(ORDER BY observed_at,server_received_at,id) AS previous_position,
    lag(gps_valid) OVER(ORDER BY observed_at,server_received_at,id) AS previous_gps_valid
  FROM scoped_points
), route_points AS (
  SELECT *,CASE WHEN gps_valid AND previous_gps_valid AND position IS NOT NULL AND previous_position IS NOT NULL
    THEN ST_Distance(previous_position,position)/1000.0 ELSE 0 END AS segment_distance_km
  FROM measured
)
SELECT id,tracker_timestamp,server_received_at,latitude,longitude,speed,course,ignition,gps_valid,odometer,metadata,protocol,
  segment_distance_km,
  SUM(segment_distance_km) OVER(ORDER BY observed_at,server_received_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_distance_km,
  (AVG(speed) FILTER(WHERE speed>=0) OVER())::double precision AS route_avg_speed,
  (MAX(speed) FILTER(WHERE speed>=0) OVER())::double precision AS route_max_speed,
  COUNT(*) OVER()::int AS route_point_count
FROM route_points ORDER BY observed_at,server_received_at,id`,
  [actorId,vehicleId,from,to,limit]).then(async result=>({...result,rows:await displayedAddresses(result.rows,true)}));
