import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,beforeEach,it,expect,vi} from 'vitest';
import express from 'express';import request from 'supertest';import jwt from 'jsonwebtoken';
import {permissionKeys,PERMISSIONS as P} from '@fleet/shared-types';
const state=vi.hoisted(()=>({db:undefined as PGlite|undefined,grants:[] as string[]}));
vi.mock('../../config/env.js',()=>({env:{JWT_SECRET:'parking-test-secret-at-least-32-characters',NO_SIGNAL_TIMEOUT_MINUTES:30}}));
vi.mock('../authorization/permissions.js',()=>({hasPermissionForUser:async()=>true,effectivePermissions:async()=>state.grants}));
vi.mock('../../db/pool.js',()=>{const query=async(sql:string,values?:unknown[])=>{const r=await state.db!.query(sql,values);return{rows:r.rows,rowCount:r.affectedRows??r.rows.length};};let queue=Promise.resolve();return{query,transaction:<T>(fn:(c:{query:typeof query})=>Promise<T>)=>{const result=queue.then(async()=>{await state.db!.exec('BEGIN');try{const out=await fn({query});await state.db!.exec('COMMIT');return out;}catch(error){await state.db!.exec('ROLLBACK');throw error;}});queue=result.then(()=>undefined,()=>undefined);return result;}};});
import {parkingStatus,saveParking,processParkingVehicle} from './service.js';
import {withParkingDelivery} from './delivery.js';
import {flushPushOutbox} from '../mobile-push/service.js';
let owner:string,other:string,admin:string,vehicle:string,foreign:string,device:string,phone:string,app:express.Express;
let at:Date;
const auth=(id=owner)=>({Authorization:`Bearer ${jwt.sign({id},'parking-test-secret-at-least-32-characters')}`});
const input=(enabled=true,radius=20,version:number|null=null)=>({enabled,radius,repeatMinutes:1,expectedVersion:version});
async function point(meters:number,time:Date,changes:Record<string,unknown>={}){
 const row={id:randomUUID(),latitude:28+meters/111195,longitude:76,tracker_timestamp:time,server_received_at:time,gps_valid:true,speed:0,metadata:{},...changes};
 await state.db!.query('INSERT INTO locations(id,vehicle_id,device_id,latitude,longitude,gps_valid,tracker_timestamp,server_received_at,speed,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[row.id,vehicle,device,row.latitude,row.longitude,row.gps_valid,row.tracker_timestamp,row.server_received_at,row.speed,JSON.stringify(row.metadata)]);
 await state.db!.query('UPDATE devices SET last_seen_at=$2 WHERE id=$1',[device,time]);return row;
}
async function readings(meters:number,start=1,count=3){for(let i=0;i<count;i++)await point(meters,new Date(+at+(start+i)*1000));return processParkingVehicle(vehicle,new Date(+at+(start+count)*1000));}
beforeAll(async()=>{
 state.db=new PGlite();await state.db.exec(`CREATE TABLE users(id uuid PRIMARY KEY,owner_id uuid,active boolean DEFAULT true,role text);
 CREATE TABLE vehicles(id uuid PRIMARY KEY,owner_id uuid,vehicle_number text,active boolean DEFAULT true);
 CREATE TABLE devices(id uuid PRIMARY KEY,owner_id uuid,last_seen_at timestamptz,active boolean DEFAULT true);
 CREATE TABLE vehicle_device_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vehicle_id uuid,device_id uuid,assigned_at timestamptz,unassigned_at timestamptz);
 CREATE TABLE locations(id uuid PRIMARY KEY,vehicle_id uuid,device_id uuid,latitude double precision,longitude double precision,gps_valid boolean,tracker_timestamp timestamptz,server_received_at timestamptz,speed real,metadata jsonb);
 CREATE TABLE events(id uuid DEFAULT gen_random_uuid(),vehicle_id uuid,device_id uuid,event_type text,occurred_at timestamptz,payload jsonb);
 CREATE TABLE notification_history(id uuid PRIMARY KEY,vehicle_id uuid,event_type text,message text,latitude double precision,longitude double precision,occurred_at timestamptz,metadata jsonb,dedup_key text UNIQUE);
 CREATE TABLE refresh_tokens(user_id uuid,token_hash text,revoked_at timestamptz,expires_at timestamptz);
 CREATE TABLE mobile_vehicle_notification_preferences(user_id uuid,vehicle_id uuid,muted boolean,updated_at timestamptz DEFAULT now());`);
 for(const name of ['025_mobile_voice_push.sql','026_mobile_cached_voice.sql','029_parking_mode.sql','030_parking_reference_accuracy.sql'])await state.db.exec(await readFile(new URL(`../../../../../database/migrations/${name}`,import.meta.url),'utf8'));
 const {authenticate}=await import('../../middleware/auth.js'),{enforceApiPermissions}=await import('../../middleware/permissions.js'),{parkingApi}=await import('../../routes/parking.js'),{errorHandler}=await import('../../lib/errors.js');app=express();app.use(express.json());app.use('/api/v1',authenticate,enforceApiPermissions,parkingApi);app.use(errorHandler);
},120000);
afterAll(async()=>state.db?.close());
beforeEach(async()=>{
 await state.db!.exec('TRUNCATE users,vehicles,devices,vehicle_device_assignments,locations,events,notification_history,refresh_tokens,mobile_vehicle_notification_preferences CASCADE');
 owner=randomUUID();other=randomUUID();admin=randomUUID();vehicle=randomUUID();foreign=randomUUID();device=randomUUID();phone=randomUUID();at=new Date();state.grants=[...permissionKeys];
 await state.db!.query("INSERT INTO users(id,role) VALUES($1,'CLIENT'),($2,'CLIENT'),($3,'ADMIN')",[owner,other,admin]);await state.db!.query('UPDATE users SET owner_id=$2 WHERE id=$1',[owner,admin]);
 await state.db!.query("INSERT INTO vehicles(id,owner_id,vehicle_number) VALUES($1,$2,'PARK-REAL'),($3,$4,'FOREIGN')",[vehicle,owner,foreign,other]);
 await state.db!.query('INSERT INTO devices(id,owner_id,last_seen_at) VALUES($1,$2,$3)',[device,owner,at]);
 await state.db!.query("INSERT INTO vehicle_device_assignments(vehicle_id,device_id,assigned_at) VALUES($1,$2,$3::timestamptz-interval '1 day')",[vehicle,device,at]);
 await state.db!.query("INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,'session',now()+interval '1 day')",[owner]);
 await state.db!.query("INSERT INTO mobile_push_devices(id,user_id,expo_token,platform,refresh_token_hash) VALUES($1,$2,'ExpoPushToken[isolated]','android','session')",[phone,owner]);
 await point(0,at);
});
it('captures real assigned GPS, preserves the reference on duplicate enable and all four radius updates',async()=>{
 const saved=await saveParking(owner,vehicle,input(),at);expect(saved).toMatchObject({enabled:true,radius:20,reference:{latitude:28,longitude:76}});
 await point(5,new Date(+at+1000));const retry=await saveParking(owner,vehicle,input(),new Date(+at+2000));expect(retry.reference).toEqual(saved.reference);expect(retry.version).toBe(saved.version);
 let current=retry;for(const radius of [30,40,50,20]){current=await saveParking(owner,vehicle,input(true,radius,current.version),new Date(+at+3000));expect(current.radius).toBe(radius);expect(current.reference).toEqual(saved.reference);}
});
it('detects outside only after consecutive readings for every supported radius',async()=>{
 for(const radius of [20,30,40,50]){
  const previous=await parkingStatus(owner,vehicle,at);if(previous.enabled)await saveParking(owner,vehicle,input(false,radius,previous.version),at);
  await point(0,new Date(+at+100));const before=await parkingStatus(owner,vehicle,at);await saveParking(owner,vehicle,input(true,radius,before.version),new Date(+at+200));
  expect(await readings(radius-8,1)).toHaveLength(0);
  expect(await readings(radius+10,5,2)).toHaveLength(0);
  const events=await readings(radius+10,8,1);expect(events).toHaveLength(1);expect(events[0]).toMatchObject({eventType:'PARKING_MOVEMENT',radius,vehicleNumber:'PARK-REAL'});
  at=new Date(+at+20000);
 }
});
it('rejects jitter, invalid, stale, inaccurate and duplicate-timestamp fixes without fabricating movement',async()=>{
 await saveParking(owner,vehicle,input(),at);
 for(const [i,m] of [26,19,27,20,24,18].entries())await point(m,new Date(+at+(i+1)*1000));expect(await processParkingVehicle(vehicle,new Date(+at+7000))).toHaveLength(0);
 await point(80,new Date(+at+8000),{gps_valid:false});await point(80,new Date(+at+9000),{metadata:{accuracyMeters:100}});await point(80,new Date(+at+10000),{tracker_timestamp:new Date(+at-300000)});
 expect(await processParkingVehicle(vehicle,new Date(+at+11000))).toHaveLength(0);
 for(let i=0;i<3;i++)await point(60,new Date(+at+(12+i)*1000),{tracker_timestamp:new Date(+at+12000)});
 expect(await processParkingVehicle(vehicle,new Date(+at+16000))).toHaveLength(0);
});
it('repeats at the configured interval, pauses stale GPS, and creates a new movement after re-entry',async()=>{
 await saveParking(owner,vehicle,input(),at);const first=await readings(50);expect(first).toHaveLength(1);
 expect(await processParkingVehicle(vehicle,new Date(+at+59000))).toHaveLength(0);
 await point(50,new Date(+at+64000));const repeat=await processParkingVehicle(vehicle,new Date(+at+65000));expect(repeat.map(n=>n.eventType)).toEqual(['PARKING_REMINDER']);expect(repeat[0].movementId).toBe(first[0].movementId);
 expect(await processParkingVehicle(vehicle,new Date(+at+300000))).toHaveLength(0);
 expect((await parkingStatus(owner,vehicle,new Date(+at+300000))).monitoring).toBe(false);
 const returned=await readings(0,66);expect(returned.map(n=>n.eventType)).toEqual(['PARKING_RETURNED']);
 const next=await readings(50,70);expect(next[0].movementId).not.toBe(first[0].movementId);
});
it('disables atomically, cancels queued pushes, and rechecks disabled state at dispatch',async()=>{
 await saveParking(owner,vehicle,input(),at);const events=await readings(50);const mode=await parkingStatus(owner,vehicle,new Date(+at+5000));
 await saveParking(owner,vehicle,input(false,20,mode.version),new Date(+at+6000));
 expect(await processParkingVehicle(vehicle,new Date(+at+70000))).toHaveLength(0);
 const rows=(await state.db!.query<{cancelled_at:unknown}>('SELECT cancelled_at FROM mobile_push_outbox')).rows;expect(rows).toHaveLength(1);expect(rows[0].cancelled_at).not.toBeNull();
 const send=vi.fn();expect(await withParkingDelivery(events[0] as unknown as Record<string,unknown>,send)).toBe(false);expect(send).not.toHaveBeenCalled();
});
it('recovers persisted state, deduplicates concurrent workers and rejects stale configuration writes',async()=>{
 const enabled=await saveParking(owner,vehicle,input(),at);for(let i=1;i<=3;i++)await point(50,new Date(+at+i*1000));
 const results=await Promise.all([processParkingVehicle(vehicle,new Date(+at+4000)),processParkingVehicle(vehicle,new Date(+at+4000))]);expect(results.flat()).toHaveLength(1);
 const read=await parkingStatus(owner,vehicle,new Date(+at+5000));expect(read.reference).toEqual(enabled.reference);expect(read.boundaryState).toBe('outside');
 await expect(saveParking(owner,vehicle,input(true,30,999),at)).rejects.toMatchObject({code:'PARKING_CHANGED'});
 expect((await state.db!.query('SELECT * FROM notification_history')).rows).toHaveLength(1);
});
it('requires fresh valid GPS and rejects reassigned or foreign-owner trackers',async()=>{
 await state.db!.query("UPDATE locations SET tracker_timestamp=now()-interval '1 day'");await expect(saveParking(owner,vehicle,input(),at)).rejects.toMatchObject({code:'PARKING_GPS_UNAVAILABLE'});
 await point(0,new Date(+at+1000),{gps_valid:false});await expect(saveParking(owner,vehicle,input(),new Date(+at+2000))).rejects.toMatchObject({code:'PARKING_GPS_UNAVAILABLE'});
 await state.db!.query('UPDATE devices SET owner_id=$2 WHERE id=$1',[device,other]);await expect(saveParking(owner,vehicle,input(),at)).rejects.toMatchObject({code:'PARKING_DEVICE_UNAVAILABLE'});
});
it('records notification failure and retries through the existing outbox without claiming delivery',async()=>{
 await saveParking(owner,vehicle,input(),at);await readings(50);
 const fetcher=vi.fn().mockRejectedValue(new Error('simulated provider failure'));await flushPushOutbox(fetcher);
 const row=(await state.db!.query<{attempts:number;last_error:string;sent_at:unknown}>('SELECT attempts,last_error,sent_at FROM mobile_push_outbox')).rows[0];
 expect(row.attempts).toBe(1);expect(row.sent_at).toBeNull();expect(row.last_error).toContain('failed');
});
it('authenticates and scopes all HTTP operations and validates settings/confirmation',async()=>{
 await request(app).get(`/api/v1/vehicles/${vehicle}/parking`).expect(401);
 await request(app).get(`/api/v1/vehicles/${foreign}/parking`).set(auth()).expect(404);
 const put=(body:object,id=vehicle,user=owner)=>request(app).put(`/api/v1/vehicles/${id}/parking`).set(auth(user)).send(body);
 await put({...input(),confirmed:true},foreign).expect(404);await put({...input(),radius:100,confirmed:true}).expect(400);await put(input()).expect(400);await put({...input(),confirmed:true,latitude:28}).expect(400);
 state.grants=[P.vehicleView];await put({...input(),confirmed:true},vehicle,admin).expect(403);
 const response=await put({...input(),confirmed:true}).expect(200);expect(response.body.data.enabled).toBe(true);
});

it('preserves valid zero coordinates, zero speed and zero reported accuracy at activation',async()=>{
 await point(0,new Date(+at+1000),{latitude:0,longitude:76,speed:0,metadata:{accuracyMeters:0}});
 const result=await saveParking(owner,vehicle,input(),new Date(+at+2000));expect(result.reference).toEqual({latitude:0,longitude:76});
});

it.each([1,2,5,10])('honors a %i minute repeat interval and emits at most one reminder per due sweep',async minutes=>{
 await saveParking(owner,vehicle,{...input(),repeatMinutes:minutes},at);await readings(50);
 const due=new Date(+at+4000+minutes*60000);
 for(let i=0;i<3;i++)await point(50,new Date(+due-3000+i*1000));
 expect(await processParkingVehicle(vehicle,new Date(+due-1000))).toHaveLength(0);
 expect((await processParkingVehicle(vehicle,due)).map(n=>n.eventType)).toEqual(['PARKING_REMINDER']);
 expect(await processParkingVehicle(vehicle,due)).toHaveLength(0);
});
it('does not resume reminders from one fresh point after an extended telemetry gap',async()=>{
 await saveParking(owner,vehicle,input(),at);await readings(50);
 await point(50,new Date(+at+300000));expect(await processParkingVehicle(vehicle,new Date(+at+301000))).toHaveLength(0);
 const resumed=await readings(50,302,2);expect(resumed.map(n=>n.eventType)).toEqual(['PARKING_REMINDER']);
});

it('includes saved reference accuracy in the confidence margin and keeps it fixed',async()=>{
 await point(0,new Date(+at+1000),{metadata:{accuracyMeters:10}});await saveParking(owner,vehicle,input(),new Date(+at+1000));
 expect(await readings(30,2)).toHaveLength(0);expect((await readings(40,6)).map(n=>n.eventType)).toEqual(['PARKING_MOVEMENT']);
});
it('rejects a radius smaller than the saved reference accuracy',async()=>{
 await point(0,new Date(+at+1000),{metadata:{accuracyMeters:30}});const mode=await saveParking(owner,vehicle,input(true,50),new Date(+at+1000));
 await expect(saveParking(owner,vehicle,input(true,20,mode.version),new Date(+at+2000))).rejects.toMatchObject({code:'PARKING_ACCURACY'});
});
