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
vi.mock('../db/pool.js', () => ({ query: async (sql: string, values?: unknown[]) => {
  const result = await state.db!.query(sql, values);
  return { rows: result.rows, rowCount: result.affectedRows || result.rows.length };
} }));
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
  process.env.OFFLINE_TIMEOUT_SECONDS = '90';
  state.db = new PGlite();
  passwordHash = await bcrypt.hash(password, 4);
  for (const name of ['001_initial.sql', '002_current_device_state.sql']) {
    let sql = await readFile(new URL(`../../../../database/migrations/${name}`, import.meta.url), 'utf8');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS \w+;/g, '')
      .replace(/geography\(Point, 4326\)/g, 'point')
      .replace(/CREATE INDEX locations_position_gist[^;]+;/g, '');
    await state.db.exec(sql);
  }
  await state.db.exec(`CREATE DOMAIN geometry AS point;
    CREATE FUNCTION ST_X(geometry) RETURNS double precision LANGUAGE SQL AS 'SELECT ($1::point)[0]';
    CREATE FUNCTION ST_Y(geometry) RETURNS double precision LANGUAGE SQL AS 'SELECT ($1::point)[1]';`);
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
  it.each(['MOVING','STOPPED','IDLE','ONLINE'] as const)('preserves recent %s activity using configured timeout', state => {
    const now=new Date('2026-08-01T00:00:00Z');
    expect(deviceActivity(now,state,true,now)).toEqual({state,status_checked_at:now.toISOString(),offline_at:'2026-08-01T00:01:30.000Z'});
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
  it.each([[a,va,b], [b,vb,a]])('sets creation ownership and permits own updates/deletion for %s', async (user, own, other) => {
    const response = await request(app).post('/api/v1/vehicles').set('Authorization',`Bearer ${token(user)}`)
      .send({vehicleNumber:'new',owner_id:other,user_id:other}).expect(201);
    expect(response.body.data.owner_id).toBe(user);
    await get(other, `/vehicles/${response.body.data.id}`).expect(404);
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
