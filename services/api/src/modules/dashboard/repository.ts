import {query} from '../../db/pool.js';
import {enrichAddresses} from '../geocoding/service.js';
import {env} from '../../config/env.js';
import {userScopeCte} from '../authorization/scope.js';
const withoutTotal=(row:Record<string,unknown>)=>{const copy={...row};delete copy.total_count;return copy};

export type FleetStatus='ALL'|'OVERSPEED'|'RUNNING'|'IDLE'|'STOPPED'|'UNREACHABLE'|'NEW'|'INACTIVE';

const fleetCte=`${userScopeCte}, fleet AS (
  SELECT v.id,v.vehicle_number,v.alias,v.vehicle_type,v.active,v.overspeed_limit,v.owner_id,
    owner.email AS owner_email,owner.name AS client_name,owner.username AS client_username,d.id AS device_id,d.last_seen_at,ds.state,
    latest.tracker_timestamp,latest.server_received_at,latest.latitude,latest.longitude,latest.speed,latest.ignition,latest.gps_valid,
    latest.address,latest.address_attribution,ds.updated_at AS status_since_at,
    today.today_distance_km,today.today_running_seconds,today.today_stopped_seconds,today.today_avg_speed,today.today_max_speed,
    CASE WHEN last_stop.observed_at IS NULL OR latest.observed_at IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM (latest.observed_at-last_stop.observed_at)) END AS duration_from_last_stop_seconds,
    CASE WHEN last_stop.position IS NULL OR latest.position IS NULL THEN NULL ELSE ST_Distance(last_stop.position,latest.position)/1000.0 END AS distance_from_last_stop_km,
    NULL::double precision AS duration_at_last_stop_seconds,
    CASE
      WHEN NOT v.active THEN 'INACTIVE'
      WHEN d.id IS NULL THEN 'NEW'
      WHEN d.last_seen_at IS NULL OR d.last_seen_at<d.current_assigned_at OR d.last_seen_at<now()-($2::int*interval '1 minute') THEN 'UNREACHABLE'
      WHEN v.overspeed_limit IS NOT NULL AND COALESCE(latest.speed,CASE WHEN ds.updated_at>=d.current_assigned_at THEN ds.current_speed END,0)>v.overspeed_limit THEN 'OVERSPEED'
      WHEN ds.updated_at>=d.current_assigned_at AND ds.state='MOVING' THEN 'RUNNING'
      WHEN ds.updated_at>=d.current_assigned_at AND ds.state='IDLE' THEN 'IDLE'
      WHEN ds.updated_at>=d.current_assigned_at AND ds.state='STOPPED' THEN 'STOPPED'
      ELSE 'UNREACHABLE'
    END AS fleet_status
  FROM vehicles v
  JOIN user_scope scope ON scope.id=v.owner_id
  JOIN users owner ON owner.id=v.owner_id
  LEFT JOIN LATERAL (
    SELECT device.*,assignment.assigned_at AS current_assigned_at FROM vehicle_device_assignments assignment
    JOIN devices device ON device.id=assignment.device_id
    WHERE assignment.vehicle_id=v.id AND assignment.unassigned_at IS NULL
    ORDER BY device.last_seen_at DESC NULLS LAST LIMIT 1
  ) d ON true
  LEFT JOIN device_status ds ON ds.device_id=d.id
  LEFT JOIN LATERAL (
    SELECT l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,l.ignition,l.gps_valid,l.position,
      COALESCE(l.tracker_timestamp,l.server_received_at) AS observed_at,NULLIF(l.metadata->>'address','') AS address,l.metadata->>'address_attribution' AS address_attribution
    FROM locations l WHERE l.vehicle_id=v.id AND l.device_id=d.id AND l.server_received_at>=d.current_assigned_at
    ORDER BY l.server_received_at DESC LIMIT 1
  ) latest ON true
  LEFT JOIN LATERAL (
    SELECT
      SUM(CASE WHEN daily.gps_valid AND daily.position IS NOT NULL AND daily.previous_position IS NOT NULL THEN ST_Distance(daily.previous_position,daily.position) ELSE 0 END)/1000.0 AS today_distance_km,
      SUM(CASE WHEN daily.next_at IS NOT NULL AND COALESCE(daily.speed,0)>$3 THEN EXTRACT(EPOCH FROM (daily.next_at-daily.observed_at)) END) AS today_running_seconds,
      SUM(CASE WHEN daily.next_at IS NOT NULL AND daily.ignition=false AND COALESCE(daily.speed,0)<=$3 THEN EXTRACT(EPOCH FROM (daily.next_at-daily.observed_at)) END) AS today_stopped_seconds,
      AVG(daily.speed) FILTER(WHERE daily.speed>=0) AS today_avg_speed,
      MAX(daily.speed) FILTER(WHERE daily.speed>=0) AS today_max_speed
    FROM (
      SELECT l.position,l.gps_valid,l.speed,l.ignition,COALESCE(l.tracker_timestamp,l.server_received_at) AS observed_at,
        lag(l.position) OVER(ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at),l.id) AS previous_position,
        lead(COALESCE(l.tracker_timestamp,l.server_received_at)) OVER(ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at),l.id) AS next_at
      FROM locations l WHERE l.vehicle_id=v.id
        AND COALESCE(l.tracker_timestamp,l.server_received_at)>=date_trunc('day',now())
        AND COALESCE(l.tracker_timestamp,l.server_received_at)<date_trunc('day',now())+interval '1 day'
    ) daily
  ) today ON true
  LEFT JOIN LATERAL (
    SELECT l.position,COALESCE(l.tracker_timestamp,l.server_received_at) AS observed_at
    FROM locations l WHERE l.vehicle_id=v.id AND l.ignition=false AND COALESCE(l.speed,0)<=$3
    ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at) DESC,l.id DESC LIMIT 1
  ) last_stop ON true
)`;

export async function dashboardFleet(actorId:string,status:FleetStatus,search:string,page:number,pageSize:number,clientId?:string){
  const base=[actorId,env.NO_SIGNAL_TIMEOUT_MINUTES,env.MOVEMENT_THRESHOLD_KPH];
  const values=[...base,status,`%${search}%`,clientId??null,pageSize,(page-1)*pageSize];
  const rows=await query(`${fleetCte}
    SELECT *,count(*) OVER()::int AS total_count FROM fleet
    WHERE ($4='ALL' OR fleet_status=$4) AND ($5='%%' OR vehicle_number ILIKE $5 OR COALESCE(alias,'') ILIKE $5)
      AND ($6::uuid IS NULL OR owner_id=$6)
    ORDER BY vehicle_number,id LIMIT $7 OFFSET $8`,values);
  const counts=await query(`${fleetCte} SELECT fleet_status,count(*)::int AS count FROM fleet WHERE ($4::uuid IS NULL OR owner_id=$4) GROUP BY fleet_status`,[...base,clientId??null]);
  const mapped:Record<string,number>={ALL:0,OVERSPEED:0,RUNNING:0,IDLE:0,STOPPED:0,UNREACHABLE:0,NEW:0,INACTIVE:0};
  for(const row of counts.rows){mapped[String(row.fleet_status)]=Number(row.count);mapped.ALL+=Number(row.count)}
  return{rows:await enrichAddresses(rows.rows.map(withoutTotal)),total:Number(rows.rows[0]?.total_count??0),counts:mapped};
}
