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
  process.env.ACCOUNT_PASSWORD_ENCRYPTION_KEY='a'.repeat(64);
  process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';process.env.JWT_SECRET=secret;process.env.JWT_REFRESH_SECRET=secret+'-refresh';process.env.INTERNAL_TRACKER_SECRET=secret+'-internal';process.env.EXPECTED_PACKET_INTERVAL_SECONDS='10';process.env.NO_SIGNAL_TIMEOUT_MINUTES='30';
  state.db=new PGlite();
  for(const name of ['001_initial.sql','002_current_device_state.sql','003_web_admin_foundation.sql','004_client_management.sql','005_vehicle_management.sql','009_coin_distribution.sql','012_vehicle_installation_info.sql','013_user_ownership_integrity.sql','014_packet_health_permission.sql','015_account_password_recovery.sql','016_coin_management.sql']){
    let sql=await readFile(new URL(`../../../../database/migrations/${name}`,import.meta.url),'utf8');sql=sql.replace(/CREATE EXTENSION IF NOT EXISTS \w+;/g,'').replace(/geography\(Point, 4326\)/g,'point').replace(/CREATE INDEX locations_position_gist[^;]+;/g,'');await state.db.exec(sql);
  }
  await state.db.exec(`CREATE DOMAIN geometry AS point; CREATE FUNCTION ST_Distance(geometry,geometry) RETURNS double precision LANGUAGE SQL AS 'SELECT 0::double precision';`);
  passwordHash=await bcrypt.hash('test-password',4);
  const {api}=await import('./api.js'),{errorHandler}=await import('../lib/errors.js');app=express();app.use(express.json());app.use('/api/v1',api);app.use(errorHandler);
},30000);
afterAll(async()=>state.db?.close());
beforeEach(async()=>{
  await state.db!.exec('TRUNCATE users,devices CASCADE');
  await state.db!.exec('INSERT INTO issuance_settings DEFAULT VALUES');
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
  const created=await request(app).post('/api/v1/admins').set(auth(a,'ADMIN')).send({ownerId:other,username:'outside',password:'test-password',name:'Outside',email:'outside@test.local',coins:0,active:true}).expect(201);
  expect(created.body.data.owner_id).toBe(a);
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

it('updates vehicle details and transfers the current GPS device with its vehicle to the selected client/admin',async()=>{
 const changed={...payload(),vehicleNumber:'RENAMED-01',vehicleType:'Truck',adminId:other,clientId:otherClient};
 await request(app).put(`/api/v1/fleet-vehicles/${vehicle}`).set(auth(a,'ADMIN')).send(changed).expect(403);
 expect((await state.db!.query('SELECT owner_id FROM devices WHERE id=$1',[device])).rows[0]).toMatchObject({owner_id:client});
 await request(app).put(`/api/v1/fleet-vehicles/${vehicle}`).set(auth()).send({...changed,deviceImei:'GPS-99999',clientId:client,adminId:b}).expect(403);
 await request(app).put(`/api/v1/fleet-vehicles/${vehicle}`).set(auth()).send(changed).expect(200);
 const detail=(await request(app).get(`/api/v1/fleet-vehicles/${vehicle}`).set(auth()).expect(200)).body.data;
 expect(detail).toMatchObject({vehicle_number:'RENAMED-01',vehicle_type:'Truck',owner_id:otherClient,admin_id:other,admin_email:'other-admin@test.local',client_email:'other-client@test.local',device_id:device});
 const list=await request(app).get('/api/v1/fleet-vehicles').query({search:'RENAMED-01'}).set(auth()).expect(200);
 expect(list.body.data).toEqual([expect.objectContaining({admin_id:other,owner_id:otherClient,vehicle_number:'RENAMED-01'})]);
 expect((await state.db!.query('SELECT owner_id FROM devices WHERE id=$1',[device])).rows[0]).toMatchObject({owner_id:otherClient});
 await request(app).get(`/api/v1/vehicles/${vehicle}`).set(auth(client,'CLIENT')).expect(404);
 await request(app).get(`/api/v1/vehicles/${vehicle}`).set(auth(otherClient,'CLIENT')).expect(200);
 expect((await state.db!.query('SELECT device_id FROM vehicle_device_assignments WHERE vehicle_id=$1 AND unassigned_at IS NULL',[vehicle])).rows).toEqual([{device_id:device}]);
 expect((await state.db!.query('SELECT count(*)::int AS count FROM locations WHERE vehicle_id=$1',[vehicle])).rows[0]).toEqual({count:2});
});
it('confirms the super-admin password, encrypts credentials, audits access, and excludes admins',async()=>{
  const response=await request(app).post('/api/v1/admins').set(auth()).send({ownerId:root,username:'recoverable.admin',password:'created-password',name:'Recovery Admin',email:'recovery@test.local',coins:0,active:true}).expect(201);
  const id=response.body.data.id;
  expect(JSON.stringify(response.body)).not.toContain('created-password');
  const stored=(await state.db!.query<{password_recovery_ciphertext:string}>('SELECT password_recovery_ciphertext FROM users WHERE id=$1',[id])).rows[0].password_recovery_ciphertext;
  expect(stored).toBeTruthy();expect(stored).not.toContain('created-password');
  const path=`/api/v1/users/${id}/password-recovery`;
  await request(app).post(path).set(auth(a,'ADMIN')).send({superAdminPassword:'test-password'}).expect(403);
  await request(app).post(path).set(auth()).send({superAdminPassword:'wrong-password'}).expect(403);
  const revealed=await request(app).post(path).set(auth()).send({superAdminPassword:'test-password'}).expect(200);
  expect(revealed.body.data.password).toBe('created-password');expect(revealed.headers['cache-control']).toBe('no-store');
  await request(app).patch(`/api/v1/admins/${id}`).set(auth()).send({name:'Changed name'}).expect(200);
  expect((await request(app).post(path).set(auth()).send({superAdminPassword:'test-password'}).expect(200)).body.data.password).toBe('created-password');
  await request(app).patch(`/api/v1/admins/${id}`).set(auth()).send({password:'replacement-password'}).expect(200);
  expect((await request(app).post(path).set(auth()).send({superAdminPassword:'test-password'}).expect(200)).body.data.password).toBe('replacement-password');
  const legacyPath=`/api/v1/users/${client}/password-recovery`;
  expect((await request(app).post(legacyPath).set(auth()).send({superAdminPassword:'test-password'}).expect(200)).body.data.password).toBeNull();
  const reset=(await request(app).post(legacyPath).set(auth()).send({superAdminPassword:'test-password',action:'RESET'}).expect(200)).body.data.password;
  await request(app).post('/api/v1/auth/login').send({email:'client-b@test.local',password:reset}).expect(200);
  expect((await request(app).post(legacyPath).set(auth()).send({superAdminPassword:'test-password'}).expect(200)).body.data.password).toBe(reset);
  await request(app).post(`/api/v1/users/${root}/password-recovery`).set(auth()).send({superAdminPassword:'test-password'}).expect(404);
  expect((await state.db!.query<{action:string}>('SELECT action FROM password_access_audit WHERE target_id=$1',[client])).rows.map(row=>row.action)).toContain('RESET');
});
it('includes admin-owned vehicles in both inventories and supports editing them without provisioning a GPS',async()=>{
 const legacy=randomUUID();await state.db!.query("INSERT INTO vehicles(id,vehicle_number,owner_id) VALUES($1,'LEGACY-ADMIN',$2)",[legacy,a]);
 const dashboard=await request(app).get('/api/v1/dashboard/vehicles').set(auth()).expect(200);
 const inventory=await request(app).get('/api/v1/fleet-vehicles').set(auth()).expect(200);
 expect(inventory.body.data.map((row:{id:string})=>row.id).sort()).toEqual(dashboard.body.data.map((row:{id:string})=>row.id).sort());
 expect(inventory.body.counts).toEqual(dashboard.body.counts);
 expect(inventory.body.data.find((row:{id:string})=>row.id===legacy)).toMatchObject({admin_id:a,client_name:null});
 await request(app).put(`/api/v1/fleet-vehicles/${legacy}`).set(auth()).send({...payload(),adminId:a,clientId:a,deviceImei:'',deviceProtocol:'',simOperator:'',vehicleNumber:'LEGACY-EDITED',mileage:null,overspeedLimit:null}).expect(200);
 expect((await state.db!.query('SELECT vehicle_number,owner_id FROM vehicles WHERE id=$1',[legacy])).rows[0]).toEqual({vehicle_number:'LEGACY-EDITED',owner_id:a});
 await request(app).get(`/api/v1/fleet-vehicles/${legacy}`).set(auth(other,'ADMIN')).expect(404);
});
it('shows ordinary admins only their direct child admins and keeps super-admin visibility complete',async()=>{
 const visible=await request(app).get('/api/v1/admins').set(auth(a,'ADMIN')).expect(200);
 expect(visible.body.data.map((row:{id:string})=>row.id)).toEqual([b]);
 await request(app).get(`/api/v1/admins/${other}`).set(auth(a,'ADMIN')).expect(404);
 expect((await request(app).get('/api/v1/admins').set(auth()).expect(200)).body.data).toHaveLength(3);
});

const saleBody=(counterpartyId:string,coinsGranted=10)=>({counterpartyId,coinsGranted,amountInr:100,paymentReference:'UPI-TEST',note:'Cash collected externally'});
it('records root sales atomically without a depletable root balance',async()=>{
 for(let i=0;i<3;i++)await request(app).post('/api/v1/coin-sales').set(auth()).send(saleBody(a)).expect(201);
 expect((await state.db!.query<Record<string, unknown>>('SELECT coins FROM users WHERE id=$1',[a])).rows[0].coins).toBe('30.00');
 for(const table of ['coin_sales','coin_transactions','coin_batches'])expect(Number((await state.db!.query<Record<string, unknown>>(`SELECT count(*) count FROM ${table}`)).rows[0].count)).toBe(3);
 expect((await state.db!.query<Record<string, unknown>>('SELECT coins FROM users WHERE id=$1',[root])).rows[0].coins).toBe('0.00');
 const batch=(await state.db!.query<Record<string, unknown>>("SELECT expires_at=granted_at+interval '1 year' valid FROM coin_batches LIMIT 1")).rows[0];expect(batch.valid).toBe(true);
});
it('spends live admin batches FIFO and excludes expired coins',async()=>{
 await state.db!.query<Record<string, unknown>>(`INSERT INTO coin_batches(owner_id,amount,remaining,granted_at,expires_at) VALUES($1,8,8,now()-interval '2 months',now()+interval '10 months'),($1,10,10,now()-interval '1 month',now()+interval '11 months'),($1,100,100,now()-interval '2 years',now()-interval '1 year')`,[b]);
 await request(app).post('/api/v1/coin-sales').set(auth(b,'ADMIN')).send(saleBody(client,12)).expect(201);
 expect((await state.db!.query<Record<string, unknown>>('SELECT remaining FROM coin_batches WHERE owner_id=$1 ORDER BY granted_at',[b])).rows.map(row=>row.remaining)).toEqual(['100.00','0.00','6.00']);
 const rejected=await request(app).post('/api/v1/coin-sales').set(auth(b,'ADMIN')).send(saleBody(client,7)).expect(409);expect(rejected.body.error.code).toBe('INSUFFICIENT_COINS');
 expect(Number((await state.db!.query<Record<string, unknown>>('SELECT count(*) count FROM coin_sales')).rows[0].count)).toBe(1);
 const flow=await request(app).get('/api/v1/coin-flow').set(auth()).query({start:new Date(Date.now()-86400000).toISOString(),end:new Date(Date.now()+86400000).toISOString()}).expect(200);
 expect(flow.body.data.accounts).toContainEqual(expect.objectContaining({id:b,balance:'6.00'}));expect(flow.body.data.accounts).toContainEqual(expect.objectContaining({id:client,balance:'12.00'}));
 expect(flow.body.data.sales[0]).toMatchObject({distributor_id:b,counterparty_id:client});expect(flow.body.data.revenue).toBe('100.00');
});
it('rejects foreign and self counterparties without any ledger writes',async()=>{
 for(const id of [otherClient,b])await request(app).post('/api/v1/coin-sales').set(auth(b,'ADMIN')).send(saleBody(id)).expect(403);
 await request(app).post('/api/v1/coin-sales').set(auth(client,'CLIENT')).send(saleBody(b)).expect(403);
 expect(Number((await state.db!.query<Record<string, unknown>>('SELECT count(*) count FROM coin_transactions')).rows[0].count)).toBe(0);
});
it('enforces the optional monthly cap on grants, sales, and admin initial coins',async()=>{
 await request(app).patch('/api/v1/issuance-settings').set(auth()).send({monthlyTarget:15,enforceHardCap:true}).expect(200);
 await request(app).post('/api/v1/coin-grants').set(auth()).send({counterpartyId:a,amount:10}).expect(201);
 const failed=await request(app).post('/api/v1/coin-sales').set(auth()).send(saleBody(a,6)).expect(409);expect(JSON.stringify(failed.body)).toContain('15.00');
 await request(app).post('/api/v1/admins').set(auth()).send({username:'cap.admin',password:'test-password',name:'Cap Admin',email:'cap@test.local',coins:6,active:true}).expect(409);
 expect((await state.db!.query<Record<string, unknown>>("SELECT id FROM users WHERE username='cap.admin'")).rows).toHaveLength(0);
 await request(app).patch('/api/v1/admins/'+a).set(auth()).send({coins:16}).expect(409);
 await request(app).patch('/api/v1/issuance-settings').set(auth(b,'ADMIN')).send({monthlyTarget:20,enforceHardCap:false}).expect(403);
 await request(app).patch('/api/v1/issuance-settings').set(auth()).send({monthlyTarget:0,enforceHardCap:false}).expect(200);
 await request(app).post('/api/v1/coin-grants').set(auth()).send({counterpartyId:a,amount:100}).expect(201);
});
it('restricts admin sales to their own collections and retains root cross-tree audit visibility',async()=>{
 await request(app).post('/api/v1/coin-grants').set(auth()).send({counterpartyId:b,amount:20}).expect(201);
 await request(app).post('/api/v1/coin-sales').set(auth(b,'ADMIN')).send(saleBody(client,5)).expect(201);
 await request(app).post('/api/v1/coin-sales').set(auth()).send(saleBody(other,5)).expect(201);
 const params={start:new Date(Date.now()-86400000).toISOString(),end:new Date(Date.now()+86400000).toISOString()};
 const own=await request(app).get('/api/v1/coin-flow').set(auth(b,'ADMIN')).query({...params,distributorId:root}).expect(200);expect(own.body.data.sales).toHaveLength(1);expect(own.body.data.sales[0].distributor_id).toBe(b);expect(own.body.data.issuance).toBeNull();
 const all=await request(app).get('/api/v1/reports/coin-distribution').set(auth()).query(params).expect(200);expect(all.body.data).toContainEqual(expect.objectContaining({counterParty:'client-b@test.local',username:'admin-b@test.local',amount:'5.00'}));
});
it('expires client balances and rejects amounts with extra decimal places',async()=>{
 await state.db!.query<Record<string, unknown>>("INSERT INTO coin_batches(owner_id,amount,remaining,granted_at,expires_at) VALUES($1,20,20,now()-interval '2 years',now()-interval '1 year')",[client]);
 const params={start:new Date(Date.now()-86400000).toISOString(),end:new Date(Date.now()+86400000).toISOString()};
 const flow=await request(app).get('/api/v1/coin-flow').set(auth()).query(params).expect(200);expect(flow.body.data.accounts).toContainEqual(expect.objectContaining({id:client,balance:'0'}));
 await request(app).post('/api/v1/coin-sales').set(auth()).send({...saleBody(a),amountInr:1.001}).expect(400);
});
