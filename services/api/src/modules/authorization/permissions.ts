import {permissionKeys,hasEffectivePermission,PERMISSIONS,type PermissionKey,type Role} from '@fleet/shared-types';
import {query,transaction} from '../../db/pool.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from './scope.js';
import type {PoolClient} from 'pg';

type AdminTarget={id:string;version:number};
export async function allAdminPermissionTargets(actorId:string){
  const rows=(await query<{id:string;permissions_version:number}>(`${userScopeCte} SELECT u.id,u.permissions_version FROM users u JOIN user_scope s ON s.id=u.id WHERE u.role='ADMIN' ORDER BY u.id`,[actorId])).rows;
  return {targets:rows.map(row=>({id:row.id,version:row.permissions_version}))};
}
async function writePermissions(client:PoolClient,actorId:string,id:string,allowed:PermissionKey[]){
  const before=(await client.query<{permission_key:string}>('SELECT permission_key FROM admin_permissions WHERE admin_id=$1 AND allowed=true ORDER BY permission_key',[id])).rows.map(row=>row.permission_key);
  const after=[...new Set(allowed)].sort();
  await client.query(`INSERT INTO admin_permissions(admin_id,permission_key,allowed)
    SELECT $1,key,key=ANY($2::text[]) FROM permissions ON CONFLICT(admin_id,permission_key)
    DO UPDATE SET allowed=EXCLUDED.allowed,updated_at=now()`,[id,after]);
  await client.query('UPDATE users SET permissions_version=permissions_version+1,can_view_packet_health=$2 WHERE id=$1',[id,after.includes(PERMISSIONS.packetHealthView)]);
  await client.query('INSERT INTO permission_change_audit(actor_id,admin_id,old_permissions,new_permissions) VALUES($1,$2,$3::jsonb,$4::jsonb)',[actorId,id,JSON.stringify(before),JSON.stringify(after)]);
  return after;
}
export async function saveAllAdminPermissions(actorId:string,allowed:PermissionKey[],targets:AdminTarget[]){
  return transaction(async client=>{
    if(!(await client.query("SELECT id FROM users WHERE id=$1 AND role='SUPER_ADMIN' AND active=true FOR SHARE",[actorId])).rows[0])throw new AppError(403,'FORBIDDEN','Only the super-admin can manage permissions');
    const rows=(await client.query<{id:string;permissions_version:number}>(`${userScopeCte} SELECT u.id,u.permissions_version FROM users u JOIN user_scope s ON s.id=u.id WHERE u.role='ADMIN' ORDER BY u.id FOR UPDATE OF u`,[actorId])).rows;
    const expected=new Map(targets.map(target=>[target.id,target.version]));
    if(expected.size!==targets.length||rows.length!==targets.length||rows.some(row=>expected.get(row.id)!==row.permissions_version))throw new AppError(409,'PERMISSIONS_CHANGED','Admin accounts or permissions changed. Reload before saving.');
    if(!rows.length)throw new AppError(400,'NO_ADMINS','No Admin accounts are available');
    for(const row of rows)await writePermissions(client,actorId,row.id,allowed);
    return {updated:rows.length,targets:rows.map(row=>({id:row.id,version:row.permissions_version+1}))};
  });
}

export async function effectivePermissions(id:string,role:Role) {
  if(role==='SUPER_ADMIN'||role!=='ADMIN')return permissionKeys;
  return (await query<{permission_key:PermissionKey}>('SELECT permission_key FROM admin_permissions WHERE admin_id=$1 AND allowed=true',[id])).rows.map(row=>row.permission_key);
}
export async function hasPermissionForUser(id:string,key:PermissionKey) {
  const user=(await query<{role:Role}>('SELECT role FROM users WHERE id=$1 AND active=true',[id])).rows[0];
  return Boolean(user && hasEffectivePermission(await effectivePermissions(id,user.role),key));
}
export async function adminPermissionDetail(actorId:string,id:string) {
  const admin=(await query(`${userScopeCte} SELECT u.id,u.name,u.username,u.email,u.mobile,u.active,u.created_at,u.permissions_version
    FROM users u JOIN user_scope s ON s.id=u.id WHERE u.id=$2 AND u.role='ADMIN'`,[actorId,id])).rows[0];
  if(!admin)throw new AppError(404,'ADMIN_NOT_FOUND','Admin not found');
  return {admin,permissions:await effectivePermissions(id,'ADMIN'),version:admin.permissions_version};
}
export async function saveAdminPermissions(actorId:string,id:string,allowed:PermissionKey[],version:number) {
  return transaction(async client=>{
    const actor=(await client.query("SELECT id FROM users WHERE id=$1 AND role='SUPER_ADMIN' AND active=true FOR SHARE",[actorId])).rows[0];
    if(!actor)throw new AppError(403,'FORBIDDEN','Only the super-admin can manage permissions');
    const admin=(await client.query(`${userScopeCte} SELECT u.id,u.name,u.username,u.email,u.mobile,u.active,u.created_at,u.permissions_version
      FROM users u JOIN user_scope s ON s.id=u.id WHERE u.id=$2 AND u.role='ADMIN' FOR UPDATE OF u`,[actorId,id])).rows[0];
    if(!admin)throw new AppError(404,'ADMIN_NOT_FOUND','Admin not found');
    if(admin.permissions_version!==version)throw new AppError(409,'PERMISSIONS_CHANGED','Permissions changed since you opened this admin. Reload before saving.');
    const after=await writePermissions(client,actorId,id,allowed);
    return {admin:{...admin,permissions_version:version+1},permissions:after,version:version+1};
  });
}
