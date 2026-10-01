import {query} from '../../db/pool.js';
import {userScopeCte} from '../authorization/scope.js';
import {packetActivity} from './activity.js';

export async function deviceLookup(actorId:string,search:string,page:number,pageSize:number){
  const result=await query(`${userScopeCte}
    SELECT d.id,d.imei,d.sim_number,d.protocol,d.active,d.last_seen_at,
      v.id AS vehicle_id,v.vehicle_number,v.sim_info,v.gps_location,
      owner.id AS client_id,owner.name AS client_name,owner.username AS client_username,owner.email AS client_email,
      admin.id AS admin_id,admin.name AS admin_name,admin.username AS admin_username,admin.email AS admin_email,
      count(*) OVER()::int AS total_count
    FROM devices d
    LEFT JOIN vehicle_device_assignments a ON a.device_id=d.id AND a.unassigned_at IS NULL
    LEFT JOIN vehicles v ON v.id=a.vehicle_id
    LEFT JOIN users owner ON owner.id=COALESCE(v.owner_id,d.owner_id)
    LEFT JOIN users admin ON admin.id=owner.owner_id
    WHERE (owner.id IN (SELECT id FROM user_scope) OR
      (owner.id IS NULL AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND role='SUPER_ADMIN')))
      AND ($2='%%' OR d.imei ILIKE $2 OR COALESCE(d.sim_number,'') ILIKE $2 OR COALESCE(v.vehicle_number,'') ILIKE $2)
    ORDER BY d.imei,d.id LIMIT $3 OFFSET $4`,[actorId,`%${search}%`,pageSize,(page-1)*pageSize]);
  return {rows:result.rows.map(({total_count,...row})=>row),total:Number(result.rows[0]?.total_count??0)};
}

export async function packetHealth(actorId:string,search:string,page:number,pageSize:number){
  const result=await deviceLookup(actorId,search,page,pageSize),now=new Date();
  return {...result,rows:result.rows.map(row=>({...row,...packetActivity(row.last_seen_at,now)}))};
}
