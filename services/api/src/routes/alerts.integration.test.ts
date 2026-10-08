import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {PGlite} from '@electric-sql/pglite';import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';import express from 'express';import request from 'supertest';import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
const state=vi.hoisted(()=>({db:undefined as PGlite|undefined}));
vi.mock('../db/pool.js',()=>({query:async(sql:string,values?:unknown[])=>{const result=await state.db!.query(sql,values);return{rows:result.rows,rowCount:result.affectedRows||result.rows.length}},transaction:async(work:(client:{query:(sql:string,values?:unknown[])=>Promise<unknown>})=>Promise<unknown>)=>work({query:async(sql:string,values?:unknown[])=>{const result=await state.db!.query(sql,values);return{rows:result.rows,rowCount:result.affectedRows||result.rows.length}}})}));
const secret='alerts-integration-secret-at-least-32-characters',admin=randomUUID(),other=randomUUID(),client=randomUUID(),vehicle=randomUUID(),otherVehicle=randomUUID();let app:express.Express;
beforeAll(async()=>{process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';process.env.JWT_SECRET=secret;process.env.JWT_REFRESH_SECRET=secret+'-refresh';process.env.INTERNAL_TRACKER_SECRET=secret+'-internal';process.env.CLOUDINARY_CLOUD_NAME='test';state.db=new PGlite();for(const name of ['001_initial.sql','002_current_device_state.sql','003_web_admin_foundation.sql','004_client_management.sql','005_vehicle_management.sql','014_packet_health_permission.sql','018_admin_permissions.sql']){let sql=await readFile(new URL(`../../../../database/migrations/${name}`,import.meta.url),'utf8');sql=sql.replace(/CREATE EXTENSION IF NOT EXISTS \w+;/g,'').replace(/geography\(Point, 4326\)/g,'point').replace(/CREATE INDEX locations_position_gist[^;]+;/g,'');await state.db.exec(sql)}await state.db.exec('CREATE TABLE geofences(id uuid PRIMARY KEY);');await state.db.exec(await readFile(new URL('../../../../database/migrations/007_alerts_and_announcements.sql',import.meta.url),'utf8'));await state.db.exec(await readFile(new URL('../../../../database/migrations/008_subscription_alerts.sql',import.meta.url),'utf8'));await state.db.exec(await readFile(new URL('../../../../database/migrations/010_announcement_recipients.sql',import.meta.url),'utf8'));await state.db.exec(await readFile(new URL('../../../../database/migrations/011_announcement_images.sql',import.meta.url),'utf8'));await state.db.query("INSERT INTO users(id,email,password_hash,role,name) VALUES($1,'admin@test.local','x','ADMIN','Admin'),($2,'other@test.local','x','ADMIN','Other'),($3,'client@test.local','x','CLIENT','Client')",[admin,other,client]);await state.db.query('UPDATE users SET owner_id=$1 WHERE id=$2',[admin,client]);await state.db.query("UPDATE users SET username=CASE WHEN id=$1 THEN 'admin.login' ELSE 'client.login' END WHERE id IN ($1,$2)",[admin,client]);await state.db.query("INSERT INTO vehicles(id,vehicle_number,owner_id) VALUES($1,'OWN-1',$2),($3,'OTHER-1',$4)",[vehicle,client,otherVehicle,other]);const {api}=await import('./api.js'),{errorHandler}=await import('../lib/errors.js');app=express();app.use(express.json());app.use('/api/v1',api);app.use(errorHandler)},30000);
afterAll(async()=>state.db?.close());const token=(id:string,role='ADMIN')=>jwt.sign({id,role},secret);const auth=(method:'get'|'post'|'patch'|'delete',path:string,id=admin)=>request(app)[method]('/api/v1'+path).set('Authorization',`Bearer ${token(id)}`);
describe('alert configuration API',()=>{let alertId:string;it('creates a scoped alert with multiple registry events',async()=>{const response=await auth('post','/alerts').send({name:'Operations',mappingType:'VEHICLE',mappingValue:vehicle,events:['VEHICLE_STOPPED','VEHICLE_OVERSPEED'],active:true}).expect(201);alertId=response.body.data.id;expect(response.body.data.events).toEqual(['VEHICLE_OVERSPEED','VEHICLE_STOPPED'])});it('rejects invalid events and out-of-scope mappings',async()=>{await auth('post','/alerts').send({name:'Bad',mappingType:'VEHICLE',mappingValue:vehicle,events:['FAKE'],active:true}).expect(400);await auth('post','/alerts',other).send({name:'IDOR',mappingType:'VEHICLE',mappingValue:vehicle,events:['VEHICLE_STOPPED'],active:true}).expect(403)});it('edits and deactivates without deleting history',async()=>{await auth('patch',`/alerts/${alertId}`).send({name:'Operations updated',mappingType:'ALL_VEHICLES',mappingValue:null,events:['VEHICLE_RUNNING'],active:true}).expect(200);const status=await auth('patch',`/alerts/${alertId}/status`).send({active:false}).expect(200);expect(status.body.data.active).toBe(false);await auth('get',`/alerts/${alertId}`,other).expect(404)})});
describe('notification authorization and filters',()=>{it('paginates and prevents cross-scope reads',async()=>{const alert=(await state.db!.query<{id:string}>('SELECT id FROM alert_configurations LIMIT 1')).rows[0].id;const notification=randomUUID(),foreignNotification=randomUUID();await state.db!.query("INSERT INTO notification_history(id,alert_id,vehicle_id,event_type,message,occurred_at,dedup_key) VALUES($1,$2,$3,'VEHICLE_RUNNING','Own running',now(),'own'),($4,NULL,$5,'VEHICLE_STOPPED','Foreign stopped',now(),'foreign')",[notification,alert,vehicle,foreignNotification,otherVehicle]);const list=await auth('get','/notifications?page=1&pageSize=1&eventType=VEHICLE_RUNNING').expect(200);expect(list.body.data).toHaveLength(1);expect(list.body.pagination.total).toBe(1);await auth('get',`/notifications/${foreignNotification}`).expect(404)})});
describe('announcements',()=>{it('targets the selected clients and admins, sanitizes HTML, and persists dismissal',async()=>{const start=new Date(Date.now()-60000).toISOString(),end=new Date(Date.now()+60000).toISOString();await auth('post','/announcements').send({targetType:'CLIENT',adminIds:[admin],clientIds:[client],messageType:'TEXT',title:'Invalid',bodyHtml:'x',startsAt:end,endsAt:start,active:true,dontShowAgain:true}).expect(400);const adminOptions=await auth('get','/announcements/target-options?type=ADMIN').expect(200);expect(adminOptions.body.data).toEqual([expect.objectContaining({id:admin,label:'Admin'})]);const options=await auth('get',`/announcements/target-options?type=CLIENT&adminId=${admin}`).expect(200);expect(options.body.data).toEqual([expect.objectContaining({id:client,label:'Client'})]);const created=await auth('post','/announcements').send({targetType:'CLIENT',adminIds:[admin],clientIds:[client],messageType:'TEXT',title:'Notice',bodyHtml:'<p>Hello<script>alert(1)</script></p>',startsAt:start,endsAt:end,active:true,dontShowAgain:true}).expect(201);expect(created.body.data).toMatchObject({targetType:'CLIENT',clients:['Client'],admins:['Admin']});expect(created.body.data.bodyHtml).not.toContain('<script>');const current=(id:string,role:string)=>request(app).get('/api/v1/announcements/current').set('Authorization',`Bearer ${jwt.sign({id,role},secret)}`);expect((await current(client,'CLIENT').expect(200)).body.data).toHaveLength(1);expect((await current(admin,'ADMIN').expect(200)).body.data).toHaveLength(0);const adminAnnouncement=await auth('post','/announcements').send({targetType:'ADMIN',adminIds:[admin],clientIds:[],messageType:'TEXT',title:'Admin Notice',bodyHtml:'<p>Admin only</p>',startsAt:start,endsAt:end,active:true,dontShowAgain:false}).expect(201);expect((await current(admin,'ADMIN').expect(200)).body.data.map((row:{id:string})=>row.id)).toEqual([adminAnnouncement.body.data.id]);expect((await current(client,'CLIENT').expect(200)).body.data.map((row:{id:string})=>row.id)).toEqual([created.body.data.id]);await request(app).post(`/api/v1/announcements/${created.body.data.id}/dismiss`).set('Authorization',`Bearer ${jwt.sign({id:client,role:'CLIENT'},secret)}`).expect(204);expect((await current(client,'CLIENT').expect(200)).body.data).toHaveLength(0);await auth('get',`/announcements/${created.body.data.id}`,other).expect(404)})});

describe('image announcements',()=>{
 it('validates content, persists images, and allows replacement and text conversion',async()=>{
  const startsAt=new Date(Date.now()-60000).toISOString(),endsAt=new Date(Date.now()+60000).toISOString();
  const base={targetType:'ADMIN',adminIds:[admin],clientIds:[],title:'Image notice',startsAt,endsAt,active:true,dontShowAgain:false};
  await auth('post','/announcements').send({...base,messageType:'IMAGE',bodyHtml:''}).expect(400);
  await auth('post','/announcements').send({...base,messageType:'VIDEO',bodyHtml:'x'}).expect(400);
  const imageUrl='https://res.cloudinary.com/test/image/upload/v1/example.png',imagePublicId=`fleet/announcements/${admin}/first`;
  const created=await auth('post','/announcements').send({...base,messageType:'IMAGE',bodyHtml:'',imageUrl,imagePublicId}).expect(201);
  expect(created.body.data).toMatchObject({messageType:'IMAGE',bodyHtml:null,imageUrl,imagePublicId});
  const nextId=`fleet/announcements/${admin}/second`;
  const replaced=await auth('patch',`/announcements/${created.body.data.id}`).send({...base,messageType:'IMAGE',bodyHtml:'',imageUrl,imagePublicId:nextId}).expect(200);
  expect(replaced.body.data.imagePublicId).toBe(nextId);
  const text=await auth('patch',`/announcements/${created.body.data.id}`).send({...base,messageType:'TEXT',bodyHtml:'<p>Back to text</p>',imageUrl:null,imagePublicId:null}).expect(200);
  expect(text.body.data).toMatchObject({messageType:'TEXT',imageUrl:null,imagePublicId:null});
 });
});

describe('web records delivered to the authenticated mobile recipient',()=>{
 const root=randomUUID(),child=randomUUID(),childC=randomUUID(),childD=randomUUID(),siblingClient=randomUUID(),foreignClient=randomUUID();
 const tokens=new Map<string,string>();
 const recipient=(id:string)=>request(app).get('/api/v1/announcements/my').set('Authorization',`Bearer ${tokens.get(id)}`);
 const window={startsAt:new Date(Date.now()-60_000).toISOString(),endsAt:new Date(Date.now()+3_600_000).toISOString()};
 const payload=(targetType:string,adminIds:string[],clientIds:string[]=[])=>({targetType,adminIds,clientIds,messageType:'TEXT',title:'Web to mobile',bodyHtml:'<p>One authoritative record</p>',...window,active:true,dontShowAgain:true});
 beforeAll(async()=>{
  await state.db!.exec(await readFile(new URL('../../../../database/migrations/015_account_password_recovery.sql',import.meta.url),'utf8'));
  await state.db!.exec(await readFile(new URL('../../../../database/migrations/020_announcement_reads.sql',import.meta.url),'utf8'));
  const hash=await bcrypt.hash('announcement-test-password',4);
  await state.db!.query("INSERT INTO users(id,email,username,password_hash,role,name) VALUES($1,'root@notices.test','notice.root',$2,'SUPER_ADMIN','Root')",[root,hash]);
  await state.db!.query('UPDATE users SET owner_id=$1,password_hash=$2 WHERE id IN ($3,$4)',[root,hash,admin,other]);
  await state.db!.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,client]);
  for(const [id,parent,role] of [[child,admin,'ADMIN'],[childC,admin,'ADMIN'],[childD,admin,'ADMIN'],[siblingClient,admin,'CLIENT'],[foreignClient,other,'CLIENT']]){
   await state.db!.query('INSERT INTO users(id,email,username,password_hash,role,owner_id) VALUES($1,$2,$3,$4,$5,$6)',[id,`${id}@notices.test`,id,hash,role,parent]);
  }
  for(const id of [root,admin,other,client,child,childC,childD,siblingClient,foreignClient]){
   const email=(await state.db!.query<{email:string}>('SELECT email FROM users WHERE id=$1',[id])).rows[0].email;
   const login=await request(app).post('/api/v1/auth/login').send({identifier:email,password:'announcement-test-password'}).expect(200);
   tokens.set(id,login.body.data.accessToken);
  }
 },30000);
 const create=async(actor:string,body:ReturnType<typeof payload>)=>(await request(app).post('/api/v1/announcements').set('Authorization',`Bearer ${tokens.get(actor)}`).send(body).expect(201)).body.data.id as string;
 it.each([
  ['A: Super Admin web to Client app',root,'CLIENT',[admin],[client],client],
  ['B: Super Admin web to Admin app',root,'ADMIN',[admin],[],admin],
  ['C: Admin web to its Client app',admin,'CLIENT',[admin],[client],client],
  ['D: Admin web to its child Admin app',admin,'ADMIN',[child,childC,childD],[],child],
 ] as const)('%s',async(_name,creator,type,admins,clients,target)=>{
  const id=await create(creator,payload(type,[...admins],[...clients]));
  const record=(await state.db!.query<{created_by:string;active:boolean}>('SELECT created_by,active FROM announcements WHERE id=$1',[id])).rows[0];
  expect(record).toMatchObject({created_by:creator,active:true});
  expect((await state.db!.query<{user_id:string}>('SELECT user_id FROM announcement_recipients WHERE announcement_id=$1',[id])).rows.map(r=>r.user_id).sort()).toEqual([...(type==='ADMIN'?admins:clients)].sort());
  const result=(await recipient(target).expect(200)).body;
  expect(result.data).toContainEqual(expect.objectContaining({id,title:'Web to mobile',unread:true}));
  expect(result.unreadCount).toBe(result.data.filter((r:{unread:boolean})=>r.unread).length);
  const managed=await request(app).get(`/api/v1/announcements/${id}`).set('Authorization',`Bearer ${tokens.get(creator)}`).expect(200);
  expect(managed.body.data.id).toBe(id);
  for(const unrelated of [other,foreignClient,siblingClient])expect((await recipient(unrelated).expect(200)).body.data.map((r:{id:string})=>r.id)).not.toContain(id);
  if(type==='CLIENT')expect((await recipient(admin).expect(200)).body.data.map((r:{id:string})=>r.id)).not.toContain(id);
  if(type==='ADMIN')for(const selected of admins)expect((await recipient(selected).expect(200)).body.data.map((r:{id:string})=>r.id)).toContain(id);
 });
 it('rejects sibling branches and cannot choose another recipient with query parameters',async()=>{
  await request(app).post('/api/v1/announcements').set('Authorization',`Bearer ${tokens.get(admin)}`).send(payload('CLIENT',[other],[foreignClient])).expect(403);
  await request(app).post('/api/v1/announcements').set('Authorization',`Bearer ${tokens.get(admin)}`).send(payload('ADMIN',[other])).expect(403);
  const id=await create(root,payload('CLIENT',[admin],[client]));
  const spoof=await recipient(siblingClient).query({clientId:client,userId:client}).expect(200);
  expect(spoof.body.data.map((r:{id:string})=>r.id)).not.toContain(id);
  await request(app).post(`/api/v1/announcements/${id}/read`).set('Authorization',`Bearer ${tokens.get(siblingClient)}`).expect(404);
  await request(app).post(`/api/v1/announcements/${id}/hide-popup`).set('Authorization',`Bearer ${tokens.get(siblingClient)}`).expect(404);
 });
 it('persists per-recipient read and popup dismissal without removing the inbox record',async()=>{
  const id=await create(root,payload('ADMIN',[child,childC]));
  await request(app).post(`/api/v1/announcements/${id}/read`).set('Authorization',`Bearer ${tokens.get(child)}`).expect(204);
  await request(app).post(`/api/v1/announcements/${id}/hide-popup`).set('Authorization',`Bearer ${tokens.get(child)}`).expect(204);
  expect((await recipient(child).expect(200)).body.data).toContainEqual(expect.objectContaining({id,unread:false,dismissed:true}));
  expect((await recipient(childC).expect(200)).body.data).toContainEqual(expect.objectContaining({id,unread:true,dismissed:false}));
 });
 it('filters inactive, future, expired and archived notices on the server',async()=>{
  const ids=[];
  ids.push(await create(root,{...payload('CLIENT',[admin],[client]),active:false}));
  ids.push(await create(root,{...payload('CLIENT',[admin],[client]),startsAt:new Date(Date.now()+60_000).toISOString()}));
  ids.push(await create(root,{...payload('CLIENT',[admin],[client]),startsAt:new Date(Date.now()-120_000).toISOString(),endsAt:new Date(Date.now()-60_000).toISOString()}));
  const archived=await create(root,payload('CLIENT',[admin],[client]));ids.push(archived);
  await request(app).delete(`/api/v1/announcements/${archived}`).set('Authorization',`Bearer ${tokens.get(root)}`).expect(204);
  const visible=(await recipient(client).expect(200)).body.data.map((r:{id:string})=>r.id);
  for(const id of ids)expect(visible).not.toContain(id);
  await request(app).get('/api/v1/announcements/my').expect(401);
  await request(app).post('/api/v1/announcements').set('Authorization',`Bearer ${tokens.get(client)}`).send(payload('ADMIN',[child])).expect(403);
 });
 it('keeps recipient reading independent of revoked announcement-management grants',async()=>{
  const id=await create(root,payload('ADMIN',[childD]));
  await state.db!.query('UPDATE admin_permissions SET allowed=false WHERE admin_id=$1',[childD]);
  expect((await recipient(childD).expect(200)).body.data).toContainEqual(expect.objectContaining({id}));
  await request(app).post(`/api/v1/announcements/${id}/read`).set('Authorization',`Bearer ${tokens.get(childD)}`).expect(204);
  await request(app).get('/api/v1/announcements').set('Authorization',`Bearer ${tokens.get(childD)}`).expect(403);
  await request(app).post('/api/v1/announcements').set('Authorization',`Bearer ${tokens.get(childD)}`).send(payload('ADMIN',[childD])).expect(403);
 });
});
