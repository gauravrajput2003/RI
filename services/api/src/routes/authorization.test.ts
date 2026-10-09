import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import express from 'express';
import request, { type Response as TestResponse } from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as clientIo, type Socket } from 'socket.io-client';
import { configureSockets, publishVehicleLocation } from '../realtime/socket-server.js';
import { createSocketPrincipalReader } from '../realtime/socket-auth.js';

// Execute production SQL in PostgreSQL (WASM), not a mock ownership predicate.
// PostGIS is unavailable here: only spatial types/functions/indexes are adapted.
const state = vi.hoisted(() => ({ db: undefined as PGlite | undefined }));
vi.mock('../db/pool.js', () => {const run=async(sql:string,values?:unknown[])=>{const result=await state.db!.query(sql,values);return{rows:result.rows,rowCount:result.affectedRows||result.rows.length}};return{query:run,transaction:async<T>(work:(client:{query:typeof run})=>Promise<T>)=>{await state.db!.exec('BEGIN');try{const result=await work({query:run});await state.db!.exec('COMMIT');return result}catch(error){await state.db!.exec('ROLLBACK');throw error}}}});
const secret = 'authorization-test-secret-at-least-32-characters';
const a = randomUUID(), b = randomUUID();
const va = randomUUID(), vb = randomUUID(), da = randomUUID(), db = randomUUID();
const ga = randomUUID(), gb = randomUUID(), sa = randomUUID(), sb = randomUUID();
const ea = randomUUID(), eb = randomUUID(), la = randomUUID(), lb = randomUUID();
let app: express.Express;
let authorizer: typeof import('../realtime/vehicle-authorizer.js').vehicleAuthorizer;
let vehicleRepository: typeof import('../modules/vehicles/repository.js');
const password = 'authorization-fixture-password';
let passwordHash: string;
let deviceActivity: typeof import('../modules/vehicles/activity.js').deviceActivity;
const token = (id: string, role = 'USER') => jwt.sign({ id, role }, secret, { expiresIn: '5m' });
const get = (user: string, path: string) => request(app).get('/api/v1' + path).set('Authorization', `Bearer ${token(user)}`);
const historyQuery = '?from=2026-01-01&to=2027-01-01';

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://unused:unused@localhost/unused';
  process.env.JWT_SECRET = secret;
  process.env.JWT_REFRESH_SECRET = secret + '-refresh';
  process.env.INTERNAL_TRACKER_SECRET = secret + '-internal';
  process.env.GEOAPIFY_API_KEY = '';
  process.env.OFFLINE_TIMEOUT_SECONDS = '90';
  process.env.NO_SIGNAL_TIMEOUT_MINUTES = '30';
  state.db = new PGlite();
  passwordHash = await bcrypt.hash(password, 4);
  for (const name of ['001_initial.sql', '002_current_device_state.sql', '003_web_admin_foundation.sql', '004_client_management.sql', '005_vehicle_management.sql', '009_coin_distribution.sql', '012_vehicle_installation_info.sql', '014_packet_health_permission.sql','015_account_password_recovery.sql','016_coin_management.sql','017_device_sim_info.sql','018_admin_permissions.sql']) {
    let sql = await readFile(new URL(`../../../../database/migrations/${name}`, import.meta.url), 'utf8');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS \w+;/g, '')
      .replace(/geography\(Point, 4326\)/g, 'point')
      .replace(/CREATE INDEX locations_position_gist[^;]+;/g, '');
    await state.db.exec(sql);
  }
  await state.db.exec(`CREATE DOMAIN geometry AS point;
    CREATE FUNCTION ST_X(geometry) RETURNS double precision LANGUAGE SQL AS 'SELECT ($1::point)[0]';
    CREATE FUNCTION ST_Y(geometry) RETURNS double precision LANGUAGE SQL AS 'SELECT ($1::point)[1]';
    CREATE FUNCTION ST_Distance(geometry,geometry) RETURNS double precision LANGUAGE SQL AS 'SELECT sqrt((($1::point)[0]-($2::point)[0])^2+(($1::point)[1]-($2::point)[1])^2)';`);
  const { api } = await import('./api.js');
  const { errorHandler } = await import('../lib/errors.js');
  authorizer = (await import('../realtime/vehicle-authorizer.js')).vehicleAuthorizer;
  vehicleRepository = await import('../modules/vehicles/repository.js');
  deviceActivity = (await import('../modules/vehicles/activity.js')).deviceActivity;
  app = express(); app.use(express.json()); app.use('/api/v1', api); app.use(errorHandler);
}, 30000);
afterAll(async () => { await state.db?.close(); });
beforeEach(async () => {
  await state.db!.exec('TRUNCATE users,devices CASCADE');
  await state.db!.exec('INSERT INTO issuance_settings DEFAULT VALUES');
  const q = (sql: string, values?: unknown[]) => state.db!.query(sql, values);
  for (const [user, vehicle, device, group, subscription, event, location, label] of [
    [a, va, da, ga, sa, ea, la, 'A'], [b, vb, db, gb, sb, eb, lb, 'B'],
  ]) {
    await q('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)', [user, label.toLowerCase() + '@test.local', passwordHash]);
    await q('INSERT INTO vehicles(id,vehicle_number,owner_id) VALUES($1,$2,$3)', [vehicle, label, user]);
    await q("INSERT INTO devices(id,imei,protocol,identity_value) VALUES($1,$2,'TEST',$2)", [device, label]);
    await q("INSERT INTO vehicle_device_assignments(vehicle_id,device_id,assigned_at) VALUES($1,$2,'2026-01-01')", [vehicle, device]);
    await q("INSERT INTO device_status(device_id,last_location_at,current_position) VALUES($1,'2026-06-01',point(10,20))", [device]);
    await q('INSERT INTO groups(id,name,owner_id) VALUES($1,$2,$3)', [group, label, user]);
    await q("INSERT INTO subscriptions(id,user_id,plan,status) VALUES($1,$2,'test','active')", [subscription, user]);
    await q("INSERT INTO events(id,device_id,vehicle_id,event_type) VALUES($1,$2,$3,'test')", [event, device, vehicle]);
    await q("INSERT INTO locations(id,device_id,vehicle_id,tracker_timestamp,server_received_at,latitude,longitude,gps_valid,protocol) VALUES($1,$2,$3,'2026-06-01','2026-06-01',20,10,true,'TEST')", [location, device, vehicle]);
  }
});

describe('resource authorization with both customers persisted', () => {
  it('exposes heartbeat ACC on a stationary GPS fix and keeps the dashboard idle',async()=>{
    await state.db!.query("UPDATE users SET role='SUPER_ADMIN' WHERE id=$1",[a]);
    await state.db!.query('UPDATE devices SET last_seen_at=now() WHERE id=$1',[da]);
    await state.db!.query("UPDATE device_status SET state='IDLE',current_ignition=true,current_speed=0,current_gps_valid=true,updated_at=now() WHERE device_id=$1",[da]);
    await state.db!.query('UPDATE locations SET speed=0,ignition=NULL,gps_valid=true WHERE id=$1',[la]);
    expect((await get(a,`/vehicles/${va}/latest-location`).expect(200)).body.data).toMatchObject({state:'IDLE',ignition:true});
    const fleet=await request(app).get('/api/v1/dashboard/vehicles').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(200);
    expect(fleet.body.data.find((row:{id:string})=>row.id===va)).toMatchObject({fleet_status:'IDLE',ignition:true,speed:0});
    // A later OFF heartbeat overrides old high speed for live overspeed/status.
    await state.db!.query('UPDATE vehicles SET overspeed_limit=10 WHERE id=$1',[va]);
    await state.db!.query('UPDATE locations SET speed=24 WHERE id=$1',[la]);
    await state.db!.query("UPDATE device_status SET state='STOPPED',current_ignition=false,current_speed=0 WHERE device_id=$1",[da]);
    const stopped=await request(app).get('/api/v1/dashboard/vehicles').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(200);
    expect(stopped.body.data.find((row:{id:string})=>row.id===va)).toMatchObject({fleet_status:'STOPPED',ignition:false,speed:0});
  });
  it('signs in by username while preserving email login and rejects ambiguous usernames', async () => {
    await state.db!.query("UPDATE users SET username='fleet.operator' WHERE id=$1",[a]);
    const usernameLogin=await request(app).post('/api/v1/auth/login')
      .send({identifier:'FLEET.OPERATOR',password}).expect(200);
    expect(jwt.verify(usernameLogin.body.data.accessToken,secret)).toMatchObject({id:a});
    await request(app).post('/api/v1/auth/login').send({email:'a@test.local',password}).expect(200);
    await state.db!.query("UPDATE users SET owner_id=$1,username='fleet.operator' WHERE id=$2",[a,b]);
    await request(app).post('/api/v1/auth/login')
      .send({identifier:'fleet.operator',password}).expect(401);
  });
  it.each(['MOVING','STOPPED','IDLE','ONLINE'] as const)('preserves recent %s activity using configured timeout', state => {
    const now=new Date('2026-08-01T00:00:00Z');
    expect(deviceActivity(now,state,true,now)).toEqual({state,unreachable:false,status_checked_at:now.toISOString(),offline_at:'2026-08-01T00:01:30.000Z',unreachable_at:'2026-08-01T00:30:00.000Z'});
  });
  it.each([[89999,'MOVING'],[90000,'MOVING'],[90001,'OFFLINE']] as const)('handles configured timeout boundary at %i ms', (age,state) => {
    const now=new Date('2026-08-01T00:00:00Z');
    expect(deviceActivity(new Date(+now-age),'MOVING',true,now).state).toBe(state);
  });
  it('treats missing activity or disabled devices as offline without inventing a timestamp', () => {
    const now=new Date('2026-08-01T00:00:00Z');
    expect(deviceActivity(null,'MOVING',true,now)).toMatchObject({state:'OFFLINE',offline_at:null});
    expect(deviceActivity(now,'MOVING',false,now)).toMatchObject({state:'OFFLINE',offline_at:null});
  });
  it('derives vehicle/device/latest offline responses without rewriting current state or history', async () => {
    vi.useFakeTimers({toFake:['Date']});
    const now=new Date('2026-08-01T00:00:00Z');vi.setSystemTime(now);
    try {
      await state.db!.query('UPDATE devices SET last_seen_at=$1 WHERE id=$2',[now,da]);
      await state.db!.query("UPDATE device_status SET state='MOVING' WHERE device_id=$1",[da]);
      const before=(await state.db!.query('SELECT * FROM locations WHERE device_id=$1',[da])).rows;
      const check=async(expected:string)=>{
        for(const path of ['/vehicles','/devices',`/vehicles/${va}`,`/vehicles/${va}/latest-location`]) {
          const response=await get(a,path).expect(200);
          const data=Array.isArray(response.body.data)?response.body.data[0]:response.body.data;
          expect(data).toMatchObject({state:expected,last_seen_at:now.toISOString(),offline_at:'2026-08-01T00:01:30.000Z'});
        }
      };
      await check('MOVING');vi.setSystemTime(+now+90001);await check('OFFLINE');
      expect((await get(b,'/vehicles')).body.data[0].state).toBe('OFFLINE');
      expect((await state.db!.query('SELECT state FROM device_status WHERE device_id=$1',[da])).rows[0]).toEqual({state:'MOVING'});
      expect((await state.db!.query('SELECT * FROM locations WHERE device_id=$1',[da])).rows).toEqual(before);
      // A fresh heartbeat (last-seen only) restores availability without inserting history.
      await state.db!.query('UPDATE devices SET last_seen_at=$1 WHERE id=$2',[new Date(),da]);
      expect((await get(a,`/vehicles/${va}/latest-location`)).body.data.state).toBe('MOVING');
      expect((await state.db!.query('SELECT * FROM locations WHERE device_id=$1',[da])).rows).toEqual(before);
    } finally { vi.useRealTimers(); }
  });
  it.each([
    ['a',a,va,vb,da,ea,ga,sa], ['b',b,vb,va,db,eb,gb,sb],
  ])('enforces account scope with a real login token for %s', async (label,user,own,foreign,device,event,group,subscription) => {
    const login = await request(app).post('/api/v1/auth/login')
      .send({email:`${label}@test.local`,password}).expect(200);
    const accessToken = login.body.data.accessToken;
    expect(jwt.verify(accessToken,secret)).toMatchObject({id:user,role:'USER'});
    const authenticatedGet = (path:string) => request(app).get(`/api/v1${path}`).set('Authorization',`Bearer ${accessToken}`);
    expect((await authenticatedGet(`/vehicles/${own}`).expect(200)).body.data.id).toBe(own);
    for (const suffix of ['', '/latest-location', `/history${historyQuery}`]) {
      await authenticatedGet(`/vehicles/${foreign}${suffix}`).expect(404);
    }
    for (const [resource,id] of [['vehicles',own],['devices',device],['events',event],['groups',group],['subscriptions',subscription]]) {
      expect((await authenticatedGet(`/${resource}`).expect(200)).body.data.map((row:{id:string})=>row.id)).toEqual([id]);
    }
  });

  it.each([[a,va,vb,da,lb,la], [b,vb,va,db,la,lb]])(
    'does not allow nested ID overrides or foreign history through an owned device for %s',
    async (user,own,foreign,device,foreignLocation,ownLocation) => {
      // A device may have recorded locations for several vehicles over its life.
      await state.db!.query('UPDATE locations SET device_id=$1 WHERE id=$2', [device,foreignLocation]);
      const forged = `vehicleId=${foreign}&vehicle_id=${foreign}&deviceId=${device}&locationId=${foreignLocation}&userId=${user===a?b:a}`;
      const history = await get(user,`/vehicles/${own}/history${historyQuery}&${forged}`).expect(200);
      expect(history.body.data.map((row:{id:string})=>row.id)).toEqual([ownLocation]);
      await get(user,`/vehicles/${own}/latest-location?${forged}`).expect(200);
      await get(user,`/vehicles/${foreign}/latest-location?vehicleId=${own}&deviceId=${device}`).expect(404);
      const denied = await get(user,`/vehicles/${foreign}/history${historyQuery}&vehicleId=${own}`).expect(404);
      const missing = await get(user,`/vehicles/${randomUUID()}/history${historyQuery}`).expect(404);
      expect(denied.body).toEqual(missing.body);
    });

  it.each([[a,va,vb], [b,vb,va]])('enforces nested reads in repository SQL without route checks for %s', async (user,own,foreign) => {
    const from=new Date('2026-01-01'), to=new Date('2027-01-01');
    expect((await vehicleRepository.findVehicle(own,user)).rows).toHaveLength(1);
    expect((await vehicleRepository.findVehicle(foreign,user)).rows).toEqual([]);
    expect((await vehicleRepository.latestLocation(own,user)).rows).toHaveLength(1);
    expect((await vehicleRepository.latestLocation(foreign,user)).rows).toEqual([]);
    expect((await vehicleRepository.history(own,user,from,to,100)).rows).toHaveLength(1);
    expect((await vehicleRepository.history(foreign,user,from,to,100)).rows).toEqual([]);
  });

  it('keeps every cursor page scoped with multiple vehicles in both accounts', async () => {
    const expected = new Map<string,string[]>([[a,[va]], [b,[vb]]]);
    for (const user of [a,b]) for (let i=0;i<3;i++) {
      const id=randomUUID();expected.get(user)!.push(id);
      await state.db!.query('INSERT INTO vehicles(id,vehicle_number,owner_id) VALUES($1,$2,$3)',[id,id,user]);
    }
    for (const user of [a,b]) {
      const seen:string[]=[];let cursor:string|null=null;
      for (let pageNumber=0;pageNumber<10;pageNumber++) {
        const response:TestResponse=await get(user,`/vehicles?limit=1${cursor?`&cursor=${cursor}`:''}`).expect(200);
        const ids=response.body.data.map((row:{id:string})=>row.id);
        expect(ids.every((id:string)=>expected.get(user)!.includes(id))).toBe(true);
        seen.push(...ids);cursor=response.body.nextCursor;
        if(!cursor)break;
      }
      expect(cursor).toBeNull();expect(seen).toEqual(expected.get(user)!.sort());
    }
  });

  it.each([['devices',db],['events',eb],['groups',gb],['subscriptions',sb]])(
    'does not expose unsupported /%s/:id reads or mutations', async (resource,foreign) => {
      for (const method of ['get','patch','delete'] as const) {
        await request(app)[method](`/api/v1/${resource}/${foreign}`).set('Authorization',`Bearer ${token(a)}`).expect(404);
      }
    });

  it.each([[a,va,vb], [b,vb,va]])('allows own vehicle and denies foreign IDs for %s', async (user, own, foreign) => {
    expect((await get(user, `/vehicles/${own}`).expect(200)).body.data.id).toBe(own);
    await get(user, `/vehicles/${foreign}`).expect(404);
    expect((await get(user, `/vehicles/${own}/latest-location`).expect(200)).body.data.latitude).toBe(20);
    await get(user, `/vehicles/${foreign}/latest-location`).expect(404);
    expect((await get(user, `/vehicles/${own}/history${historyQuery}`).expect(200)).body.data).toHaveLength(1);
    await get(user, `/vehicles/${foreign}/history${historyQuery}`).expect(404);
    for (const method of ['patch','delete'] as const) {
      await request(app)[method](`/api/v1/vehicles/${foreign}`).set('Authorization', `Bearer ${token(user)}`).send({alias:'stolen'}).expect(404);
    }
    expect((await state.db!.query('SELECT alias,active FROM vehicles WHERE id=$1', [foreign])).rows[0]).toEqual({alias:null,active:true});
  });
  it.each([
    ['vehicles',va,vb], ['devices',da,db], ['events',ea,eb], ['groups',ga,gb], ['subscriptions',sa,sb],
  ])('scopes /%s before limits and ignores forged owner filters', async (resource, ownA, ownB) => {
    for (const [user, own, other, foreign] of [[a,ownA,b,ownB], [b,ownB,a,ownA]]) {
      for (const suffix of ['', `?limit=1&owner_id=${other}&user_id=${other}&vehicle_id=${foreign}&id=${foreign}`]) {
        const response = await get(user, `/${resource}${suffix}`).expect(200);
        expect(response.body.data.map((row: {id:string}) => row.id)).toEqual([own]);
      }
      const response = await get(user, `/${resource}?cursor=${foreign}`).expect(200);
      expect(response.body.data.every((row:{id:string}) => row.id === own)).toBe(true);
    }
  });
  it('requires authentication on every resource route and method', async () => {
    for (const path of ['/vehicles','/devices','/events','/groups','/subscriptions',`/vehicles/${va}`,`/vehicles/${va}/latest-location`,`/vehicles/${va}/history${historyQuery}`]) {
      await request(app).get('/api/v1'+path).expect(401);
      await request(app).get('/api/v1'+path).set('Authorization','Bearer invalid').expect(401);
    }
    for (const [method,path] of [['post','/vehicles'],['patch',`/vehicles/${va}`],['delete',`/vehicles/${va}`]] as const) {
      await request(app)[method]('/api/v1'+path).send({}).expect(401);
    }
  });
  it.each([[a,va,b], [b,vb,a]])('rejects client vehicle creation while preserving scoped updates/deletion for %s', async (user, own, other) => {
    await request(app).post('/api/v1/vehicles').set('Authorization',`Bearer ${token(user)}`)
      .send({vehicleNumber:'new',owner_id:other,user_id:other}).expect(403);
    expect((await state.db!.query("SELECT id FROM vehicles WHERE vehicle_number='new'")).rows).toHaveLength(0);
    await request(app).patch(`/api/v1/vehicles/${own}`).set('Authorization',`Bearer ${token(user)}`).send({alias:'mine',owner_id:other}).expect(200);
    expect((await get(user, `/vehicles/${own}`).expect(200)).body.data.alias).toBe('mine');
    await get(other, `/vehicles/${own}`).expect(404);
    await request(app).delete(`/api/v1/vehicles/${own}`).set('Authorization',`Bearer ${token(user)}`).expect(204);
    expect((await state.db!.query('SELECT owner_id,active FROM vehicles WHERE id=$1', [own])).rows[0]).toEqual({owner_id:user,active:false});
  });
  it('does not infer sharing from roles or group membership', async () => {
    await state.db!.query('INSERT INTO vehicle_groups(vehicle_id,group_id) VALUES($1,$2)', [vb,ga]);
    for (const role of ['ADMIN','SUPER_ADMIN']) {
      await request(app).get(`/api/v1/vehicles/${vb}`).set('Authorization',`Bearer ${token(a,role)}`).expect(404);
    }
    expect((await get(a,'/vehicles').expect(200)).body.data.map((row:{id:string})=>row.id)).toEqual([va]);
  });
  it('keeps dashboard and playback inside the recursive ownership scope', async () => {
    await state.db!.query("UPDATE users SET role='ADMIN' WHERE id=$1",[a]);
    await state.db!.query('UPDATE users SET owner_id=$1 WHERE id=$2',[a,b]);
    const dashboard=await request(app).get('/api/v1/dashboard/vehicles').set('Authorization',`Bearer ${token(a,'ADMIN')}`).expect(200);
    expect(dashboard.body.data.map((row:{id:string})=>row.id).sort()).toEqual([va,vb].sort());
    expect(dashboard.body.counts.ALL).toBe(2);
    const playback=await request(app).get('/api/v1/playback').query({vehicleId:vb,start:'2026-05-31',end:'2026-06-02'})
      .set('Authorization',`Bearer ${token(a,'ADMIN')}`).expect(200);
    expect(playback.body.data.map((row:{id:string})=>row.id)).toEqual([lb]);
    expect(playback.body.meta).toMatchObject({totalDistanceKm:0,pointCount:1});
    expect(playback.body.meta.startAt).toBe(playback.body.meta.endAt);
    await request(app).get('/api/v1/playback').query({vehicleId:va,start:'2027-01-01',end:'2026-01-01'})
      .set('Authorization',`Bearer ${token(a,'ADMIN')}`).expect(400);
  });
  it('captures the authenticated creator as owner and ignores forged owner IDs', async () => {
    await state.db!.query("UPDATE users SET role='ADMIN' WHERE id=$1",[b]);
    await state.db!.query("UPDATE users SET role='SUPER_ADMIN',name='Root' WHERE id=$1",[a]);
    const payload={username:'ops.admin',password:'strong-password',name:'Operations Admin',email:'ops@test.local',coins:10,active:true};
    const created=await request(app).post('/api/v1/admins').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send(payload).expect(201);
    expect(created.body.data).toMatchObject({owner_id:a,username:'ops.admin',role:'ADMIN',active:true});
    expect((await state.db!.query<{password_hash:string}>('SELECT password_hash FROM users WHERE id=$1',[created.body.data.id])).rows[0].password_hash).not.toBe(payload.password);
    await request(app).post('/api/v1/admins').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,email:'other@test.local'}).expect(409);
    const forged=await request(app).post('/api/v1/admins').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,username:'foreign',email:'foreign@test.local',ownerId:b}).expect(201);
    expect(forged.body.data.owner_id).toBe(a);
    const list=await request(app).get('/api/v1/admins').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(200);
    expect(list.body.data.map((row:{id:string})=>row.id)).toEqual(expect.arrayContaining([created.body.data.id,forged.body.data.id]));
    expect((await request(app).get(`/api/v1/admins/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(200)).body.data.id).toBe(created.body.data.id);
    for(const method of ['get','patch','delete'] as const)await request(app)[method](`/api/v1/admins/${created.body.data.id}`).set('Authorization',`Bearer ${token(b,'ADMIN')}`).send({active:false}).expect(404);
    expect((await request(app).patch(`/api/v1/admins/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({name:'Updated Operations',coins:12}).expect(200)).body.data).toMatchObject({name:'Updated Operations',coins:'12.00'});
    expect((await state.db!.query<{amount:string;transaction_type:string}>('SELECT amount,transaction_type FROM coin_transactions WHERE counterparty_id=$1 ORDER BY created_at,id',[created.body.data.id])).rows).toEqual([{amount:'10.00',transaction_type:'DISTRIBUTED'},{amount:'2.00',transaction_type:'DISTRIBUTED'}]);
    await request(app).delete(`/api/v1/admins/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(204);
    expect((await state.db!.query<{active:boolean}>('SELECT active FROM users WHERE id=$1',[created.body.data.id])).rows[0].active).toBe(false);
  });
  it('updates admin details and password without allowing an ownership cycle', async () => {
    await state.db!.query("UPDATE users SET role='SUPER_ADMIN' WHERE id=$1",[a]);
    const auth=token(a,'SUPER_ADMIN');
    const parent=(await request(app).post('/api/v1/admins').set('Authorization',`Bearer ${auth}`)
      .send({ownerId:a,username:'parent.admin',password:'old-password',name:'Parent',email:'parent@test.local',coins:0,active:true}).expect(201)).body.data;
    const child=(await request(app).post('/api/v1/admins').set('Authorization',`Bearer ${token(parent.id,'ADMIN')}`)
      .send({ownerId:parent.id,username:'child.admin',password:'child-password',name:'Child',email:'child@test.local',coins:0,active:true}).expect(201)).body.data;
    await request(app).patch(`/api/v1/admins/${parent.id}`).set('Authorization',`Bearer ${auth}`)
      .send({ownerId:child.id}).expect(400);
    const updated=await request(app).patch(`/api/v1/admins/${parent.id}`).set('Authorization',`Bearer ${auth}`)
      .send({ownerId:child.id,username:'updated.admin',password:'new-password',name:'Updated Parent',mobile:'9876543210',email:'updated@test.local',company:'Fleet Co',website:'https://fleet.example',address:'Main Road',coins:4,active:true}).expect(200);
    expect(updated.body.data).toMatchObject({owner_id:a,username:'updated.admin',name:'Updated Parent',mobile:'9876543210',email:'updated@test.local',company:'Fleet Co',website:'https://fleet.example',address:'Main Road',coins:'4.00',active:true});
    expect(JSON.stringify(updated.body)).not.toMatch(/password_hash|new-password/);
    await request(app).post('/api/v1/auth/login').send({identifier:'updated.admin',password:'old-password'}).expect(401);
    await request(app).post('/api/v1/auth/login').send({identifier:'updated.admin',password:'new-password'}).expect(200);
    await request(app).patch(`/api/v1/admins/${parent.id}`).set('Authorization',`Bearer ${auth}`)
      .send({email:'child@test.local'}).expect(409);
  });
  it('limits an admin to direct child admins until recursive admin management is defined', async () => {
    await state.db!.query("UPDATE users SET role='SUPER_ADMIN',name='Root' WHERE id=$1",[a]);
    await state.db!.query("UPDATE users SET role='ADMIN',owner_id=$1,name='Parent Admin' WHERE id=$2",[a,b]);
    const childPayload={ownerId:b,username:'direct.child',password:'strong-password',name:'Direct Child',email:'direct@test.local',coins:0,active:true};
    const child=(await request(app).post('/api/v1/admins').set('Authorization',`Bearer ${token(b,'ADMIN')}`).send(childPayload).expect(201)).body.data;
    const grandchildPayload={ownerId:child.id,username:'nested.child',password:'strong-password',name:'Nested Child',email:'nested@test.local',coins:0,active:true};
    const grandchild=(await request(app).post('/api/v1/admins').set('Authorization',`Bearer ${token(child.id,'ADMIN')}`).send(grandchildPayload).expect(201)).body.data;
    const parentList=await request(app).get('/api/v1/admins').set('Authorization',`Bearer ${token(b,'ADMIN')}`).expect(200);
    expect(parentList.body.data.map((row:{id:string})=>row.id)).toEqual([child.id]);
    expect((await request(app).get('/api/v1/admin-owners').set('Authorization',`Bearer ${token(b,'ADMIN')}`).expect(200)).body.data.map((row:{id:string})=>row.id)).toEqual([b]);
    for(const method of ['get','patch','delete'] as const)await request(app)[method](`/api/v1/admins/${grandchild.id}`).set('Authorization',`Bearer ${token(b,'ADMIN')}`).send({active:false}).expect(404);
    const childList=await request(app).get('/api/v1/admins').set('Authorization',`Bearer ${token(child.id,'ADMIN')}`).expect(200);
    expect(childList.body.data.map((row:{id:string})=>row.id)).toEqual([grandchild.id]);
  });
  it('manages clients only beneath authorized admins without exposing credentials', async () => {
    await state.db!.query("UPDATE users SET role='ADMIN' WHERE id=$1",[b]);
    await state.db!.query("UPDATE users SET role='SUPER_ADMIN',name='Root' WHERE id=$1",[a]);
    await state.db!.query("UPDATE users SET role='ADMIN',name='Foreign Admin' WHERE id=$1",[b]);
    const adminPayload={ownerId:a,username:'client.owner',password:'strong-password',name:'Client Owner',email:'owner@test.local',coins:0,active:true};
    const admin=(await request(app).post('/api/v1/admins').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send(adminPayload).expect(201)).body.data;
    const payload={ownerId:admin.id,username:'acme.client',password:'client-password',name:'Acme Client',mobile:'+91 98100 12345',email:'client@test.local',company:'Acme',website:'https://acme.test',address:'Delhi',inactiveTimeoutSeconds:43200,active:true};
    const created=await request(app).post('/api/v1/clients').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send(payload).expect(201);
    expect(created.body.data).toMatchObject({owner_id:admin.id,username:'acme.client',role:'CLIENT',active:true,inactive_timeout_seconds:43200});
    expect(JSON.stringify(created.body)).not.toMatch(/password_hash|client-password/);
    const stored=(await state.db!.query<{password_hash:string;owner_id:string}>('SELECT password_hash,owner_id FROM users WHERE id=$1',[created.body.data.id])).rows[0];
    expect(stored.owner_id).toBe(admin.id);expect(stored.password_hash).not.toBe(payload.password);expect(await bcrypt.compare(payload.password,stored.password_hash)).toBe(true);
    await request(app).post('/api/v1/clients').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,username:'forbidden',email:'forbidden@test.local',ownerId:b}).expect(403);
    await request(app).post('/api/v1/clients').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,email:'duplicate@test.local'}).expect(409);
    const list=await request(app).get('/api/v1/clients').query({search:'Acme',page:1,pageSize:1}).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(200);
    expect(list.body.pagination).toMatchObject({page:1,pageSize:1,total:1});expect(list.body.data[0]).toMatchObject({id:created.body.data.id,vehicle_count:0});expect(JSON.stringify(list.body)).not.toMatch(/password/);
    expect((await request(app).get(`/api/v1/clients/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(200)).body.data.id).toBe(created.body.data.id);
    for(const method of ['get','patch','delete'] as const) await request(app)[method](`/api/v1/clients/${created.body.data.id}`).set('Authorization',`Bearer ${token(b,'ADMIN')}`).send({active:false}).expect(404);
    await request(app).delete(`/api/v1/clients/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(409);
    await request(app).patch(`/api/v1/clients/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({active:false,name:'Updated Client'}).expect(200);
    expect((await request(app).get('/api/v1/clients').query({active:'false'}).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(200)).body.data[0]).toMatchObject({id:created.body.data.id,active:false,name:'Updated Client'});
    await request(app).patch(`/api/v1/clients/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({active:true}).expect(200);
    await request(app).delete(`/api/v1/clients/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(409);
    await request(app).patch(`/api/v1/clients/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({active:false}).expect(200);
    await state.db!.query('UPDATE vehicles SET owner_id=$1 WHERE id=$2',[created.body.data.id,va]);
    await request(app).delete(`/api/v1/clients/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(409);
    await state.db!.query('UPDATE vehicles SET owner_id=$1 WHERE id=$2',[a,va]);
    await request(app).post(`/api/v1/clients/${created.body.data.id}/reset-password`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({password:'new-client-password',confirmPassword:'new-client-password'}).expect(200);
    expect(await bcrypt.compare('new-client-password',(await state.db!.query<{password_hash:string}>('SELECT password_hash FROM users WHERE id=$1',[created.body.data.id])).rows[0].password_hash)).toBe(true);
    await request(app).delete(`/api/v1/clients/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(204);
    await request(app).get(`/api/v1/clients/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(404);
  });
  it('creates and reassigns managed vehicles only through authorized Admin, Client, and Device relationships', async()=>{
    await state.db!.query("UPDATE users SET role='ADMIN' WHERE id=$1",[b]);
    await state.db!.query("UPDATE users SET role='SUPER_ADMIN',name='Root' WHERE id=$1",[a]);
    const adminId=randomUUID(),clientId=randomUUID(),foreignAdmin=randomUUID(),foreignClient=randomUUID(),device1=randomUUID(),device2=randomUUID();
    await state.db!.query("INSERT INTO users(id,email,password_hash,role,owner_id,name) VALUES($1,'manager@test.local',$2,'ADMIN',$3,'Manager'),($4,'foreign-manager@test.local',$2,'ADMIN',$5,'Foreign Manager')",[adminId,passwordHash,a,foreignAdmin,b]);
    await state.db!.query("INSERT INTO users(id,email,password_hash,role,owner_id,name) VALUES($1,'fleet-client@test.local',$2,'CLIENT',$3,'Fleet Client'),($4,'foreign-client@test.local',$2,'CLIENT',$5,'Foreign Client')",[clientId,passwordHash,adminId,foreignClient,foreignAdmin]);
    await state.db!.query("UPDATE users SET username='1234',active=false WHERE id=$1",[clientId]);
    const options=await request(app).get('/api/v1/vehicle-client-options').query({adminId}).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(200);
    expect(options.body.data).toContainEqual(expect.objectContaining({id:clientId,username:'1234',active:false,owner_id:adminId}));
    const capabilities={ignition:'SUPPORTED',door:'SUPPORTED',relay:'UNSUPPORTED',buzzer:'UNKNOWN',airCondition:'SUPPORTED',parkingAlarm:'SUPPORTED'};
    await state.db!.query("INSERT INTO devices(id,imei,protocol,identity_value,owner_id,capabilities) VALUES($1,'MANAGED-1','GT06','MANAGED-1',$3,$4),($2,'MANAGED-2','W15','MANAGED-2',$3,$4)",[device1,device2,clientId,JSON.stringify(capabilities)]);
    const payload={adminId,clientId,deviceImei:'MANAGED-1',deviceProtocol:'GT06',simNumber:'9999999999',simOperator:'Jio',simInfo:'  SIM 8991101200001234567  ',gpsLocation:'  Upper dashboard  ',vehicleNumber:'MANAGED-VEHICLE',vehicleType:'Truck',mileage:100,overspeedLimit:80,coins:12,billingStart:'2026-09-01',billingDue:'2027-09-01',alias:'Managed',remark:'Test',active:true,autoRenewal:true,doorConfigured:true,relayConfigured:false,buzzerConfigured:false,ignitionWiring:'CONNECTED_POWER_PLUS',acPowerPlus:true,parkingAlarmOnIgnition:true};
    const created=await request(app).post('/api/v1/fleet-vehicles').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send(payload).expect(201);
    expect(created.body.data).toMatchObject({owner_id:clientId,vehicle_number:'MANAGED-VEHICLE',sim_info:'SIM 8991101200001234567',gps_location:'Upper dashboard',door_configured:true,ignition_wiring:'CONNECTED_POWER_PLUS'});expect(JSON.stringify(created.body)).not.toMatch(/password|secret/i);
    await request(app).post('/api/v1/fleet-vehicles').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,vehicleNumber:'DUPLICATE-DEVICE'}).expect(409);
    const inlinePayload={...payload,deviceImei:'INLINE-NEW-IMEI',vehicleNumber:'INLINE-VEHICLE',doorConfigured:false,acPowerPlus:false,parkingAlarmOnIgnition:false};
    await request(app).post('/api/v1/fleet-vehicles').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send(inlinePayload).expect(201);
    expect((await state.db!.query('SELECT owner_id,protocol,sim_number,sim_operator FROM devices WHERE imei=$1',[inlinePayload.deviceImei])).rows[0]).toMatchObject({owner_id:clientId,protocol:'GT06',sim_number:'9999999999',sim_operator:'Jio'});
    await request(app).post('/api/v1/fleet-vehicles').set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,vehicleNumber:'BAD-OWNER',adminId:foreignAdmin,clientId:foreignClient}).expect(403);
    await state.db!.query("UPDATE devices SET capabilities='{\"relay\":\"UNSUPPORTED\"}' WHERE id=$1",[device2]);
    await request(app).put(`/api/v1/fleet-vehicles/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,deviceImei:'MANAGED-2',deviceProtocol:'W15',relayConfigured:true}).expect(400);
    await state.db!.query("UPDATE devices SET capabilities='{}' WHERE id=$1",[device2]);
    await request(app).put(`/api/v1/fleet-vehicles/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,deviceImei:'MANAGED-2',deviceProtocol:'W15'}).expect(200);
    const installationUpdate=await request(app).put(`/api/v1/fleet-vehicles/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,deviceImei:'MANAGED-2',deviceProtocol:'W15',simInfo:'SIM replacement',gpsLocation:'Lower panel'}).expect(200);
    expect(installationUpdate.body.data).toMatchObject({sim_info:'SIM replacement',gps_location:'Lower panel'});
    expect((await request(app).get(`/api/v1/fleet-vehicles/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(200)).body.data).toMatchObject({sim_info:'SIM replacement',gps_location:'Lower panel'});
    await request(app).put(`/api/v1/fleet-vehicles/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,simInfo:'x'.repeat(501)}).expect(400);
    const cleared=await request(app).put(`/api/v1/fleet-vehicles/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,deviceImei:'MANAGED-2',deviceProtocol:'W15',simInfo:'',gpsLocation:''}).expect(200);
    expect(cleared.body.data).toMatchObject({sim_info:null,gps_location:null});
    await state.db!.query('UPDATE devices SET capabilities=$2 WHERE id=$1',[device2,JSON.stringify(capabilities)]);
    await state.db!.query("INSERT INTO locations(device_id,vehicle_id,server_received_at,gps_valid,protocol) VALUES($1,$2,'2026-09-10',true,'GT06')",[device1,created.body.data.id]);
    await request(app).put(`/api/v1/fleet-vehicles/${created.body.data.id}`).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).send({...payload,deviceImei:'MANAGED-2',deviceProtocol:'W15',active:false}).expect(200);
    expect((await state.db!.query('SELECT device_id,unassigned_at FROM vehicle_device_assignments WHERE vehicle_id=$1 ORDER BY assigned_at',[created.body.data.id])).rows).toEqual([{device_id:device1,unassigned_at:expect.any(Date)},{device_id:device2,unassigned_at:null}]);
    expect((await state.db!.query<{count:number}>('SELECT count(*)::int AS count FROM locations WHERE vehicle_id=$1 AND device_id=$2',[created.body.data.id,device1])).rows[0].count).toBe(1);
    const list=await request(app).get('/api/v1/fleet-vehicles').query({search:'MANAGED',status:'INACTIVE',page:1,pageSize:1}).set('Authorization',`Bearer ${token(a,'SUPER_ADMIN')}`).expect(200);
    expect(list.body.pagination.total).toBe(1);expect(list.body.counts.ALL).toBeGreaterThanOrEqual(1);expect(list.body.data[0]).toMatchObject({id:created.body.data.id,device_id:device2,fleet_status:'INACTIVE'});
    await state.db!.query('UPDATE users SET active=true WHERE id=$1',[clientId]);
    const clientList=await request(app).get('/api/v1/fleet-vehicles').query({status:'INACTIVE'}).set('Authorization',`Bearer ${token(clientId,'CLIENT')}`).expect(200);
    expect(clientList.body.data[0]).toMatchObject({id:created.body.data.id,vehicle_number:'MANAGED-VEHICLE',fleet_status:'INACTIVE'});
    expect(clientList.body.data[0]).not.toHaveProperty('imei');expect(clientList.body.data[0]).not.toHaveProperty('client_email');expect(clientList.body.data[0]).not.toHaveProperty('coins');
    await request(app).delete(`/api/v1/fleet-vehicles/${created.body.data.id}`).set('Authorization',`Bearer ${token(clientId,'CLIENT')}`).expect(403);
    await request(app).get(`/api/v1/fleet-vehicles/${created.body.data.id}`).set('Authorization',`Bearer ${token(b,'ADMIN')}`).expect(404);
    await request(app).put(`/api/v1/fleet-vehicles/${created.body.data.id}`).set('Authorization',`Bearer ${token(b,'ADMIN')}`).send(payload).expect(403);
  });
  it('hides unassigned devices and events without an attributable vehicle', async () => {
    await state.db!.exec("INSERT INTO devices(imei,protocol,identity_value) VALUES('unassigned','TEST','unassigned')");
    await state.db!.query("INSERT INTO events(device_id,event_type) VALUES($1,'unattributed')", [da]);
    await state.db!.exec("INSERT INTO events(event_type) VALUES('no-resource')");
    expect((await get(a,'/devices')).body.data.map((row:{id:string})=>row.id)).toEqual([da]);
    expect((await get(a,'/events')).body.data.map((row:{id:string})=>row.id)).toEqual([ea]);
  });
  it('does not leak historical device events or stale location after reassignment', async () => {
    await state.db!.query("UPDATE vehicle_device_assignments SET unassigned_at='2026-07-01' WHERE device_id=$1", [db]);
    await state.db!.query("INSERT INTO vehicle_device_assignments(vehicle_id,device_id,assigned_at) VALUES($1,$2,'2026-07-02')", [va,db]);
    await state.db!.query('DELETE FROM locations WHERE device_id=$1',[da]);
    await state.db!.query('DELETE FROM device_status WHERE device_id=$1',[da]);
    await get(a,`/vehicles/${va}/latest-location`).expect(404);
    expect((await get(a,'/events')).body.data.map((row:{id:string})=>row.id)).toEqual([ea]);
    expect((await get(b,'/devices')).body.data).toEqual([]);
    expect((await get(b,'/events')).body.data.map((row:{id:string})=>row.id)).toEqual([eb]);
    // A later partial tracker update advances cache time while retaining B's
    // coordinates. The API must use A's recorded row, whose position is null.
    await state.db!.query("UPDATE device_status SET last_location_at='2026-08-01' WHERE device_id=$1",[db]);
    await state.db!.query("INSERT INTO locations(device_id,vehicle_id,tracker_timestamp,server_received_at,gps_valid,protocol) VALUES($1,$2,'2026-08-01','2026-08-01',false,'TEST')",[db,va]);
    expect((await get(a,`/vehicles/${va}/latest-location`).expect(200)).body.data.latitude).toBeNull();
  });
  it('uses the production SQL authorizer for socket isolation and ownership revocation', async () => {
    expect(await authorizer.authorizedVehicleIds(a)).toEqual([va]);
    expect(await authorizer.authorizedVehicleIds(b)).toEqual([vb]);
    const http = createServer(); const server = new Server(http); const clients: Socket[] = [];
    configureSockets(server,authorizer,createSocketPrincipalReader(secret));
    await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve));
    try {
      const connect = async (user:string) => {
        const client = clientIo(`http://127.0.0.1:${(http.address() as import('node:net').AddressInfo).port}`,{auth:{token:token(user),userId:user===a?b:a},transports:['websocket'],reconnection:false});
        clients.push(client);
        await new Promise<void>((resolve,reject)=>{client.once('connect',resolve);client.once('connect_error',reject)});
        return client;
      };
      const ca=await connect(a), cb=await connect(b);
      const subscribe=(client:Socket,id:string)=>new Promise(resolve=>client.emit('vehicle:subscribe',id,resolve));
      expect(await subscribe(ca,va)).toEqual({ok:true}); expect(await subscribe(ca,vb)).toEqual({ok:false});
      expect(await subscribe(cb,vb)).toEqual({ok:true}); expect(await subscribe(cb,va)).toEqual({ok:false});
      const seenA:string[]=[],seenB:string[]=[];
      ca.on('vehicle:location',p=>seenA.push(p.vehicleId));cb.on('vehicle:location',p=>seenB.push(p.vehicleId));
      await publishVehicleLocation(server,va,{vehicleId:va}); await publishVehicleLocation(server,vb,{vehicleId:vb});
      // Ordered acknowledgments ensure all preceding packets have been consumed.
      await subscribe(ca,va);await subscribe(cb,vb);
      expect(seenA).toEqual([va]);expect(seenB).toEqual([vb]);
      await state.db!.query('UPDATE vehicles SET owner_id=$1 WHERE id=$2',[b,va]);
      expect(await subscribe(cb,va)).toEqual({ok:true});
      await publishVehicleLocation(server,va,{vehicleId:va});
      await subscribe(ca,vb);await subscribe(cb,va);
      expect(seenA).toEqual([va]);expect(seenB).toEqual([vb,va]);
      expect(await subscribe(ca,'invalid-uuid')).toEqual({ok:false});
    } finally {
      clients.forEach(client=>client.close());
      await new Promise<void>(resolve=>server.close(()=>resolve()));
    }
  });
});
