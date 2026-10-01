import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
const state=vi.hoisted(()=>({db:undefined as PGlite|undefined}));
vi.mock('../db/pool.js',()=>{const query=async(sql:string,values?:unknown[])=>{const result=await state.db!.query(sql,values);return {rows:result.rows,rowCount:result.affectedRows||result.rows.length}};return{query,transaction:async<T>(work:(client:{query:typeof query})=>Promise<T>)=>{await state.db!.exec('BEGIN');try{const value=await work({query});await state.db!.exec('COMMIT');return value}catch(error){await state.db!.exec('ROLLBACK');throw error}}}});
const secret='super-admin-integration-secret-32-characters';
const root=randomUUID(),a=randomUUID(),b=randomUUID(),client=randomUUID(),other=randomUUID(),otherClient=randomUUID(),vehicle=randomUUID(),otherVehicle=randomUUID(),device=randomUUID(),otherDevice=randomUUID();
let app:express.Express,passwordHash:string;
const auth=(id:string=root,role='SUPER_ADMIN')=>({Authorization:`Bearer ${jwt.sign({id,role},secret)}`});
const range={start:'2026-09-17T00:00:00Z',end:'2026-09-18T00:00:00Z',timeZone:'UTC'};
const payload=()=>({adminId:b,clientId:client,deviceImei:'GPS-12345',deviceProtocol:'GT06',simNumber:'9876543210',simOperator:'Jio',vehicleNumber:'DEEP-01',vehicleType:'Car',mileage:10,overspeedLimit:80,coins:0,active:true,simInfo:'SIM serial',gpsLocation:'Upper dashboard'});
beforeAll(async()=>{
  process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';process.env.JWT_SECRET=secret;process.env.JWT_REFRESH_SECRET=secret+'-refresh';process.env.INTERNAL_TRACKER_SECRET=secret+'-internal';process.env.EXPECTED_PACKET_INTERVAL_SECONDS='10';process.env.NO_SIGNAL_TIMEOUT_MINUTES='30';
  state.db=new PGlite();
  for(const name of ['001_initial.sql','002_current_device_state.sql','003_web_admin_foundation.sql','004_client_management.sql','005_vehicle_management.sql','009_coin_distribution.sql','012_vehicle_installation_info.sql','013_user_ownership_integrity.sql','014_packet_health_permission.sql']){
    let sql=await readFile(new URL(`../../../../database/migrations/${name}`,import.meta.url),'utf8');sql=sql.replace(/CREATE EXTENSION IF NOT EXISTS \w+;/g,'').replace(/geography\(Point, 4326\)/g,'point').replace(/CREATE INDEX locations_position_gist[^;]+;/g,'');await state.db.exec(sql);
  }
  await state.db.exec(`CREATE DOMAIN geometry AS point; CREATE FUNCTION ST_Distance(geometry,geometry) RETURNS double precision LANGUAGE SQL AS 'SELECT 0::double precision';`);
  passwordHash=await bcrypt.hash('test-password',4);
  const {api}=await import('./api.js'),{errorHandler}=await import('../lib/errors.js');app=express();app.use(express.json());app.use('/api/v1',api);app.use(errorHandler);
},30000);
afterAll(async()=>state.db?.close());
beforeEach(async()=>{
  await state.db!.exec('TRUNCATE users,devices CASCADE');
  for(const [id,role,owner,email] of [[root,'SUPER_ADMIN',null,'root'],[a,'ADMIN',root,'admin-a'],[b,'ADMIN',a,'admin-b'],[client,'CLIENT',b,'client-b'],[other,'ADMIN',root,'other-admin'],[otherClient,'CLIENT',other,'other-client']])await state.db!.query('INSERT INTO users(id,role,owner_id,email,password_hash,name) VALUES($1,$2,$3,$4,$5,$4)',[id,role,owner,`${email}@test.local`,passwordHash]);
  await state.db!.query("INSERT INTO vehicles(id,vehicle_number,owner_id) VALUES($1,'DEEP-01',$2),($3,'SIBLING-02',$4)",[vehicle,client,otherVehicle,otherClient]);
  await state.db!.query("INSERT INTO devices(id,imei,protocol,identity_value,owner_id,sim_number,last_seen_at) VALUES($1,'GPS-12345','GT06','GPS-12345',$2,'9876543210',now()-interval '5 seconds'),($3,'GPS-99999','GT06','GPS-99999',$4,'9998887776',now()-interval '1 hour')",[device,client,otherDevice,otherClient]);
  await state.db!.query("INSERT INTO vehicle_device_assignments(vehicle_id,device_id,assigned_at) VALUES($1,$2,'2026-09-01'),($3,$4,'2026-09-01')",[vehicle,device,otherVehicle,otherDevice]);
  for(const [v,d] of [[vehicle,device],[otherVehicle,otherDevice]])await state.db!.query("INSERT INTO locations(vehicle_id,device_id,tracker_timestamp,server_received_at,speed,ignition,gps_valid,protocol) VALUES($1,$2,'2026-09-17T00:00:00Z','2026-09-17T00:00:00Z',20,true,false,'GT06'),($1,$2,'2026-09-17T00:00:10Z','2026-09-17T00:00:10Z',0,false,false,'GT06')",[v,d]);
});
it('enforces one root, mandatory owners, valid parent roles, and cycle prevention',async()=>{
  await expect(state.db!.query("INSERT INTO users(email,password_hash,role) VALUES('second-root@test.local','x','SUPER_ADMIN')")).rejects.toThrow();
  await expect(state.db!.query("INSERT INTO users(email,password_hash,role) VALUES('orphan@test.local','x','ADMIN')")).rejects.toThrow();
  await expect(state.db!.query('UPDATE users SET owner_id=$1 WHERE id=$2',[b,a])).rejects.toThrow(/cycles/);
  await expect(state.db!.query('UPDATE users SET owner_id=$1 WHERE id=$2',[client,b])).rejects.toThrow(/owner/);
  await request(app).post('/api/v1/admins').set(auth(a,'ADMIN')).send({ownerId:other,username:'outside',password:'test-password',name:'Outside',email:'outside@test.local',coins:0,active:true}).expect(403);
  await request(app).post('/api/v1/clients').set(auth(a,'ADMIN')).send({ownerId:other,username:'outside',password:'test-password',email:'outside@test.local',inactiveTimeoutSeconds:3600}).expect(403);
});
it('lets the super-admin read, edit, and deactivate deeply nested records',async()=>{
  expect((await request(app).get(`/api/v1/admins/${b}`).set(auth()).expect(200)).body.data.id).toBe(b);
  expect((await request(app).get(`/api/v1/clients/${client}`).set(auth()).expect(200)).body.data.id).toBe(client);
  expect((await request(app).get(`/api/v1/fleet-vehicles/${vehicle}`).set(auth()).expect(200)).body.data.id).toBe(vehicle);
  await request(app).patch(`/api/v1/admins/${b}`).set(auth()).send({name:'Updated B'}).expect(200);
  await request(app).patch(`/api/v1/clients/${client}`).set(auth()).send({name:'Updated client'}).expect(200);
  await request(app).put(`/api/v1/fleet-vehicles/${vehicle}`).set(auth()).send(payload()).expect(200);
  await request(app).get(`/api/v1/clients/${client}`).set(auth(other,'ADMIN')).expect(404);
  await request(app).delete(`/api/v1/fleet-vehicles/${vehicle}`).set(auth()).expect(200);
  await request(app).patch(`/api/v1/clients/${client}`).set(auth()).send({active:false}).expect(200);
  await request(app).delete(`/api/v1/admins/${b}`).set(auth()).expect(204);
  expect((await state.db!.query('SELECT active FROM vehicles WHERE id=$1',[vehicle])).rows[0]).toEqual({active:false});
  await request(app).delete(`/api/v1/clients/${client}`).set(auth()).expect(409);
});
it.each(['DEEP-01','GPS-12345','9876543210'])('looks up the entire current device ownership chain by %s',async search=>{
  const response=await request(app).get('/api/v1/web/device-lookup').query({search}).set(auth()).expect(200);
  expect(response.body.data).toEqual([expect.objectContaining({id:device,imei:'GPS-12345',sim_number:'9876543210',vehicle_number:'DEEP-01',client_id:client,admin_id:b})]);
  await request(app).get('/api/v1/web/device-lookup').set(auth(a,'ADMIN')).expect(403);
});
it('honors packet-health grants, revocations, and sibling isolation',async()=>{
  await request(app).get('/api/v1/web/packet-health').set(auth(a,'ADMIN')).expect(403);
  await request(app).patch(`/api/v1/admins/${b}`).set(auth(a,'ADMIN')).send({canViewPacketHealth:true}).expect(403);
  await request(app).patch(`/api/v1/admins/${a}`).set(auth()).send({canViewPacketHealth:true}).expect(200);
  const response=await request(app).get('/api/v1/web/packet-health').set(auth(a,'ADMIN')).expect(200);
  expect(response.body.data).toEqual([expect.objectContaining({id:device,packet_health:'on-time',expected_packet_interval_seconds:10})]);
  expect((await request(app).get('/api/v1/web/packet-health').query({search:'GPS-99999'}).set(auth(a,'ADMIN')).expect(200)).body.data).toEqual([]);
  expect((await request(app).get('/api/v1/web/packet-health').set(auth()).expect(200)).body.data).toContainEqual(expect.objectContaining({id:otherDevice,packet_health:'silent'}));
  await request(app).patch(`/api/v1/admins/${a}`).set(auth()).send({canViewPacketHealth:false}).expect(200);
  await request(app).get('/api/v1/web/packet-health').set(auth(a,'ADMIN')).expect(403);
  await request(app).get('/api/v1/web/packet-health').set(auth(client,'CLIENT')).expect(403);
});
it('aggregates across branches, filters vehicle numbers and IMEI, and paginates packet buckets',async()=>{
  const all=await request(app).get('/api/v1/reports/daily-trip-summary').query(range).set(auth()).expect(200);
  expect(all.body.data.map((row:{id:string})=>row.id).sort()).toEqual([vehicle,otherVehicle].sort());
  for(const search of ['DEEP-01','GPS-12345'])expect((await request(app).get('/api/v1/reports/daily-trip-summary').query({...range,search}).set(auth()).expect(200)).body.data).toEqual([expect.objectContaining({id:vehicle})]);
  const packet=await request(app).get('/api/v1/reports/packet').query({...range,pageSize:1}).set(auth()).expect(200);
  expect(packet.body.data).toHaveLength(1);expect(packet.body.pagination.total).toBe(2);expect(packet.body.data[0]).toMatchObject({vehicleNumber:expect.any(String),packetCount:2});
  for(const [id,role] of [[a,'ADMIN'],[client,'CLIENT']]){
    await request(app).get('/api/v1/reports/daily-trip-summary').query(range).set(auth(id,role)).expect(400);
    await request(app).get('/api/v1/reports/daily-trip-summary').query({...range,vehicleId:otherVehicle}).set(auth(id,role)).expect(404);
  }
});
it('locks accounts immediately, revokes refresh tokens, and permits unlocking',async()=>{
  const tokens=(await request(app).post('/api/v1/auth/login').send({email:'admin-b@test.local',password:'test-password'}).expect(200)).body.data;
  await request(app).patch(`/api/v1/users/${b}/lock`).set(auth(a,'ADMIN')).send({locked:true}).expect(403);
  await request(app).patch(`/api/v1/users/${root}/lock`).set(auth()).send({locked:true}).expect(404);
  await request(app).patch(`/api/v1/users/${b}/lock`).set(auth()).send({locked:true}).expect(200);
  await request(app).get('/api/v1/clients').set({Authorization:`Bearer ${tokens.accessToken}`}).expect(401);
  await request(app).post('/api/v1/auth/login').send({email:'admin-b@test.local',password:'test-password'}).expect(401);
  await request(app).post('/api/v1/auth/refresh').send({refreshToken:tokens.refreshToken}).expect(401);
  await request(app).patch(`/api/v1/users/${b}/lock`).set(auth()).send({locked:false}).expect(200);
  await request(app).post('/api/v1/auth/login').send({email:'admin-b@test.local',password:'test-password'}).expect(200);
});
it('keeps packet cadence boundaries independent from offline state',async()=>{
  const {packetActivity}=await import('../modules/vehicles/activity.js'),now=new Date('2026-09-17T12:00:00Z');
  for(const [seconds,label] of [[0,'on-time'],[20,'on-time'],[21,'delayed'],[1800,'delayed'],[1801,'silent']] as const)expect(packetActivity(new Date(+now-seconds*1000),now).packet_health).toBe(label);
  expect(packetActivity(null,now)).toMatchObject({packet_health:'silent',seconds_since_last_packet:null});
});

it('resets account passwords without exposing stored credentials and revokes old refresh tokens',async()=>{
  for(const [id,email,kind] of [[b,'admin-b@test.local','admin'],[client,'client-b@test.local','client']] as const){
    const tokens=(await request(app).post('/api/v1/auth/login').send({email,password:'test-password'}).expect(200)).body.data;
    const password='replacement-password';
    const response=kind==='admin'?await request(app).patch(`/api/v1/admins/${id}`).set(auth()).send({password}).expect(200):await request(app).post(`/api/v1/clients/${id}/reset-password`).set(auth()).send({password,confirmPassword:password}).expect(200);
    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
    await request(app).post('/api/v1/auth/login').send({email,password:'test-password'}).expect(401);
    await request(app).post('/api/v1/auth/login').send({email,password}).expect(200);
    await request(app).post('/api/v1/auth/refresh').send({refreshToken:tokens.refreshToken}).expect(401);
  }
});
