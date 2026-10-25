import {readFile} from 'node:fs/promises';
import {randomUUID,createHmac} from 'node:crypto';
import {relayProfileCanonical,type RelayModels} from '@fleet/shared-types';
import type {Socket} from 'node:net';
import type {Pool} from 'pg';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {RelayDispatcher} from '../src/services/relay-dispatcher.js';
import {crc16X25} from '../src/protocols/gt06/parser.js';
let db:PGlite,worker:RelayDispatcher,testPool:Pool;
const owner=randomUUID(),other=randomUUID(),vehicle=randomUUID(),otherVehicle=randomUUID(),device=randomUUID(),otherDevice=randomUUID(),assignment=randomUUID(),otherAssignment=randomUUID(),connection=randomUUID(),otherConnection=randomUUID();
const makeSocket=()=>({destroyed:false,writable:true,write:vi.fn<(frame:Buffer,callback?:(error?:Error|null)=>void)=>boolean>(()=>true),destroy:vi.fn()});
let socket:ReturnType<typeof makeSocket>,secondSocket:ReturnType<typeof makeSocket>;
const errors:unknown[]=[];
beforeAll(async()=>{
 db=new PGlite();await db.exec(`CREATE TABLE users(id uuid PRIMARY KEY,owner_id uuid REFERENCES users,role text DEFAULT 'CLIENT',active boolean DEFAULT true);
 CREATE TABLE vehicles(id uuid PRIMARY KEY,owner_id uuid REFERENCES users,vehicle_number text,vehicle_type text DEFAULT 'Bike',active boolean DEFAULT true,relay_configured boolean DEFAULT true);
 CREATE TABLE devices(id uuid PRIMARY KEY,owner_id uuid REFERENCES users,imei text,model text,protocol text DEFAULT 'GT06',active boolean DEFAULT true,last_seen_at timestamptz DEFAULT now());
 CREATE TABLE vehicle_device_assignments(id uuid PRIMARY KEY,vehicle_id uuid REFERENCES vehicles,device_id uuid REFERENCES devices,assigned_at timestamptz DEFAULT now()-interval '1 day',unassigned_at timestamptz);
 CREATE TABLE device_status(device_id uuid PRIMARY KEY REFERENCES devices,current_speed double precision DEFAULT 0,current_ignition boolean DEFAULT false,last_heartbeat_at timestamptz DEFAULT now());
 CREATE TABLE locations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vehicle_id uuid REFERENCES vehicles,device_id uuid REFERENCES devices,latitude double precision DEFAULT 28,longitude double precision DEFAULT 76,speed double precision DEFAULT 0,gps_valid boolean DEFAULT true,tracker_timestamp timestamptz DEFAULT now(),server_received_at timestamptz DEFAULT now());
 CREATE TABLE admin_permissions(admin_id uuid,permission_key text,allowed boolean);`);
 for(const name of ['028_vehicle_relay_commands.sql','031_gt06_relay_dispatch.sql','032_relay_wire_evidence.sql','033_relay_probe_heartbeat.sql'])await db.exec(await readFile(new URL(`../../../database/migrations/${name}`,import.meta.url),'utf8'));
},60000);
afterAll(async()=>db?.close());
beforeEach(async()=>{
 await db.exec('TRUNCATE users CASCADE');errors.length=0;
 const query=async(sql:string,values?:unknown[])=>{const r=await db.query(sql,values);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};};
 testPool={query,connect:async()=>({query,release:()=>{}})} as unknown as Pool;
 worker=new RelayDispatcher(testPool,error=>errors.push(error));
 await db.query('INSERT INTO users(id) VALUES($1),($2)',[owner,other]);await db.query("INSERT INTO vehicles(id,owner_id,vehicle_number) VALUES($1,$2,'A'),($3,$4,'B')",[vehicle,owner,otherVehicle,other]);
 await db.query("INSERT INTO devices(id,owner_id,relay_profile) VALUES($1,$2,'CONCOX_GT06_DYD'),($3,$4,'CONCOX_GT06_DYD')",[device,owner,otherDevice,other]);
 await db.query('INSERT INTO vehicle_device_assignments(id,vehicle_id,device_id) VALUES($1,$2,$3),($4,$5,$6)',[assignment,vehicle,device,otherAssignment,otherVehicle,otherDevice]);
 await db.query('INSERT INTO device_status(device_id) VALUES($1),($2)',[device,otherDevice]);await db.query('INSERT INTO locations(vehicle_id,device_id) VALUES($1,$2),($3,$4)',[vehicle,device,otherVehicle,otherDevice]);
 socket=makeSocket();secondSocket=makeSocket();await worker.bind(device,connection,'GT06',socket as unknown as Socket);await worker.bind(otherDevice,otherConnection,'GT06',secondSocket as unknown as Socket);
});
async function queue(which='A',action='lock'){
 const id=randomUUID(),b=which==='A';await db.query(`INSERT INTO vehicle_relay_commands(id,actor_id,owner_id,vehicle_id,device_id,assignment_id,connection_id,protocol,command_profile,action,idempotency_key,status,result_code,result_message,server_flag,dispatch_before,expires_at)
 VALUES($1,$2,$2,$3,$4,$5,$6,'GT06','CONCOX_GT06_DYD',$7,$8,'pending','RELAY_QUEUED','Pending',nextval('relay_server_flag_seq'),now()+interval '5 seconds',now()+interval '20 seconds')`,[id,b?owner:other,b?vehicle:otherVehicle,b?device:otherDevice,b?assignment:otherAssignment,b?connection:otherConnection,action,randomUUID()]);return id;
}
async function result(id:string){return (await db.query<{status:string;result_code:string}>('SELECT status,result_code FROM vehicle_relay_commands WHERE id=$1',[id])).rows[0];}
function reply(flag:number,text:string){const data=Buffer.from(text),body=Buffer.alloc(1+4+data.length+2);body[0]=4+data.length;body.writeUInt32BE(flag,1);data.copy(body,5);body.writeUInt16BE(2,body.length-2);const payload=Buffer.from([body.length+5,0x15,...body,0,77]),crc=crc16X25(payload);return Buffer.from([0x78,0x78,...payload,crc>>8,crc&255,13,10]);}

it('routes only to the intended one of two devices and confirms only a matching positive reply',async()=>{
 const id=await queue('B');await worker.tick();expect(errors).toEqual([]);expect(socket.write).not.toHaveBeenCalled();expect(secondSocket.write).toHaveBeenCalledOnce();expect((await result(id)).status).toBe('sent');
 const frame=secondSocket.write.mock.calls[0][0] as unknown as Buffer,flag=frame.readUInt32BE(5);
 await worker.receive(connection,reply(flag,'DYD=Success!'));expect((await result(id)).status).toBe('sent');
 await worker.receive(otherConnection,reply(flag+1,'DYD=Success!'));await worker.receive(otherConnection,reply(flag,'HFYD=Success!'));expect((await result(id)).status).toBe('sent');
 await worker.receive(otherConnection,reply(flag,'DYD=Success!'));expect((await result(id)).status).toBe('succeeded');await worker.tick();expect(secondSocket.write).toHaveBeenCalledOnce();
});
it('sends restore separately and records an explicit negative reply without reporting success',async()=>{
 const id=await queue('A','unlock');await worker.tick();expect(errors).toEqual([]);const frame=socket.write.mock.calls[0][0] as unknown as Buffer;expect(frame.toString('ascii')).toContain('HFYD#');await worker.receive(connection,reply(frame.readUInt32BE(5),'HFYD=Fail!'));expect((await result(id)).status).toBe('failed');
});
it.each(['moving','stale','ignition','permission','assignment','expired'])('rechecks %s immediately before dispatch',async reason=>{
 const id=await queue();
 if(reason==='moving')await db.query('UPDATE locations SET speed=15 WHERE device_id=$1',[device]);
 if(reason==='stale')await db.query("UPDATE locations SET tracker_timestamp=now()-interval '5 minutes' WHERE device_id=$1",[device]);
 if(reason==='ignition')await db.query('UPDATE device_status SET current_ignition=true WHERE device_id=$1',[device]);
 if(reason==='permission')await db.query("UPDATE users SET role='ADMIN' WHERE id=$1",[owner]);
 if(reason==='assignment'){await db.query('UPDATE vehicle_device_assignments SET unassigned_at=now() WHERE id=$1',[assignment]);await db.query('INSERT INTO vehicle_device_assignments(id,vehicle_id,device_id) VALUES($1,$2,$3)',[randomUUID(),vehicle,device]);}
 if(reason==='expired')await db.query("UPDATE vehicle_relay_commands SET dispatch_before=now()-interval '1 second' WHERE id=$1",[id]);
 await worker.tick();expect(errors).toEqual([]);expect(socket.write).not.toHaveBeenCalled();expect((await result(id)).status).toBe('rejected');
});
it('does not replay pending or sent commands on reconnect and ignores late replies',async()=>{
 const id=await queue();await worker.tick();const frame=socket.write.mock.calls[0][0] as unknown as Buffer;await worker.unbind(connection);
 const replacement=makeSocket(),newConnection=randomUUID();await worker.bind(device,newConnection,'GT06',replacement as unknown as Socket);await worker.tick();expect(replacement.write).not.toHaveBeenCalled();await worker.receive(newConnection,reply(frame.readUInt32BE(5),'DYD=Success!'));expect((await result(id)).status).toBe('timed_out');
});
it('times out a missing ACK without retry, including after an actual dispatch',async()=>{
 const id=await queue();await worker.tick();await db.query("UPDATE vehicle_relay_commands SET expires_at=now()-interval '1 second' WHERE id=$1",[id]);await worker.tick();await worker.tick();expect(socket.write).toHaveBeenCalledOnce();expect((await result(id)).status).toBe('timed_out');
});
it('recreates a missing lease, but never steals a lease from another instance',async()=>{
 await db.query('DELETE FROM tracker_connections WHERE device_id=$1',[device]);await worker.tick();
 expect((await db.query<{connection_id:string}>('SELECT connection_id FROM tracker_connections WHERE device_id=$1',[device])).rows[0].connection_id).toBe(connection);
 await db.query('UPDATE tracker_connections SET instance_id=$2 WHERE device_id=$1',[device,randomUUID()]);await worker.tick();expect(socket.destroy).toHaveBeenCalledOnce();
});
it('preserves the newest socket/lease after overlapping logins and a late old close',async()=>{
 const old=makeSocket(),next=makeSocket(),oldId=randomUUID(),nextId=randomUUID();
 await Promise.all([worker.bind(device,oldId,'GT06',old as unknown as Socket,device),worker.bind(device,nextId,'GT06',next as unknown as Socket,device)]);
 await worker.unbind(oldId,old as unknown as Socket);
 expect(old.destroy).toHaveBeenCalledOnce();expect((await db.query<{connection_id:string}>('SELECT connection_id FROM tracker_connections WHERE device_id=$1',[device])).rows[0].connection_id).toBe(nextId);
 const id=await queue();await db.query('UPDATE vehicle_relay_commands SET connection_id=$2 WHERE id=$1',[id,nextId]);await worker.tick();expect(next.write).toHaveBeenCalledOnce();expect(old.write).not.toHaveBeenCalled();
});
it('blocks writes to a non-writable socket and unconfigured models',async()=>{
 const id=await queue();socket.writable=false;await worker.tick();expect(socket.write).not.toHaveBeenCalled();expect((await result(id)).status).toBe('rejected');
 socket.writable=true;await db.query("UPDATE devices SET model='UNVERIFIED' WHERE id=$1",[device]);const next=await queue();await worker.tick();expect((await result(next)).result_code).toBe('RELAY_MODEL_CONFIGURATION');expect(socket.write).not.toHaveBeenCalled();
});
it('sends the configured model text, redacts credentials and persists correlated 0x21 results',async()=>{
 await worker.unbind(connection);await worker.unbind(otherConnection);
 const logs:unknown[]=[];
 worker=new RelayDispatcher(testPool,error=>errors.push(error),(fields,message)=>logs.push({fields,message}),{S106:{lock:'DYD,{password}#',unlock:'HFYD,{password}#',password:'123456',lockSuccess:'MODEL CUT OK',unlockSuccess:'MODEL RESTORE OK'}});
 await db.query("UPDATE devices SET model='S106' WHERE id=$1",[device]);await worker.bind(device,connection,'GT06',socket as unknown as Socket);
 const id=await queue();await worker.tick();const frame=socket.write.mock.calls[0][0] as Buffer,flag=frame.readUInt32BE(5);expect(frame.toString('ascii')).toContain('DYD,123456#');
 const data=Buffer.from('MODEL CUT OK','utf16le').swap16(),body=Buffer.alloc(5+data.length);body.writeUInt32BE(flag);body[4]=2;data.copy(body,5);
 const length=body.length+5,payload=Buffer.from([length>>8,length&255,0x21,...body,0,77]),crc=crc16X25(payload),response=Buffer.from([0x79,0x79,...payload,crc>>8,crc&255,13,10]);
 await worker.receive(connection,response);expect((await result(id)).status).toBe('succeeded');
 const stored=(await db.query<{command_hex_redacted:string;response_text:string}>('SELECT command_hex_redacted,response_text FROM vehicle_relay_commands WHERE id=$1',[id])).rows[0];
 expect(stored.response_text).toBe('MODEL CUT OK');expect(stored.command_hex_redacted).toContain('**');expect(JSON.stringify(logs)).not.toContain('123456');expect(JSON.stringify(logs)).not.toContain(Buffer.from('123456').toString('hex'));
});
it('uses a signed per-request PDF profile without changing model and corroborates success with the next heartbeat',async()=>{
 await worker.unbind(connection);await worker.unbind(otherConnection);const logs:Array<{fields:Record<string,unknown>;message:string}>=[];
 const models:RelayModels={PDF:{lock:'DYD#',unlock:'HFYD#',lockSuccess:'DYD=Success!',unlockSuccess:'HFYD=Success!',languageField:false}},key='test-shared-internal-profile-signing-key';
 worker=new RelayDispatcher(testPool,error=>errors.push(error),(fields,message)=>logs.push({fields,message}),models,key);
 await worker.bind(device,connection,'GT06',socket as unknown as Socket);
 const digest=createHmac('sha256',key).update(relayProfileCanonical(models.PDF)).digest('hex');
 const id=await queue('A','unlock');await db.query('UPDATE vehicle_relay_commands SET probe_profile=$2,probe_profile_digest=$3 WHERE id=$1',[id,'PDF',digest]);await worker.tick();expect(errors).toEqual([]);
 const frame=socket.write.mock.calls[0][0] as Buffer;expect(frame[2]).toBe(Buffer.byteLength('HFYD#')+10);expect(frame.subarray(9,-6).toString('ascii')).toBe('HFYD#');
 expect((await db.query<{model:string|null}>('SELECT model FROM devices WHERE id=$1',[device])).rows[0].model).toBeNull();
 const coalescedReceiptTime=new Date();await worker.receive(connection,reply(frame.readUInt32BE(5),'HFYD=Success!'));
 const heartbeat=(raw:number)=>{const payload=Buffer.from([10,0x13,raw,6,4,0,2,0,1]),crc=crc16X25(payload);return Buffer.from([0x78,0x78,...payload,crc>>8,crc&255,13,10]);};
 await worker.heartbeat(connection,heartbeat(0x44),coalescedReceiptTime);
 const evidence=(await db.query<{status:string;heartbeat_matches:boolean}>('SELECT status,heartbeat_matches FROM vehicle_relay_commands WHERE id=$1',[id])).rows[0];expect(evidence).toMatchObject({status:'succeeded',heartbeat_matches:true});
 const otherId=await queue('A','unlock');await db.query('UPDATE vehicle_relay_commands SET probe_profile=$2,probe_profile_digest=$3 WHERE id=$1',[otherId,'PDF',digest]);await worker.tick();const next=socket.write.mock.calls[1][0] as Buffer;await worker.receive(connection,reply(next.readUInt32BE(5),'HFYD=Success!'));await worker.heartbeat(connection,heartbeat(0xc4));
 expect((await db.query<{status:string;heartbeat_matches:boolean}>('SELECT status,heartbeat_matches FROM vehicle_relay_commands WHERE id=$1',[otherId])).rows[0]).toMatchObject({status:'succeeded',heartbeat_matches:false});
 expect(logs.some(row=>row.fields.warning===true)).toBe(true);expect(logs.some(row=>row.fields.profile==='PDF'&&(row.fields.format as {languageField:boolean}).languageField===false)).toBe(true);
 expect((await db.query<{relay_state_reported:boolean;relay_terminal_info:number}>('SELECT relay_state_reported,relay_terminal_info FROM device_status WHERE device_id=$1',[device])).rows[0]).toMatchObject({relay_state_reported:true,relay_terminal_info:0xc4});
});
it('rejects a probe profile signature mismatch before writing',async()=>{
 const id=await queue('A','unlock');await db.query('UPDATE vehicle_relay_commands SET probe_profile=$2,probe_profile_digest=$3 WHERE id=$1',[id,'PDF','wrong']);await worker.tick();expect(socket.write).not.toHaveBeenCalled();expect((await result(id)).result_code).toBe('RELAY_PROBE_CONFIGURATION');
});
