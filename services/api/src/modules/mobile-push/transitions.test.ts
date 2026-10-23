import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,beforeEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({db:undefined as PGlite|undefined,allow:true}));
vi.mock('../../db/pool.js',()=>{const query=async(sql:string,values?:unknown[])=>{const r=await state.db!.query(sql,values);return{rows:r.rows,rowCount:r.affectedRows};};return{query,transaction:async<T>(fn:(client:{query:typeof query})=>Promise<T>)=>{await state.db!.exec('BEGIN');try{const result=await fn({query});await state.db!.exec('COMMIT');return result;}catch(error){await state.db!.exec('ROLLBACK');throw error;}}};});
vi.mock('../authorization/permissions.js',()=>({hasPermissionForUser:async()=>state.allow}));
vi.mock('../../config/env.js',()=>({env:{NO_SIGNAL_TIMEOUT_MINUTES:30}}));
vi.mock('../../lib/logger.js',()=>({logger:{warn:vi.fn()}}));
import {collectTransitions,flushPushOutbox} from './service.js';
const user=randomUUID(),vehicle=randomUUID(),device=randomUUID(),phone=randomUUID();
beforeAll(async()=>{
 state.db=new PGlite();
 await state.db.exec(`CREATE TABLE users(id uuid PRIMARY KEY,owner_id uuid,active boolean DEFAULT true);
 CREATE TABLE vehicles(id uuid PRIMARY KEY,owner_id uuid,vehicle_number text,active boolean DEFAULT true);
 CREATE TABLE devices(id uuid PRIMARY KEY,last_seen_at timestamptz DEFAULT now(),active boolean DEFAULT true);
 CREATE TABLE device_status(device_id uuid,state text,updated_at timestamptz DEFAULT now(),state_since_at timestamptz);
 CREATE TABLE vehicle_device_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vehicle_id uuid,device_id uuid,assigned_at timestamptz,unassigned_at timestamptz);
 CREATE TABLE locations(id uuid PRIMARY KEY,vehicle_id uuid,device_id uuid,server_received_at timestamptz);
 CREATE TABLE refresh_tokens(user_id uuid,token_hash text,revoked_at timestamptz,expires_at timestamptz);
 CREATE TABLE mobile_vehicle_notification_preferences(user_id uuid,vehicle_id uuid,muted boolean,updated_at timestamptz DEFAULT now());
 CREATE TABLE notification_history(id uuid,vehicle_id uuid,event_type text,message text,occurred_at timestamptz,dedup_key text,metadata jsonb);`);
 for(const name of ['025_mobile_voice_push.sql','026_mobile_cached_voice.sql','029_parking_mode.sql','030_parking_reference_accuracy.sql'])await state.db.exec(await readFile(new URL(`../../../../../database/migrations/${name}`,import.meta.url),'utf8'));
},30000);
afterAll(async()=>state.db?.close());
beforeEach(async()=>{
 state.allow=true;await state.db!.exec('TRUNCATE users,vehicles,devices,device_status,vehicle_device_assignments,refresh_tokens,mobile_vehicle_notification_preferences,notification_history CASCADE');
 await state.db!.query('INSERT INTO users(id) VALUES($1)',[user]);
 await state.db!.query("INSERT INTO vehicles(id,owner_id,vehicle_number) VALUES($1,$2,'TEST-42')",[vehicle,user]);
 await state.db!.query('INSERT INTO devices(id) VALUES($1)',[device]);
 await state.db!.query("INSERT INTO device_status(device_id,state,state_since_at) VALUES($1,'STOPPED',now()-interval '1 minute')",[device]);
 await state.db!.query("INSERT INTO vehicle_device_assignments(vehicle_id,device_id,assigned_at) VALUES($1,$2,now()-interval '1 day')",[vehicle,device]);
 await state.db!.query("INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,'session',now()+interval '1 day')",[user]);
 await state.db!.query("INSERT INTO mobile_push_devices(id,user_id,expo_token,platform,refresh_token_hash,voice,updated_at) VALUES($1,$2,'ExpoPushToken[test]','android','session',true,now()-interval '1 hour')",[phone,user]);
});
it('baselines quietly, persists each actual transition once and deduplicates repeated packets',async()=>{
 const emit=vi.fn();await collectTransitions(emit);expect(emit).not.toHaveBeenCalled();
 for(const status of ['MOVING','IDLE','STOPPED']){
  await state.db!.query('UPDATE device_status SET state=$1,state_since_at=clock_timestamp()', [status]);
  await collectTransitions(emit);await collectTransitions(emit);
 }
 expect(emit).toHaveBeenCalledTimes(3);
 expect(emit.mock.calls.map(call=>call[1].eventType)).toEqual(['VEHICLE_RUNNING','VEHICLE_IDLE','VEHICLE_STOPPED']);
 expect((await state.db!.query('SELECT * FROM mobile_push_outbox')).rows).toHaveLength(3);
 expect((await state.db!.query('SELECT * FROM notification_history')).rows).toHaveLength(3);
});
it('rechecks logout before sending queued pushes',async()=>{
 await collectTransitions(()=>{});
 await state.db!.query("UPDATE device_status SET state='MOVING',state_since_at=clock_timestamp()");await collectTransitions(()=>{});
 const fetcher=vi.fn();
 await state.db!.query('UPDATE refresh_tokens SET revoked_at=now()');
 await flushPushOutbox(fetcher);expect(fetcher).not.toHaveBeenCalled();
 expect((await state.db!.query('SELECT sent_at FROM mobile_push_outbox')).rows[0]).toMatchObject({sent_at:expect.any(Date)});
});
it('honors notification permission and per-vehicle mute',async()=>{
 const emit=vi.fn();state.allow=false;await collectTransitions(emit);
 state.allow=true;await state.db!.query('INSERT INTO mobile_vehicle_notification_preferences(user_id,vehicle_id,muted) VALUES($1,$2,true)',[user,vehicle]);
 await collectTransitions(emit);expect(emit).not.toHaveBeenCalled();
 expect((await state.db!.query('SELECT * FROM mobile_push_outbox')).rows).toHaveLength(0);
});
it('records successful transport once and never resends already accepted tickets',async()=>{
 await collectTransitions(()=>{});await state.db!.query("UPDATE device_status SET state='MOVING',state_since_at=clock_timestamp()");await collectTransitions(()=>{});
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[{status:'ok',id:'ticket'},{status:'ok',id:'voice-ticket'}]}),{status:200}));
 await flushPushOutbox(fetcher);await flushPushOutbox(fetcher);expect(fetcher).toHaveBeenCalledOnce();
 const request=JSON.parse(fetcher.mock.calls[0][1].body);expect(request).toHaveLength(2);expect(request[0].body).toBe('Vehicle TEST-42 has started.');
});
it('does not replay a transition that happened before alerts were enabled',async()=>{
 await collectTransitions(()=>{});
 await state.db!.query("UPDATE device_status SET state='MOVING',state_since_at=now()-interval '10 minutes'");
 await state.db!.query('UPDATE mobile_push_devices SET updated_at=clock_timestamp()');
 const emit=vi.fn();await collectTransitions(emit);expect(emit).not.toHaveBeenCalled();
});
