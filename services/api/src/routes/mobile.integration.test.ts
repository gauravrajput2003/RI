import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
const state=vi.hoisted(()=>({db:undefined as PGlite|undefined}));
vi.mock('../db/pool.js',()=>{
 const query=async(sql:string,values?:unknown[])=>{const r=await state.db!.query(sql,values);return {rows:r.rows,rowCount:r.affectedRows||r.rows.length}};
 return {query,transaction:async<T>(work:(client:{query:typeof query})=>Promise<T>)=>{await state.db!.exec('BEGIN');try{const result=await work({query});await state.db!.exec('COMMIT');return result}catch(e){await state.db!.exec('ROLLBACK');throw e}}};
});
const admin=randomUUID(),client=randomUUID(),foreign=randomUUID(),vehicle=randomUUID(),otherVehicle=randomUUID();
let app:express.Express,adminToken:string,clientToken:string,refreshToken:string;
const call=(method:'get'|'post'|'patch',path:string,token=clientToken)=>request(app)[method]('/api/v1'+path).set('Authorization',`Bearer ${token}`);
beforeAll(async()=>{
 process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';process.env.JWT_SECRET='mobile-integration-secret-at-least-32-characters';process.env.JWT_REFRESH_SECRET='mobile-integration-refresh-secret-at-least-32-characters';process.env.INTERNAL_TRACKER_SECRET='mobile-integration-internal-secret-at-least-32-characters';process.env.ACCOUNT_PASSWORD_ENCRYPTION_KEY='a'.repeat(64);
 state.db=new PGlite();
 for(const name of ['001_initial.sql','002_current_device_state.sql','003_web_admin_foundation.sql','004_client_management.sql','005_vehicle_management.sql','009_coin_distribution.sql','011_user_avatars.sql','012_vehicle_installation_info.sql','013_user_ownership_integrity.sql','014_packet_health_permission.sql','015_account_password_recovery.sql','016_coin_management.sql','017_device_sim_info.sql','018_admin_permissions.sql','019_mobile_actions.sql']){
  let sql=await readFile(new URL(`../../../../database/migrations/${name}`,import.meta.url),'utf8');sql=sql.replace(/CREATE EXTENSION IF NOT EXISTS \w+;/g,'').replace(/geography\(Point, 4326\)/g,'point').replace(/CREATE INDEX locations_position_gist[^;]+;/g,'');await state.db.exec(sql);
 }
 await state.db.exec('CREATE TABLE geofences(id uuid PRIMARY KEY);');
 for(const name of ['007_alerts_and_announcements.sql','008_subscription_alerts.sql','010_announcement_recipients.sql','011_announcement_images.sql'])await state.db.exec(await readFile(new URL(`../../../../database/migrations/${name}`,import.meta.url),'utf8'));
 const hash=await bcrypt.hash('original-password',4),root=randomUUID(),otherAdmin=randomUUID();
 await state.db.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,'root@test.local',$2,'SUPER_ADMIN')",[root,hash]);
 await state.db.query("INSERT INTO users(id,email,username,password_hash,role,name,owner_id) VALUES($1,'admin@test.local','admin.mobile',$4,'ADMIN','Admin',$3),($2,'other.admin@test.local','other.admin',$4,'ADMIN','Other',$3)",[admin,otherAdmin,root,hash]);
 await state.db.query("INSERT INTO users(id,email,username,password_hash,role,name,owner_id) VALUES($1,'client@test.local','client.mobile',$5,'CLIENT','Client',$3),($2,'foreign@test.local','foreign.mobile',$5,'CLIENT','Foreign',$4)",[client,foreign,admin,otherAdmin,hash]);
 await state.db.query("INSERT INTO vehicles(id,vehicle_number,owner_id) VALUES($1,'OWN-1',$2),($3,'FOREIGN-1',$4)",[vehicle,client,otherVehicle,foreign]);
 const {api}=await import('./api.js'),{errorHandler}=await import('../lib/errors.js');app=express();app.use(express.json());app.use('/api/v1',api);app.use(errorHandler);
 const login=async(identifier:string)=>(await request(app).post('/api/v1/auth/login').send({identifier,password:'original-password'}).expect(200)).body.data;
 adminToken=(await login('admin.mobile')).accessToken;const session=await login('client.mobile');clientToken=session.accessToken;refreshToken=session.refreshToken;
},30000);
afterAll(async()=>state.db?.close());
describe('persisted mobile roles and ownership',()=>{
 it('shows only the direct parent contact, ignoring forged IDs and never falling back to root details',async()=>{
  const root=(await state.db!.query<{owner_id:string}>('SELECT owner_id FROM users WHERE id=$1',[admin])).rows[0].owner_id;
  await state.db!.query("UPDATE users SET name='RI Support',mobile='9999999999',avatar_url='https://example.test/root.png' WHERE id=$1",[root]);
  await state.db!.query("UPDATE users SET mobile='8888888888',avatar_url='https://example.test/admin.png' WHERE id=$1",[admin]);
  const direct=await call('get',`/mobile/support-contact?parentId=${root}&userId=${foreign}`).expect(200);
  expect(direct.body.data).toEqual({name:'Admin',phone:'8888888888',email:'admin@test.local',logoUrl:'https://example.test/admin.png'});
  expect(direct.headers['cache-control']).toBe('no-store');
  expect((await call('get','/mobile/support-contact',adminToken).expect(200)).body.data).toEqual({name:'RI Support',phone:'9999999999',email:'root@test.local',logoUrl:'https://example.test/root.png'});
  const childAdmin=randomUUID();
  await state.db!.query("INSERT INTO users(id,email,password_hash,role,owner_id) VALUES($1,'child.admin@test.local','unused','ADMIN',$2)",[childAdmin,admin]);
  const childToken=jwt.sign({id:childAdmin,role:'ADMIN'},process.env.JWT_SECRET!);
  expect((await call('get','/mobile/support-contact',childToken).expect(200)).body.data.name).toBe('Admin');
  await state.db!.query('UPDATE users SET mobile=NULL,avatar_url=NULL WHERE id=$1',[admin]);
  expect((await call('get','/mobile/support-contact').expect(200)).body.data).toEqual({name:'Admin',phone:null,email:'admin@test.local',logoUrl:null});
  const rootToken=jwt.sign({id:root,role:'SUPER_ADMIN'},process.env.JWT_SECRET!);
  expect((await call('get','/mobile/support-contact',rootToken).expect(200)).body.data).toBeNull();
  await request(app).get('/api/v1/mobile/support-contact').expect(401);
 });
 it('returns the actual role and computed account balance',async()=>{
  expect((await call('get','/mobile/session').expect(200)).body.data).toMatchObject({id:client,role:'CLIENT',coins:'0'});
  expect((await call('get','/mobile/session',adminToken).expect(200)).body.data.role).toBe('ADMIN');
 });
 it('blocks client creation, announcement management, and mobile admin creation',async()=>{
  await call('post','/vehicles').send({vehicleNumber:'INVALID'}).expect(403);
  await call('post','/fleet-vehicles').send({}).expect(403);
  await call('get','/announcements').expect(403);await call('post','/announcements').send({}).expect(403);
  await call('post','/mobile/admins',adminToken).send({}).expect(403);
 });
 it('retains client edit, rejects cross-owner changes and unexpected registration fields',async()=>{
  await call('patch',`/mobile/vehicles/${vehicle}`).send({alias:'My bike',remark:'Updated'}).expect(200);
  expect((await call('get',`/mobile/vehicles/${vehicle}`).expect(200)).body.data.alias).toBe('My bike');
  await call('patch',`/mobile/vehicles/${otherVehicle}`).send({alias:'IDOR'}).expect(404);
  await call('patch',`/mobile/vehicles/${vehicle}`).send({ownerId:foreign}).expect(400);
 });
 it('persists client vehicle details across app, web, parent admin and super-admin reads',async()=>{
  const root=(await state.db!.query<{owner_id:string}>('SELECT owner_id FROM users WHERE id=$1',[admin])).rows[0].owner_id;
  const rootToken=jwt.sign({id:root,role:'SUPER_ADMIN'},process.env.JWT_SECRET!);
  const input={vehicleNumber:'CLIENT-EDIT',vehicleType:'Scooty',mileage:30,odometer:125.5,overspeedLimit:90,alias:'Test Bike',gpsLocation:'Under the seat'};
  await call('patch',`/mobile/vehicles/${vehicle}`).send(input).expect(200);
  const expected={vehicle_number:'CLIENT-EDIT',vehicle_type:'Scooty',mileage:'30',odometer:'125.5',overspeed_limit:'90',alias:'Test Bike',gps_location:'Under the seat'};
  for(const token of [clientToken,adminToken,rootToken])expect((await call('get',`/mobile/vehicles/${vehicle}`,token).expect(200)).body.data).toMatchObject(expected);
  // The web edit writes the same vehicle row as the app.
  await call('patch',`/web/client-vehicles/${vehicle}`).send({gpsLocation:'Upper dashboard',odometer:0,mileage:0}).expect(200);
  expect((await call('get',`/mobile/vehicles/${vehicle}`).expect(200)).body.data).toMatchObject({gps_location:'Upper dashboard',odometer:'0',mileage:'0'});
  await call('patch',`/web/client-vehicles/${otherVehicle}`).send({vehicleNumber:'IDOR'}).expect(404);
  for(const path of [`/web/client-vehicles/${vehicle}`,`/mobile/vehicles/${vehicle}`]){
   for(const body of [{mileage:-1},{odometer:-1},{overspeedLimit:301},{vehicleNumber:' '},{deviceImei:'forged'},{coins:100},{ownerId:foreign}])await call('patch',path).send(body).expect(400);
  }
  // Restore the fixture's registration for existing share tests.
  await call('patch',`/mobile/vehicles/${vehicle}`).send({vehicleNumber:'OWN-1'}).expect(200);
 });
 it('allows the admin to edit its client fleet and create through the existing managed flow',async()=>{
  await call('patch',`/mobile/vehicles/${vehicle}`,adminToken).send({alias:'Admin update'}).expect(200);
  const r=await call('post','/fleet-vehicles',adminToken).send({adminId:admin,clientId:client,deviceImei:'MOBILE-123456',deviceProtocol:'GT06',simOperator:'Jio',vehicleNumber:'NEW-MOBILE',vehicleType:'bike',mileage:30,overspeedLimit:80,coins:0,active:true}).expect(201);
  expect(r.body.data.owner_id).toBe(client);
 });
 it('keeps announcement targets inside the admin hierarchy',async()=>{
  const input={targetType:'CLIENT',adminIds:[admin],messageType:'TEXT',title:'Notice',bodyHtml:'Service message',startsAt:new Date().toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),active:true,dontShowAgain:true};
  await call('post','/announcements',adminToken).send({...input,clientIds:[foreign]}).expect(403);
  await call('post','/announcements',adminToken).send({...input,clientIds:[client]}).expect(201);
 });
 it('persists per-user notification mute without modifying another user',async()=>{
  await call('patch',`/mobile/vehicles/${vehicle}/notifications`).send({muted:true}).expect(200);
  expect((await call('get',`/mobile/vehicles/${vehicle}/notifications`).expect(200)).body.data).toEqual({muted:true,items:[]});
  expect((await call('get',`/mobile/vehicles/${vehicle}/notifications`,adminToken).expect(200)).body.data.muted).toBe(false);
  await call('patch',`/mobile/vehicles/${otherVehicle}/notifications`).send({muted:false}).expect(404);
 });
 it('uses opaque, expiring share tokens with a strictly limited public payload',async()=>{
  await call('post',`/mobile/vehicles/${otherVehicle}/shares`).send({minutes:5}).expect(404);
  await call('post',`/mobile/vehicles/${vehicle}/shares`).send({minutes:999999}).expect(400);
  const created=(await call('post',`/mobile/vehicles/${vehicle}/shares`).send({minutes:5}).expect(201)).body.data;
  expect(created.token).toMatch(/^[\w-]{43}$/);
  const shared=await request(app).get(`/api/v1/shared-vehicles/${created.token}`).expect(200);
  expect(Object.keys(shared.body.data).sort()).toEqual(['expiresAt','location','vehicleNumber']);
  expect(shared.body.data.vehicleNumber).toBe('OWN-1');
  await request(app).get(`/api/v1/shared-vehicles/${created.token}`).set('Accept','text/html').expect('Content-Type',/html/).expect(200);
  await state.db!.exec("UPDATE vehicle_share_sessions SET expires_at=now()-interval '1 second'");
  await request(app).get(`/api/v1/shared-vehicles/${created.token}`).expect(404);
 });
 it('enforces changed admin grants on every mobile action',async()=>{
  await state.db!.query("UPDATE admin_permissions SET allowed=false WHERE admin_id=$1 AND permission_key='vehicle.edit'",[admin]);
  await call('patch',`/mobile/vehicles/${vehicle}`,adminToken).send({alias:'Blocked'}).expect(403);
  await state.db!.query("UPDATE admin_permissions SET allowed=true WHERE admin_id=$1 AND permission_key='vehicle.edit'",[admin]);
 });
 it('validates passwords, revokes refresh sessions, and authenticates only the new password',async()=>{
  const path='/mobile/change-password';
  let r=await call('post',path).send({currentPassword:'wrong',newPassword:'new-password-123',confirmPassword:'new-password-123'}).expect(400);expect(r.body.error.message).toBe('Current password is incorrect.');
  r=await call('post',path).send({currentPassword:'original-password',newPassword:'new-password-123',confirmPassword:'different-password'}).expect(400);expect(r.body.error.message).toBe('New passwords do not match.');
  await call('post',path).send({currentPassword:'original-password',newPassword:'short',confirmPassword:'short'}).expect(400);
  await call('post',path).send({currentPassword:'original-password',newPassword:'new-password-123',confirmPassword:'new-password-123'}).expect(200);
  await request(app).post('/api/v1/auth/refresh').send({refreshToken}).expect(401);
  await request(app).post('/api/v1/auth/login').send({identifier:'client.mobile',password:'original-password'}).expect(401);
  await request(app).post('/api/v1/auth/login').send({identifier:'client.mobile',password:'new-password-123'}).expect(200);
 });
});
