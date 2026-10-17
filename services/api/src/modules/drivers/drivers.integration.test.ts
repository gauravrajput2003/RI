import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,beforeEach,expect,it,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {PERMISSIONS as P,permissionKeys} from '@fleet/shared-types';
const mock=vi.hoisted(()=>({db:undefined as PGlite|undefined,grants:[] as string[]}));
vi.mock('../../config/env.js',()=>({env:{JWT_SECRET:'driver-test-secret-at-least-32-characters',NODE_ENV:'test'}}));
vi.mock('../authorization/permissions.js',()=>({effectivePermissions:async()=>mock.grants}));
vi.mock('../../db/pool.js',()=>{
 const run=async(sql:string,values?:unknown[])=>{const result=await mock.db!.query(sql,values);return {rows:result.rows,rowCount:result.affectedRows||result.rows.length}};
 // PGlite is one connection. Serialize transactions to emulate the vehicle-row
 // lock; production uses separate PG clients and row locks plus unique indexes.
 let queue=Promise.resolve();return {query:run,transaction:<T>(work:(client:{query:typeof run})=>Promise<T>)=>{const task=queue.then(async()=>{await mock.db!.exec('BEGIN');try{const result=await work({query:run});await mock.db!.exec('COMMIT');return result}catch(error){await mock.db!.exec('ROLLBACK');throw error}});queue=task.then(()=>undefined,()=>undefined);return task;}};
});
let owner=randomUUID(),other=randomUUID(),admin=randomUUID(),vehicle=randomUUID(),second=randomUUID(),foreign=randomUUID();
let app:express.Express,migration:string;
const base=`CREATE TABLE users(id uuid PRIMARY KEY,owner_id uuid REFERENCES users,role text,active boolean DEFAULT true);
 CREATE TABLE vehicles(id uuid PRIMARY KEY,owner_id uuid REFERENCES users,vehicle_number text);`;
const auth=(id=owner)=>({Authorization:`Bearer ${jwt.sign({id,role:'SUPER_ADMIN'},'driver-test-secret-at-least-32-characters')}`});
const post=(body:object,user=owner)=>request(app).post('/api/v1/drivers').set(auth(user)).send(body);
const input={name:'  Driver Name  ',mobile:'+91 98765 43210',licenceNumber:' dl-14202600001 '};
const make=async(suffix='1',user=owner,context?:string)=>(await post({...input,licenceNumber:`DL1420260000${suffix}`,...(context?{vehicleId:context}:{})},user).expect(201)).body.data;
beforeAll(async()=>{
 mock.db=new PGlite();await mock.db.exec(base);migration=await readFile(new URL('../../../../../database/migrations/027_driver_management.sql',import.meta.url),'utf8');await mock.db.exec(migration);
 const {authenticate}=await import('../../middleware/auth.js'),{enforceApiPermissions}=await import('../../middleware/permissions.js'),{driversApi}=await import('../../routes/drivers.js'),{errorHandler}=await import('../../lib/errors.js');
 app=express();app.use(express.json());app.use('/api/v1',authenticate,enforceApiPermissions,driversApi);app.use(errorHandler);
},120000);
afterAll(async()=>mock.db?.close());
beforeEach(async()=>{
 owner=randomUUID();other=randomUUID();admin=randomUUID();vehicle=randomUUID();second=randomUUID();foreign=randomUUID();
 mock.grants=[...permissionKeys];await mock.db!.exec('TRUNCATE users CASCADE');
 await mock.db!.query("INSERT INTO users(id,role) VALUES($1,'ADMIN'),($2,'CLIENT')",[admin,other]);await mock.db!.query("INSERT INTO users(id,owner_id,role) VALUES($1,$2,'CLIENT')",[owner,admin]);
 await mock.db!.query("INSERT INTO vehicles(id,owner_id,vehicle_number) VALUES($1,$2,'OWN'),($3,$2,'SECOND'),($4,$5,'FOREIGN')",[vehicle,owner,second,foreign,other]);
});
it('normalizes valid fields, persists creation across requests and deduplicates identical retries',async()=>{
 const first=await post(input).expect(201);expect(first.body.data).toMatchObject({name:'Driver Name',mobile:'+919876543210',licence_number:'DL-14202600001'});
 const retry=await post({...input,licenceNumber:'DL14202600001'}).expect(200);expect(retry.body.data.id).toBe(first.body.data.id);
 expect((await request(app).get('/api/v1/drivers').set(auth()).expect(200)).body.data).toHaveLength(1);
 await post({...input,name:'Different driver'}).expect(409);
 expect((await mock.db!.query('SELECT * FROM drivers')).rows).toHaveLength(1);
});
it('validates all fields, rejects forged owners and requires real authentication',async()=>{
 for(const fields of [{name:' '},{mobile:'--------'},{mobile:'123'},{licenceNumber:'a'},{licenceNumber:'DL<script>'}])await post({...input,...fields}).expect(400);
 await post({...input,ownerId:other}).expect(400);await request(app).post('/api/v1/drivers').send(input).expect(401);
 await request(app).get('/api/v1/drivers').set('Authorization','Bearer invalid').expect(401);
 expect((await mock.db!.query('SELECT * FROM drivers')).rows).toHaveLength(0);
});
it('scopes lists, paginates without foreign entries and creates vehicle-context drivers under the server-derived owner',async()=>{
 const a=await make('1'),b=await make('2');await make('3',other);
 const first=(await request(app).get('/api/v1/drivers?limit=1').set(auth()).expect(200)).body;
 const next=(await request(app).get(`/api/v1/drivers?limit=1&cursor=${first.nextCursor}`).set(auth()).expect(200)).body;
 expect([first.data[0].id,next.data[0].id].sort()).toEqual([a.id,b.id].sort());
 const child=await make('4',admin,vehicle);expect((await mock.db!.query<{owner_id:string}>('SELECT owner_id FROM drivers WHERE id=$1',[child.id])).rows[0].owner_id).toBe(owner);
 expect((await request(app).get(`/api/v1/drivers?vehicleId=${vehicle}`).set(auth(admin)).expect(200)).body.data).toHaveLength(3);
 await post({...input,vehicleId:foreign},admin).expect(404);await request(app).get(`/api/v1/drivers?vehicleId=${foreign}`).set(auth()).expect(404);
});
it('assigns, reloads, safely reassigns and preserves history without duplicate assignments',async()=>{
 const a=await make('1'),b=await make('2');
 const put=(driverId:string,expectedAssignmentId:string|null)=>request(app).put(`/api/v1/vehicles/${vehicle}/driver`).set(auth()).send({driverId,expectedAssignmentId});
 const first=(await put(a.id,null).expect(200)).body.data;expect(first.driver.id).toBe(a.id);
 const read=(await request(app).get(`/api/v1/vehicles/${vehicle}/driver`).set(auth()).expect(200)).body.data;expect(read.assignmentId).toBe(first.assignmentId);expect(read.driver.id).toBe(a.id);
 expect((await put(a.id,null).expect(200)).body.data.assignmentId).toBe(first.assignmentId);
 const changed=(await put(b.id,first.assignmentId).expect(200)).body.data;await put(a.id,first.assignmentId).expect(409);
 const rows=(await mock.db!.query<{driver_id:string;unassigned_at:string|null}>('SELECT driver_id,unassigned_at FROM vehicle_driver_assignments ORDER BY assigned_at')).rows;
 expect(rows).toHaveLength(2);expect(rows.find(row=>row.driver_id===a.id)?.unassigned_at).not.toBeNull();expect(changed.driver.id).toBe(b.id);
});
it('does not move a busy driver or allow unauthorized cross-owner assignments',async()=>{
 const own=await make(),foreignDriver=await make('9',other),adminDriver=await make('8',admin);
 const assign=(v:string,d:string,user=owner)=>request(app).put(`/api/v1/vehicles/${v}/driver`).set(auth(user)).send({driverId:d,expectedAssignmentId:null});
 await assign(vehicle,own.id).expect(200);await assign(second,own.id).expect(409);await assign(foreign,own.id).expect(404);await assign(second,foreignDriver.id).expect(404);await assign(second,adminDriver.id,admin).expect(409);
 await request(app).get(`/api/v1/vehicles/${vehicle}/driver`).set(auth(other)).expect(404);
 expect((await mock.db!.query('SELECT * FROM vehicle_driver_assignments WHERE unassigned_at IS NULL')).rows).toHaveLength(1);
});
it('enforces grants and prevents concurrent assignments from silently overwriting each other',async()=>{
 const a=await make('1'),b=await make('2');mock.grants=[P.vehicleView];
 await post({...input,licenceNumber:'ADMIN123'},admin).expect(403);await request(app).get('/api/v1/drivers').set(auth(admin)).expect(200);
 await request(app).put(`/api/v1/vehicles/${vehicle}/driver`).set(auth(admin)).send({driverId:a.id,expectedAssignmentId:null}).expect(403);
 const responses=await Promise.all([a,b].map(driver=>request(app).put(`/api/v1/vehicles/${vehicle}/driver`).set(auth()).send({driverId:driver.id,expectedAssignmentId:null})));
 expect(responses.map(r=>r.status).sort()).toEqual([200,409]);expect((await mock.db!.query('SELECT * FROM vehicle_driver_assignments WHERE unassigned_at IS NULL')).rows).toHaveLength(1);
});
it('hides prior-owner details after a vehicle transfer while allowing a deliberate new-owner assignment',async()=>{
 const old=await make();await request(app).put(`/api/v1/vehicles/${vehicle}/driver`).set(auth()).send({driverId:old.id,expectedAssignmentId:null}).expect(200);
 await mock.db!.query('UPDATE vehicles SET owner_id=$2 WHERE id=$1',[vehicle,other]);
 const current=(await request(app).get(`/api/v1/vehicles/${vehicle}/driver`).set(auth(other)).expect(200)).body.data;expect(current.driver).toBeNull();expect(current.assignmentId).toBeTruthy();
 const retry=(await post(input).expect(200)).body.data;expect(retry.vehicle_id).toBeNull();expect(retry.vehicle_number).toBeNull();
 const next=await make('2',other);await request(app).put(`/api/v1/vehicles/${vehicle}/driver`).set(auth(other)).send({driverId:next.id,expectedAssignmentId:current.assignmentId}).expect(200);
});
it('migration DDL rolls back cleanly and database constraints protect assignment integrity',async()=>{
 const db=new PGlite();try{await db.exec(base);await db.exec('BEGIN');await db.exec(migration);await db.exec('ROLLBACK');expect((await db.query<{table_name:string|null}>("SELECT to_regclass('drivers')::text AS table_name")).rows[0].table_name).toBeNull();}finally{await db.close();}
 const driver=await make();await request(app).put(`/api/v1/vehicles/${vehicle}/driver`).set(auth()).send({driverId:driver.id,expectedAssignmentId:null}).expect(200);
 await expect(mock.db!.query('INSERT INTO vehicle_driver_assignments(vehicle_id,driver_id,assigned_by) VALUES($1,$2,$3)',[second,driver.id,owner])).rejects.toMatchObject({code:'23505'});
 await expect(mock.db!.query('INSERT INTO vehicle_driver_assignments(vehicle_id,driver_id,assigned_by) VALUES($1,$2,$3)',[foreign,randomUUID(),owner])).rejects.toMatchObject({code:'23503'});
});
