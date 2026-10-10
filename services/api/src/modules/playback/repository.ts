import {displayedAddresses} from '../cellular/service.js';
import { env } from '../../config/env.js';
import { query } from '../../db/pool.js';
import { userScopeCte } from '../authorization/scope.js';

export const playbackPoints=(actorId:string,vehicleId:string,from:Date,to:Date,limit:number)=>query(`${userScopeCte}, scoped_points AS (
  SELECT l.id,l.device_id,l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,l.course,l.ignition,l.gps_valid,l.odometer,l.position,l.metadata,l.protocol,
    COALESCE(l.tracker_timestamp,l.server_received_at) AS observed_at
  FROM locations l JOIN vehicles v ON v.id=l.vehicle_id JOIN user_scope scope ON scope.id=v.owner_id
  WHERE l.vehicle_id=$2 AND COALESCE(l.tracker_timestamp,l.server_received_at)>=$3 AND COALESCE(l.tracker_timestamp,l.server_received_at)<$4
    AND l.gps_valid=true AND l.position IS NOT NULL
    AND l.latitude BETWEEN -90 AND 90 AND l.longitude BETWEEN -180 AND 180
    AND NOT (l.latitude=0 AND l.longitude=0)
  ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at) ASC,l.server_received_at ASC,l.id ASC LIMIT $5
), measured AS (
  SELECT *,lag(position) OVER route AS previous_position,
    lag(observed_at) OVER route AS previous_at,
    lag(speed) OVER route AS previous_speed
  FROM scoped_points
  WINDOW route AS (PARTITION BY device_id ORDER BY observed_at,server_received_at,id)
), segments AS (
  SELECT *,ST_Distance(previous_position,position) AS segment_metres,
    EXTRACT(EPOCH FROM (observed_at-previous_at)) AS elapsed_seconds
  FROM measured
), route_points AS (
  SELECT *,CASE WHEN elapsed_seconds>0 AND segment_metres<=elapsed_seconds*(200.0/3.6)
    AND (segment_metres>=10 OR speed>$6 OR previous_speed>$6)
    THEN segment_metres/1000.0 ELSE 0 END AS segment_distance_km
  FROM segments
)
SELECT id,tracker_timestamp,server_received_at,latitude,longitude,speed,course,ignition,gps_valid,odometer,metadata,protocol,
  segment_distance_km,
  SUM(segment_distance_km) OVER(ORDER BY observed_at,server_received_at,id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_distance_km,
  (AVG(speed) FILTER(WHERE speed>=0) OVER())::double precision AS route_avg_speed,
  (MAX(speed) FILTER(WHERE speed>=0) OVER())::double precision AS route_max_speed,
  COUNT(*) OVER()::int AS route_point_count
FROM route_points ORDER BY observed_at,server_received_at,id`,
  [actorId,vehicleId,from,to,limit,env.MOVEMENT_THRESHOLD_KPH]).then(async result=>({...result,rows:await displayedAddresses(result.rows,true)}));
