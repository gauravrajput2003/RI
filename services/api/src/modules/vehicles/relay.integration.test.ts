import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,beforeEach,expect,it,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {PERMISSIONS as P,permissionKeys} from '@fleet/shared-types';
const mock=vi.hoisted(()=>({db:undefined as PGlite|undefined,grants:[] as string[]}));
vi.mock('../../config/env.js',()=>({env:{JWT_SECRET:'relay-test-secret-at-least-32-characters',NODE_ENV:'test',INTERNAL_TRACKER_SECRET:'test-profile-signature-secret-32chars',GT06_RELAY_MODELS:JSON.stringify({PDF:{lock:'DYD#',unlock:'HFYD#',lockSuccess:'DYD=Success!',unlockSuccess:'HFYD=Success!',languageField:false}})}}));
vi.mock('../authorization/permissions.js',()=>({effectivePermissions:async()=>mock.grants}));
vi.mock('../../db/pool.js',()=>{
 const run=async(sql:string,values?:unknown[])=>{const result=await mock.db!.query(sql,values);return {rows:result.rows,rowCount:result.affectedRows||result.rows.length}};
 let queue=Promise.resolve();return {query:run,transaction:<T>(work:(client:{query:typeof run})=>Promise<T>)=>{const task=queue.then(async()=>{await mock.db!.exec('BEGIN');try{const result=await work({query:run});await mock.db!.exec('COMMIT');return result}catch(error){await mock.db!.exec('ROLLBACK');throw error}});queue=task.then(()=>undefined,()=>undefined);return task;}};
});
let owner:string,other:string,admin:string,vehicle:string,foreign:string,device:string;
let app:express.Express;
const auth=(id=owner)=>({Authorization:`Bearer ${jwt.sign({id},'relay-test-secret-at-least-32-characters')}`});
const get=(id=vehicle,user=owner)=>request(app).get(`/api/v1/vehicles/${id}/relay`).set(auth(user));
const post=(action='lock',key=randomUUID(),id=vehicle,user=owner)=>request(app).post(`/api/v1/vehicles/${id}/relay/commands`).set(auth(user)).send({action,idempotencyKey:key,confirmed:true});
beforeAll(async()=>{
 mock.db=new PGlite();await mock.db.exec(`CREATE TABLE users(id uuid PRIMARY KEY,owner_id uuid REFERENCES users,role text,active boolean DEFAULT true);
 CREATE TABLE vehicles(id uuid PRIMARY KEY,owner_id uuid REFERENCES users,vehicle_number text,vehicle_type text,active boolean DEFAULT true,relay_configured boolean DEFAULT false);
 CREATE TABLE devices(id uuid PRIMARY KEY,owner_id uuid REFERENCES users,model text,protocol text,active boolean DEFAULT true,capabilities jsonb DEFAULT '{}',last_seen_at timestamptz);
 CREATE TABLE vehicle_device_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vehicle_id uuid REFERENCES vehicles,device_id uuid REFERENCES devices,unassigned_at timestamptz,assigned_at timestamptz DEFAULT now());
 CREATE TABLE device_status(device_id uuid PRIMARY KEY REFERENCES devices,state text,current_speed double precision,current_ignition boolean,last_heartbeat_at timestamptz);
 CREATE TABLE locations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vehicle_id uuid REFERENCES vehicles,device_id uuid REFERENCES devices,latitude double precision,longitude double precision,speed double precision,gps_valid boolean,tracker_timestamp timestamptz,server_received_at timestamptz);`);
 await mock.db.exec(await readFile(new URL('../../../../../database/migrations/028_vehicle_relay_commands.sql',import.meta.url),'utf8'));
 await mock.db.exec(await readFile(new URL('../../../../../database/migrations/031_gt06_relay_dispatch.sql',import.meta.url),'utf8'));
 for(const name of ['032_relay_wire_evidence.sql','033_relay_probe_heartbeat.sql'])await mock.db.exec(await readFile(new URL('../../../../../database/migrations/'+name,import.meta.url),'utf8'));
 const {authenticate}=await import('../../middleware/auth.js'),{enforceApiPermissions}=await import('../../middleware/permissions.js'),{relayApi}=await import('../../routes/relay.js'),{errorHandler}=await import('../../lib/errors.js');
 app=express();app.use(express.json());app.use('/api/v1',authenticate,enforceApiPermissions,relayApi);app.use(errorHandler);
},120000);
afterAll(async()=>mock.db?.close());
beforeEach(async()=>{
 owner=randomUUID();other=randomUUID();admin=randomUUID();vehicle=randomUUID();foreign=randomUUID();device=randomUUID();mock.grants=[...permissionKeys];
 await mock.db!.exec('TRUNCATE users CASCADE');
 await mock.db!.query("INSERT INTO users(id,role) VALUES($1,'ADMIN'),($2,'CLIENT')",[admin,other]);await mock.db!.query("INSERT INTO users(id,owner_id,role) VALUES($1,$2,'CLIENT')",[owner,admin]);
 await mock.db!.query("INSERT INTO vehicles(id,owner_id,vehicle_number,vehicle_type) VALUES($1,$2,'REAL-SCOPED','Car'),($3,$4,'FOREIGN','Bike')",[vehicle,owner,foreign,other]);
 await mock.db!.query("INSERT INTO devices(id,owner_id,protocol) VALUES($1,$2,'GT06')",[device,owner]);
 await mock.db!.query('INSERT INTO vehicle_device_assignments(vehicle_id,device_id) VALUES($1,$2)',[vehicle,device]);
});
it('loads the real configured flag and never claims a known physical relay state',async()=>{
 const response=await get().expect(200);expect(response.headers['cache-control']).toBe('no-store');
 expect(response.body.data).toMatchObject({vehicleId:vehicle,vehicleNumber:'REAL-SCOPED',vehicleType:'Car',configured:false,state:'unknown',canLock:false,canUnlock:false,code:'RELAY_DISABLED',history:[]});
 await post().expect(409);const row=(await mock.db!.query('SELECT * FROM vehicle_relay_commands')).rows[0];expect(row).toMatchObject({actor_id:owner,vehicle_id:vehicle,device_id:device,action:'lock',status:'rejected',result_code:'RELAY_DISABLED'});
});
it('rejects GT06, W15 and unknown protocols even when the configured capability says supported',async()=>{
 await mock.db!.query('UPDATE vehicles SET relay_configured=true WHERE id=$1',[vehicle]);
 for(const protocol of ['GT06','W15','UNVERIFIED']){
  await mock.db!.query(`UPDATE devices SET protocol=$2,capabilities='{"relay":"SUPPORTED"}' WHERE id=$1`,[device,protocol]);
  for(const action of ['lock','unlock']){const response=await post(action).expect(409);expect(response.body.data).toMatchObject({action,status:'rejected',code:'RELAY_UNSUPPORTED'});}
 }
 expect((await get().expect(200)).body.data.history).toHaveLength(6);
 expect(JSON.stringify((await get()).body)).not.toContain('idempotency_key');
});
it('requires authentication, recursive ownership and explicit admin edit permission',async()=>{
 await request(app).get(`/api/v1/vehicles/${vehicle}/relay`).expect(401);
 await post('lock',randomUUID(),foreign).expect(404);await get(foreign).expect(404);
 mock.grants=[P.vehicleView];await get(vehicle,admin).expect(200);await post('lock',randomUUID(),vehicle,admin).expect(403);
 expect((await mock.db!.query('SELECT * FROM vehicle_relay_commands')).rows).toHaveLength(0);
});
it('rejects missing, conflicting, inactive or foreign-owner device assignments',async()=>{
 await mock.db!.query('UPDATE vehicles SET relay_configured=true WHERE id=$1',[vehicle]);
 await mock.db!.query('UPDATE devices SET owner_id=$2 WHERE id=$1',[device,other]);expect((await post().expect(409)).body.error.code).toBe('RELAY_DEVICE_UNAVAILABLE');
 await mock.db!.query('UPDATE devices SET owner_id=$2,active=false WHERE id=$1',[device,owner]);expect((await post().expect(409)).body.error.code).toBe('RELAY_DEVICE_UNAVAILABLE');
 await mock.db!.query('UPDATE devices SET active=true WHERE id=$1',[device]);await mock.db!.query('INSERT INTO vehicle_device_assignments(vehicle_id,device_id) VALUES($1,$2)',[vehicle,device]);expect((await post().expect(409)).body.error.code).toBe('RELAY_DEVICE_UNAVAILABLE');
 await mock.db!.query('UPDATE vehicle_device_assignments SET unassigned_at=now()');expect((await post().expect(409)).body.error.code).toBe('RELAY_DEVICE_UNAVAILABLE');
 await mock.db!.query('UPDATE vehicles SET active=false WHERE id=$1',[vehicle]);expect((await post().expect(409)).body.error.code).toBe('VEHICLE_INACTIVE');
});
it('deduplicates concurrent retries and rejects reuse for conflicting actions',async()=>{
 const key=randomUUID(),responses=await Promise.all([post('lock',key),post('lock',key)]);
 expect(responses.every(r=>r.status===409)).toBe(true);expect(responses[0].body.data.id).toBe(responses[1].body.data.id);
 expect((await mock.db!.query('SELECT * FROM vehicle_relay_commands')).rows).toHaveLength(1);
 expect((await post('unlock',key).expect(409)).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
});
it('rejects malformed requests and prevents conflicting commands if one is already pending',async()=>{
 await request(app).post(`/api/v1/vehicles/${vehicle}/relay/commands`).set(auth()).send({action:'lock',idempotencyKey:randomUUID()}).expect(400);
 await request(app).post(`/api/v1/vehicles/${vehicle}/relay/commands`).set(auth()).send({action:'lock',idempotencyKey:randomUUID(),confirmed:true,rawCommand:'forbidden'}).expect(400);
 // Isolated DB fixture: an existing request blocks a competing command.
 await mock.db!.query("INSERT INTO vehicle_relay_commands(actor_id,vehicle_id,action,idempotency_key,status,result_code,result_message) VALUES($1,$2,'lock',$3,'pending','TEST','Fixture only')",[owner,vehicle,randomUUID()]);
 expect((await post('unlock').expect(409)).body.error.code).toBe('RELAY_COMMAND_PENDING');
});
async function ready(){
 await mock.db!.query('UPDATE vehicles SET relay_configured=true WHERE id=$1',[vehicle]);
 await mock.db!.query("UPDATE devices SET relay_profile='CONCOX_GT06_DYD',last_seen_at=now() WHERE id=$1",[device]);
 await mock.db!.query('INSERT INTO device_status(device_id,current_speed,current_ignition,last_heartbeat_at) VALUES($1,0,false,now())',[device]);
 await mock.db!.query('INSERT INTO locations(vehicle_id,device_id,latitude,longitude,speed,gps_valid,tracker_timestamp,server_received_at) VALUES($1,$2,28,76,0,true,now(),now())',[vehicle,device]);
 await mock.db!.query("INSERT INTO tracker_connections(device_id,connection_id,instance_id,protocol,expires_at) VALUES($1,$2,$3,'GT06',now()+interval '30 seconds')",[device,randomUUID(),randomUUID()]);
}
it('queues an explicit profile on the current connection, deduplicates retries and reports only confirmed results',async()=>{
 await ready();expect((await get().expect(200)).body.data).toMatchObject({canLock:true,canUnlock:true,state:'unknown'});
 const key=randomUUID(),first=await post('lock',key).expect(202);expect(first.body.data.status).toBe('pending');
 const retry=await post('lock',key).expect(202);expect(retry.body.data.id).toBe(first.body.data.id);
 expect((await get()).body.data).toMatchObject({canLock:false,canUnlock:false,state:'unknown',code:'RELAY_COMMAND_PENDING'});
 await mock.db!.query("UPDATE vehicle_relay_commands SET status='succeeded',result_code='RELAY_CONFIRMED' WHERE id=$1",[first.body.data.id]);
 expect((await get()).body.data).toMatchObject({state:'locked',canLock:false,canUnlock:true});
 await mock.db!.query('UPDATE tracker_connections SET connection_id=$2 WHERE device_id=$1',[device,randomUUID()]);
 expect((await get()).body.data.state).toBe('unknown');
});
it.each(['offline','gps','moving','ignition'])('rejects a configured device with %s safety failure',async reason=>{
 await ready();
 if(reason==='offline')await mock.db!.query('DELETE FROM tracker_connections');
 if(reason==='gps')await mock.db!.query("UPDATE locations SET tracker_timestamp=now()-interval '2 minutes'");
 if(reason==='moving')await mock.db!.query('UPDATE device_status SET current_speed=12');
 if(reason==='ignition')await mock.db!.query('UPDATE device_status SET current_ignition=true');
 const response=await post().expect(409);expect(response.body.data.status).toBe('rejected');
 expect(response.body.data.code).toBe(reason==='offline'?'RELAY_OFFLINE':reason==='gps'?'RELAY_GPS_STALE':'RELAY_NOT_STATIONARY');
});
it('accepts only scoped unlock probe overrides, captures the connection and never changes the device model',async()=>{
 await ready();
 await mock.db!.query("UPDATE devices SET model='UNCHANGED_MODEL' WHERE id=$1",[device]);
 const current=(await request(app).get(`/api/v1/vehicles/${vehicle}/relay/probe`).set(auth()).expect(200)).body.data;
 const path=`/api/v1/vehicles/${vehicle}/relay/commands`;
 const body={action:'unlock',confirmed:true,idempotencyKey:randomUUID(),probeProfile:'PDF',probeConnectionId:current.connectionId};
 await request(app).post(path).set(auth()).send({...body,action:'lock'}).expect(400);
 await request(app).post(path).set(auth()).send({...body,probeProfile:'MISSING'}).expect(400);
 await request(app).post(path).set(auth()).send({...body,probeConnectionId:randomUUID()}).expect(409);
 const accepted=(await request(app).post(path).set(auth()).send(body).expect(202)).body.data;
 expect((await mock.db!.query<{model:string}>('SELECT model FROM devices WHERE id=$1',[device])).rows[0].model).toBe('UNCHANGED_MODEL');
 expect(accepted.probeProfile).toBe('PDF');
 const row=(await mock.db!.query<{probe_profile:string;probe_profile_digest:string}>('SELECT probe_profile,probe_profile_digest FROM vehicle_relay_commands WHERE id=$1',[accepted.id])).rows[0];expect(row.probe_profile_digest).toHaveLength(64);
 await request(app).get(`/api/v1/vehicles/${vehicle}/relay/commands/${accepted.id}`).set(auth(other)).expect(404);
 await request(app).delete(`/api/v1/vehicles/${vehicle}/relay/commands/${accepted.id}`).set(auth()).expect(204);
 const result=(await request(app).get(`/api/v1/vehicles/${vehicle}/relay/commands/${accepted.id}`).set(auth()).expect(200)).body.data;
 expect(result.code).toBe('RELAY_PROBE_ABORTED');
 mock.grants=[P.vehicleView];await request(app).get(`/api/v1/vehicles/${vehicle}/relay/probe`).set(auth(admin)).expect(403);
});
