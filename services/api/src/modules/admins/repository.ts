import bcrypt from 'bcrypt';
import { query } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { userScopeCte } from '../authorization/scope.js';
const withoutTotal=(row:Record<string,unknown>)=>{const copy={...row};delete copy.total_count;return copy};

export interface AdminInput {ownerId:string;username:string;password:string;name:string;mobile?:string;email:string;company?:string;website?:string;address?:string;coins:number;active:boolean}

export async function listAdmins(actorId:string,search:string,page:number,pageSize:number){
  const result=await query(`${userScopeCte}
    SELECT u.id,u.username,u.name,u.mobile,u.email,u.company,u.website,u.address,u.coins,u.active,u.owner_id,
      owner.name AS owner_name,owner.email AS owner_email,u.created_at,u.updated_at,
      count(DISTINCT v.id)::int AS vehicle_count,count(DISTINCT assignment.device_id)::int AS device_count,
      count(*) OVER()::int AS total_count
    FROM users u JOIN user_scope scope ON scope.id=u.id
    LEFT JOIN users owner ON owner.id=u.owner_id LEFT JOIN vehicles v ON v.owner_id=u.id
    LEFT JOIN vehicle_device_assignments assignment ON assignment.vehicle_id=v.id AND assignment.unassigned_at IS NULL
    WHERE u.id<>$1 AND u.role='ADMIN' AND ($2='%%' OR COALESCE(u.username,'') ILIKE $2 OR u.email ILIKE $2 OR COALESCE(u.name,'') ILIKE $2 OR COALESCE(u.company,'') ILIKE $2)
    GROUP BY u.id,owner.name,owner.email ORDER BY u.created_at DESC,u.id LIMIT $3 OFFSET $4`,
    [actorId,`%${search}%`,pageSize,(page-1)*pageSize]);
  return {rows:result.rows.map(withoutTotal),total:Number(result.rows[0]?.total_count??0)};
}

export const ownerOptions=(actorId:string)=>query(`${userScopeCte}
  SELECT u.id,u.name,u.email,u.username FROM users u JOIN user_scope scope ON scope.id=u.id
  WHERE u.active=true AND u.role IN ('SUPER_ADMIN','ADMIN') ORDER BY u.name NULLS LAST,u.email`,[actorId]);

export const clientOptions=(actorId:string)=>query(`${userScopeCte}
  SELECT u.id,u.name,u.email,u.username,u.owner_id FROM users u JOIN user_scope scope ON scope.id=u.id
  WHERE u.active=true AND u.role='CLIENT' ORDER BY u.name NULLS LAST,u.email`,[actorId]);

export async function createAdmin(actorId:string,input:AdminInput){
  const passwordHash=await bcrypt.hash(input.password,12);
  try{
    const result=await query(`${userScopeCte}, allowed_owner AS (
      SELECT u.id FROM users u JOIN user_scope scope ON scope.id=u.id
      WHERE u.id=$2 AND u.active=true AND u.role IN ('SUPER_ADMIN','ADMIN')
    ) INSERT INTO users(owner_id,username,email,password_hash,role,name,mobile,company,website,address,coins,active)
      SELECT id,$3,lower($4),$5,'ADMIN',$6,$7,$8,$9,$10,$11,$12 FROM allowed_owner
      RETURNING id,owner_id,username,email,role,name,mobile,company,website,address,coins,active,created_at,updated_at`,
      [actorId,input.ownerId,input.username.trim(),input.email.trim(),passwordHash,input.name.trim(),input.mobile||null,input.company||null,input.website||null,input.address||null,input.coins,input.active]);
    if(!result.rows[0])throw new AppError(403,'INVALID_OWNER','Owner is outside your authorized hierarchy');
    return result.rows[0];
  }catch(error){
    if(error&&typeof error==='object'&&'code' in error&&(error as {code:string}).code==='23505')throw new AppError(409,'ADMIN_EXISTS','Username or email already exists');
    throw error;
  }
}

export const setAdminActive=(actorId:string,id:string,active:boolean)=>query(`${userScopeCte}
  UPDATE users u SET active=$3,updated_at=now() FROM user_scope scope
  WHERE u.id=$2 AND u.id=scope.id AND u.id<>$1 AND u.role='ADMIN'
  RETURNING u.id,u.active,u.updated_at`,[actorId,id,active]);
