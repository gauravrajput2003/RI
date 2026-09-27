// Optional browser QA server. Fixtures exist only in a disposable local database.
// Run from the repository root: node --import tsx services/api/test/geofence-browser-server.ts
import {Pool} from 'pg';
import dotenv from 'dotenv';
import {randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {spawn,type ChildProcess} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import type {Server} from 'node:http';
import bcrypt from 'bcrypt';

dotenv.config({path:fileURLToPath(new URL('../../../.env',import.meta.url))});
const source=new URL(process.env.DATABASE_URL!);
if(!['localhost','127.0.0.1','[::1]'].includes(source.hostname)||(source.port&&source.port!=='5432'))throw new Error('Browser QA requires local PostgreSQL on port 5432');
const database=`fleet_geofence_qa_${randomUUID().replaceAll('-','')}`;
const adminUrl=new URL(source);adminUrl.pathname='/postgres';
const admin=new Pool({connectionString:adminUrl.href});
let db:Pool|undefined,application:Pool|undefined,server:Server|undefined,vite:ChildProcess|undefined,created=false,closing=false;
async function cleanup(){
 if(closing)return;closing=true;
 vite?.kill();
 if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
 await application?.end();await db?.end();
 if(created&&/^fleet_geofence_qa_[a-f0-9]{32}$/.test(database))await admin.query(`DROP DATABASE "${database}"`);
 await admin.end();console.info('Disposable browser database removed.');process.exit(0);
}
process.on('SIGINT',()=>void cleanup());process.on('SIGTERM',()=>void cleanup());
try{
 await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`);created=true;
 const target=new URL(source);target.pathname=`/${database}`;
 process.env.DATABASE_URL=target.href;process.env.NODE_ENV='test';process.env.CORS_ORIGINS='http://127.0.0.1:5177,http://localhost:5177';
 process.env.JWT_SECRET=randomUUID()+randomUUID();process.env.JWT_REFRESH_SECRET=randomUUID()+randomUUID();process.env.INTERNAL_TRACKER_SECRET=randomUUID()+randomUUID();
 db=new Pool({connectionString:target.href});
 const migrations=new URL('../../../database/migrations/',import.meta.url);
 for(const name of (await readdir(migrations)).filter(n=>n.endsWith('.sql')).sort())await db.query(await readFile(new URL(name,migrations),'utf8'));
 const password=`qa-${randomUUID()}`,owner=randomUUID(),deviceOne=randomUUID(),deviceTwo=randomUUID();
 await db.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,'geofence-qa@example.invalid',$2,'USER')",[owner,await bcrypt.hash(password,4)]);
 const vehicles=await db.query("INSERT INTO vehicles(vehicle_number,alias,vehicle_type,owner_id,overspeed_limit) VALUES('QA-ONLY-01','North cargo','truck',$1,80),('QA-ONLY-02','Service bike','motorbike',$1,70) RETURNING id,vehicle_number",[owner]);
 const vehicleOne=vehicles.rows.find(row=>row.vehicle_number==='QA-ONLY-01')!.id,vehicleTwo=vehicles.rows.find(row=>row.vehicle_number==='QA-ONLY-02')!.id;
 await db.query("INSERT INTO devices(id,imei,protocol,identity_type,identity_value,owner_id,last_seen_at) VALUES($1,'QA-DEVICE-01','TEST','IMEI','QA-DEVICE-01',$3,now()),($2,'QA-DEVICE-02','TEST','IMEI','QA-DEVICE-02',$3,now())",[deviceOne,deviceTwo,owner]);
 await db.query("INSERT INTO vehicle_device_assignments(vehicle_id,device_id,assigned_at) VALUES($1,$2,now()-interval '1 day'),($3,$4,now()-interval '1 day')",[vehicleOne,deviceOne,vehicleTwo,deviceTwo]);
 await db.query("INSERT INTO device_status(device_id,state,current_speed,current_ignition,updated_at) VALUES($1,'MOVING',42,true,now()-interval '4 minutes'),($2,'STOPPED',0,false,now()-interval '12 minutes')",[deviceOne,deviceTwo]);
 await db.query(`INSERT INTO locations(device_id,vehicle_id,tracker_timestamp,server_received_at,latitude,longitude,position,speed,ignition,gps_valid,protocol,metadata)
   VALUES($1,$2,now()-interval '35 minutes',now()-interval '35 minutes',28.61,77.18,ST_SetSRID(ST_MakePoint(77.18,28.61),4326)::geography,30,true,true,'TEST','{"address":"Connaught Place, New Delhi"}'),
         ($1,$2,now()-interval '4 minutes',now()-interval '4 minutes',28.64,77.21,ST_SetSRID(ST_MakePoint(77.21,28.64),4326)::geography,42,true,true,'TEST','{"address":"India Gate, New Delhi"}'),
         ($3,$4,now()-interval '30 minutes',now()-interval '30 minutes',28.67,77.11,ST_SetSRID(ST_MakePoint(77.11,28.67),4326)::geography,18,true,true,'TEST','{"address":"Karol Bagh, New Delhi"}'),
         ($3,$4,now()-interval '12 minutes',now()-interval '12 minutes',28.68,77.12,ST_SetSRID(ST_MakePoint(77.12,28.68),4326)::geography,0,false,true,'TEST','{"address":"Rajendra Place, New Delhi"}')`,[deviceOne,vehicleOne,deviceTwo,vehicleTwo]);
 const {app}=await import('../src/app.js');application=(await import('../src/db/pool.js')).pool;
 server=app.listen(3107,'127.0.0.1');
 vite=spawn(process.execPath,[fileURLToPath(new URL('../../../apps/web/node_modules/vite/bin/vite.js',import.meta.url)),'--host','127.0.0.1','--port','5177','--strictPort'],{cwd:fileURLToPath(new URL('../../../apps/web',import.meta.url)),env:{...process.env,VITE_API_URL:'http://127.0.0.1:3107/api/v1'},windowsHide:true,stdio:'inherit'});
 vite.on('error',()=>void cleanup());
 console.info(`Browser QA: http://127.0.0.1:5177 | geofence-qa@example.invalid | ${password}`);
 console.info('Use Ctrl+C or POST /__qa_shutdown to clean up. Automatic cleanup after 20 minutes.');
 // Loopback-only test process; never installed in the production application.
 app.post('/__qa_shutdown',(_req,res)=>{res.end('Stopping isolated QA');setTimeout(()=>void cleanup(),50)});
 setTimeout(()=>void cleanup(),20*60*1000);
}catch(error){console.error(error);await cleanup()}
