import { query } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { userScopeCte } from '../authorization/scope.js';
const withoutTotal=(row:Record<string,unknown>)=>{const copy={...row};delete copy.total_count;return copy};

export type FleetStatus = 'ALL'|'OVERSPEED'|'RUNNING'|'IDLE'|'STOPPED'|'UNREACHABLE'|'NEW'|'INACTIVE';

const fleetCte = `${userScopeCte}, fleet AS (
  SELECT v.id,v.vehicle_number,v.alias,v.vehicle_type,v.active,v.overspeed_limit,v.owner_id,
    owner.email AS owner_email,d.id AS device_id,d.last_seen_at,ds.state,
    latest.tracker_timestamp,latest.server_received_at,latest.latitude,latest.longitude,latest.speed,
    CASE
      WHEN NOT v.active THEN 'INACTIVE'
      WHEN d.id IS NULL THEN 'NEW'
      WHEN d.last_seen_at IS NULL OR d.last_seen_at < now()-($2::int * interval '1 second') THEN 'UNREACHABLE'
      WHEN v.overspeed_limit IS NOT NULL AND COALESCE(latest.speed,ds.current_speed,0)>v.overspeed_limit THEN 'OVERSPEED'
      WHEN ds.state='MOVING' THEN 'RUNNING'
      WHEN ds.state='IDLE' THEN 'IDLE'
      WHEN ds.state='STOPPED' THEN 'STOPPED'
      ELSE 'UNREACHABLE'
    END AS fleet_status
  FROM vehicles v
  JOIN user_scope scope ON scope.id=v.owner_id
  JOIN users owner ON owner.id=v.owner_id
  LEFT JOIN LATERAL (
    SELECT device.* FROM vehicle_device_assignments assignment
    JOIN devices device ON device.id=assignment.device_id
    WHERE assignment.vehicle_id=v.id AND assignment.unassigned_at IS NULL
    ORDER BY device.last_seen_at DESC NULLS LAST LIMIT 1
  ) d ON true
  LEFT JOIN device_status ds ON ds.device_id=d.id
  LEFT JOIN LATERAL (
    SELECT l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed
    FROM locations l WHERE l.vehicle_id=v.id AND l.device_id=d.id
    ORDER BY l.server_received_at DESC LIMIT 1
  ) latest ON true
)`;

export async function dashboardFleet(actorId:string, status:FleetStatus, search:string, page:number, pageSize:number) {
  const values=[actorId,env.OFFLINE_TIMEOUT_SECONDS,status,`%${search}%`,pageSize,(page-1)*pageSize];
  const rows=await query(`${fleetCte}
    SELECT *,count(*) OVER()::int AS total_count FROM fleet
    WHERE ($3='ALL' OR fleet_status=$3) AND ($4='%%' OR vehicle_number ILIKE $4 OR COALESCE(alias,'') ILIKE $4)
    ORDER BY vehicle_number,id LIMIT $5 OFFSET $6`,values);
  const counts=await query(`${fleetCte} SELECT fleet_status,count(*)::int AS count FROM fleet GROUP BY fleet_status`,[actorId,env.OFFLINE_TIMEOUT_SECONDS]);
  const mapped:Record<string,number>={ALL:0,OVERSPEED:0,RUNNING:0,IDLE:0,STOPPED:0,UNREACHABLE:0,NEW:0,INACTIVE:0};
  for(const row of counts.rows){mapped[String(row.fleet_status)]=Number(row.count);mapped.ALL+=Number(row.count)}
  return {rows:rows.rows.map(withoutTotal),total:Number(rows.rows[0]?.total_count??0),counts:mapped};
}
