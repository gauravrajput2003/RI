import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {PERMISSIONS as P,permissionDefinitions,permissionKeys,type PermissionKey} from '@fleet/shared-types';
const state=vi.hoisted(()=>({db:undefined as PGlite|undefined}));
vi.mock('../db/pool.js',()=>{const query=async(sql:string,values?:unknown[])=>{const r=await state.db!.query(sql,values);return{rows:r.rows,rowCount:r.affectedRows||r.rows.length}};return{query,transaction:async<T>(work:(client:{query:typeof query})=>Promise<T>)=>{await state.db!.exec('BEGIN');try{const result=await work({query});await state.db!.exec('COMMIT');return result}catch(e){await state.db!.exec('ROLLBACK');throw e}}}});
const root=randomUUID(),admin=randomUUID(),other=randomUUID(),client=randomUUID(),vehicle=randomUUID(),foreignVehicle=randomUUID();
const secret='permissions-test-secret-at-least-32-characters';let app:express.Express,hash:string;
const auth=(id=root,role='SUPER_ADMIN')=>({Authorization:`Bearer ${jwt.sign({id,role},secret)}`});
const path=(id=admin)=>`/api/v1/super-admin/permissions/${id}`;
async function save(keys:readonly PermissionKey[],id=admin){const detail=await request(app).get(path(id)).set(auth()).expect(200);return request(app).put(path(id)).set(auth()).send({permissions:keys,version:detail.body.data.version}).expect(200)}
beforeAll(async()=>{
 process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';process.env.JWT_SECRET=secret;process.env.JWT_REFRESH_SECRET=secret+'-refresh';process.env.INTERNAL_TRACKER_SECRET=secret+'-internal';
 state.db=new PGlite();
 for(const name of ['001_initial.sql','002_current_device_state.sql','003_web_admin_foundation.sql','004_client_management.sql','005_vehicle_management.sql','009_coin_distribution.sql','012_vehicle_installation_info.sql','013_user_ownership_integrity.sql','014_packet_health_permission.sql','015_account_password_recovery.sql','016_coin_management.sql','017_device_sim_info.sql','018_admin_permissions.sql']){
  const sql=(await readFile(new URL(`../../../../database/migrations/${name}`,import.meta.url),'utf8')).replace(/CREATE EXTENSION IF NOT EXISTS \w+;/g,'').replace(/geography\(Point, 4326\)/g,'point').replace(/CREATE INDEX locations_position_gist[^;]+;/g,'');await state.db.exec(sql);
 }
 await state.db.exec("CREATE FUNCTION ST_Distance(point,point) RETURNS double precision LANGUAGE SQL AS 'SELECT 0::double precision';");
 hash=await bcrypt.hash('permission-password',4);const {api}=await import('./api.js'),{errorHandler}=await import('../lib/errors.js');app=express();app.use(express.json());app.use('/api/v1',api);app.use(errorHandler);
},30000);
afterAll(async()=>state.db?.close());
beforeEach(async()=>{
 await state.db!.exec('TRUNCATE users,devices CASCADE');await state.db!.exec('INSERT INTO issuance_settings DEFAULT VALUES');
 for(const [id,role,parent,name] of [[root,'SUPER_ADMIN',null,'root'],[admin,'ADMIN',root,'admin'],[other,'ADMIN',root,'other'],[client,'CLIENT',admin,'client']])await state.db!.query('INSERT INTO users(id,role,owner_id,username,name,email,password_hash,active) VALUES($1,$2,$3,$4,$4,$5,$6,true)',[id,role,parent,name,`${name}@test.local`,hash]);
 await state.db!.query("INSERT INTO vehicles(id,vehicle_number,owner_id) VALUES($1,'OWN',$2),($3,'FOREIGN',$4)",[vehicle,client,foreignVehicle,other]);
});
it('keeps SQL catalogue identical to the registry and creates full access defaults only for Admins',async()=>{
 const catalogue=await request(app).get('/api/v1/super-admin/permissions/catalogue').set(auth()).expect(200);expect(catalogue.body.data).toEqual(permissionDefinitions);
 const rows=await state.db!.query<{key:string}>('SELECT key FROM permissions ORDER BY key');expect(rows.rows.map(r=>r.key)).toEqual([...permissionKeys].sort());
 expect((await request(app).get(path()).set(auth()).expect(200)).body.data.permissions.sort()).toEqual([...permissionKeys].sort());
 expect((await state.db!.query('SELECT admin_id FROM admin_permissions WHERE admin_id IN ($1,$2)',[root,client])).rows).toEqual([]);
 await expect(state.db!.query('INSERT INTO admin_permissions(admin_id,permission_key) VALUES($1,$2)',[root,P.vehicleView])).rejects.toThrow(/Admin/);
});
it('restricts permission management, rejects role spoofing, non-admin targets and unknown keys',async()=>{
 for(const id of [admin,other,client]){
  await request(app).get(path()).set(auth(id)).expect(403);
  await request(app).put(path()).set(auth(id)).send({permissions:permissionKeys,version:0,role:'SUPER_ADMIN'}).expect(403);
 }
 for(const id of [root,client,randomUUID()])await request(app).get(path(id)).set(auth()).expect(404);
 await request(app).put(path()).set(auth()).send({permissions:['invented.view'],version:0}).expect(400);
 await request(app).put(path()).set(auth()).send({permissions:[P.vehicleEdit],version:0}).expect(400);
});
it('persists restrictions across login, isolates other admins, audits changes and restores defaults',async()=>{
 const allowed=permissionKeys.filter(key=>key!==P.playbackView&&key!==P.vehicleDelete);
 const changed=await save(allowed);expect(changed.body.data.version).toBe(1);
 const login=await request(app).post('/api/v1/auth/login').send({identifier:'admin',password:'permission-password'}).expect(200);
 const current=await request(app).get('/api/v1/auth/permissions').set({Authorization:`Bearer ${login.body.data.accessToken}`}).expect(200);
 expect(current.body.data.permissions.sort()).toEqual([...allowed].sort());
 expect((await request(app).get('/api/v1/auth/permissions').set(auth(other,'ADMIN')).expect(200)).body.data.permissions).toContain(P.playbackView);
 const audit=(await state.db!.query<{actor_id:string;admin_id:string;old_permissions:string[];new_permissions:string[]}>('SELECT * FROM permission_change_audit')).rows[0];
 expect(audit).toMatchObject({actor_id:root,admin_id:admin});expect(audit.old_permissions).toContain(P.vehicleDelete);expect(audit.new_permissions).not.toContain(P.vehicleDelete);
 await save(permissionKeys);expect((await request(app).get(path()).set(auth()).expect(200)).body.data.permissions.sort()).toEqual([...permissionKeys].sort());
});
it('rejects stale saves without losing changes or writing an audit entry',async()=>{
 await save([P.dashboardView]);await request(app).put(path()).set(auth()).send({permissions:permissionKeys,version:0}).expect(409);
 expect((await request(app).get(path()).set(auth()).expect(200)).body.data.permissions).toEqual([P.dashboardView]);
 expect((await state.db!.query('SELECT * FROM permission_change_audit')).rows).toHaveLength(1);
});
it('selects all Admins across the hierarchy and atomically applies permissions with individual audit records',async()=>{
 const nested=randomUUID();await state.db!.query("INSERT INTO users(id,role,owner_id,email,password_hash) VALUES($1,'ADMIN',$2,'nested@test.local',$3)",[nested,admin,hash]);
 const endpoint='/api/v1/super-admin/permissions/all';
 for(const id of [admin,client]){await request(app).get(endpoint).set(auth(id)).expect(403);await request(app).put(endpoint).set(auth(id)).send({}).expect(403)}
 const snapshot=(await request(app).get(endpoint).set(auth()).expect(200)).body.data;
 expect(snapshot.targets.map((target:{id:string})=>target.id).sort()).toEqual([admin,other,nested].sort());
 const saved=(await request(app).put(endpoint).set(auth()).send({permissions:[P.dashboardView],targets:snapshot.targets}).expect(200)).body.data;
 expect(saved.updated).toBe(3);
 for(const id of [admin,other,nested])expect((await request(app).get(path(id)).set(auth()).expect(200)).body.data.permissions).toEqual([P.dashboardView]);
 expect((await state.db!.query('SELECT * FROM permission_change_audit')).rows).toHaveLength(3);
 expect((await state.db!.query('SELECT * FROM admin_permissions WHERE admin_id IN ($1,$2)',[root,client])).rows).toEqual([]);
});
it('rejects stale or incomplete bulk selections without partially updating any Admin',async()=>{
 const endpoint='/api/v1/super-admin/permissions/all';
 const snapshot=(await request(app).get(endpoint).set(auth()).expect(200)).body.data;
 await request(app).put(endpoint).set(auth()).send({permissions:[],targets:snapshot.targets.slice(0,1)}).expect(409);
 await save([P.dashboardView]);
 await request(app).put(endpoint).set(auth()).send({permissions:[],targets:snapshot.targets}).expect(409);
 expect((await request(app).get(path(other)).set(auth()).expect(200)).body.data.permissions.sort()).toEqual([...permissionKeys].sort());
 expect((await state.db!.query('SELECT * FROM permission_change_audit')).rows).toHaveLength(1);
 const fresh=(await request(app).get(endpoint).set(auth()).expect(200)).body.data;
 await request(app).put(endpoint).set(auth()).send({permissions:[P.vehicleEdit],targets:fresh.targets}).expect(400);
});
const cases:Array<[PermissionKey,string,string]>=[
 [P.vehicleView,'get','/fleet-vehicles'],[P.vehicleView,'get','/vehicles'],[P.vehicleAdd,'post','/vehicles'],[P.vehicleAdd,'post','/fleet-vehicles'],[P.vehicleEdit,'patch','/vehicles/ID'],[P.vehicleEdit,'put','/fleet-vehicles/ID'],[P.vehicleDelete,'delete','/vehicles/ID'],[P.vehicleDelete,'delete','/fleet-vehicles/ID'],
 [P.adminView,'get','/admins'],[P.adminAdd,'post','/admins'],[P.adminEdit,'patch','/admins/ID'],[P.adminDelete,'delete','/admins/ID'],
 [P.clientView,'get','/clients'],[P.clientAdd,'post','/clients'],[P.clientEdit,'patch','/clients/ID'],[P.clientEdit,'post','/clients/ID/reset-password'],[P.clientDelete,'delete','/clients/ID'],
 [P.geofenceView,'get','/geofences'],[P.geofenceAdd,'post','/geofences'],[P.geofenceEdit,'patch','/geofences/ID'],[P.geofenceDelete,'delete','/geofences/ID'],
 [P.alertView,'get','/alerts'],[P.alertAdd,'post','/alerts'],[P.alertEdit,'patch','/alerts/ID/status'],[P.alertDelete,'delete','/alerts/ID'],
 [P.announcementView,'get','/announcements'],[P.announcementAdd,'post','/announcements'],[P.announcementEdit,'patch','/announcements/ID'],[P.announcementDelete,'delete','/announcements/ID'],
 [P.playbackView,'get','/playback'],[P.playbackView,'get','/vehicles/ID/history'],[P.dashboardView,'get','/dashboard/vehicles'],[P.notificationsView,'get','/notifications'],
 [P.coinDistributionView,'get','/coin-flow'],[P.coinDistributionAdd,'post','/coin-sales'],[P.coinDistributionAdd,'post','/coin-grants'],[P.packetHealthView,'get','/web/packet-health'],
 [P.deviceView,'get','/devices'],[P.eventView,'get','/events'],[P.groupView,'get','/groups'],[P.subscriptionView,'get','/subscriptions'],[P.profileView,'get','/account-summary'],[P.profileEdit,'post','/account-avatar'],
 ...permissionDefinitions.filter(d=>d.group==='Reports').map(d=>[d.key,'get',`/reports/${d.resource.slice('reports.'.length)}`] as [PermissionKey,string,string]),
];
it.each(cases)('denies revoked %s on %s %s before validation or resource access',async(key,method,route)=>{
 const definition=permissionDefinitions.find(d=>d.key===key)!;
 await save(permissionKeys.filter(k=>k!==key&&(definition.action!=='view'||permissionDefinitions.find(d=>d.key===k)!.resource!==definition.resource)));
 const response=await request(app)[method as 'get']('/api/v1'+route.replace('ID',vehicle)).set(auth(admin,'ADMIN')).send({}).expect(403);
 expect(response.body).toMatchObject({success:false,error:{code:'FORBIDDEN'}});
});
it('preserves ownership checks with grants, prevents coin and legacy packet escalation, and never restricts Super Admin',async()=>{
 await request(app).get(`/api/v1/vehicles/${foreignVehicle}`).set(auth(admin,'ADMIN')).expect(404);
 await save(permissionKeys.filter(key=>key!==P.coinDistributionAdd));
 await request(app).post('/api/v1/admins').set(auth(admin,'ADMIN')).send({coins:5}).expect(403);
 await request(app).patch(`/api/v1/admins/${other}`).set(auth(admin,'ADMIN')).send({canViewPacketHealth:true}).expect(404);
 await save([]);
 await request(app).get('/api/v1/fleet-vehicles').set(auth(admin,'ADMIN')).expect(403);
 await request(app).get('/api/v1/fleet-vehicles').set(auth()).expect(200);
 await request(app).get('/api/v1/auth/permissions').set(auth(admin,'ADMIN')).expect(200);
});
it('preserves existing packet-health grants during backfill while new Admins receive full access',async()=>{
 const db=new PGlite();try{
  await db.exec('CREATE TABLE users(id uuid PRIMARY KEY,role text,can_view_packet_health boolean);');
  await db.query("INSERT INTO users(id,role,can_view_packet_health) VALUES($1,'ADMIN',false),($2,'ADMIN',true)",[admin,other]);
  await db.exec(await readFile(new URL('../../../../database/migrations/018_admin_permissions.sql',import.meta.url),'utf8'));
  expect((await db.query('SELECT admin_id,allowed FROM admin_permissions WHERE permission_key=$1 ORDER BY allowed',[P.packetHealthView])).rows).toEqual([{admin_id:admin,allowed:false},{admin_id:other,allowed:true}]);
  const id=randomUUID();await db.query("INSERT INTO users(id,role,can_view_packet_health) VALUES($1,'ADMIN',false)",[id]);
  expect((await db.query('SELECT * FROM admin_permissions WHERE admin_id=$1 AND allowed=false',[id])).rows).toEqual([]);
 }finally{await db.close()}
});
