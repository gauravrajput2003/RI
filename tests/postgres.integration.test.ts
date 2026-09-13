import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { connect, type Socket } from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Gt06Decoder } from '../services/tracker/src/protocols/gt06/decoder.js';
import { gt06FamilyFramer } from '../services/tracker/src/protocols/framing/gt06-family-framer.js';
import type { NormalizedLocation } from '../packages/shared-types/src/index.js';

// Opt-in config only: real PostgreSQL, real tracker process, real TCP and HTTP.
// No vi.mock, repository replacements, PGlite, schema creation, or migrations.
const fixture = async (name:string) => Buffer.from((await readFile(new URL(
  `../services/tracker/test/fixtures/gt06/${name}.hex`, import.meta.url), 'utf8')).trim(), 'hex');
const userId=randomUUID(), vehicleId=randomUUID(), deviceId=randomUUID(), assignmentId=randomUUID();
const email=`postgres-integration-${userId}@example.invalid`;
const decoder=new Gt06Decoder();
let pool:typeof import('../services/tracker/src/db/repository.js').pool;
let apiPool:typeof import('../services/api/src/db/pool.js').pool;
let apiServer:Server|undefined, tracker:ChildProcess|undefined, socket:Socket|undefined;
let baseUrl:string, tcpPort:number, accessToken:string, identity:string;
let trackerOutput='';
let localTargetVerified=false;
const delivered:NormalizedLocation[]=[];
const listen = async (server:Server) => {
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  return (server.address() as import('node:net').AddressInfo).port;
};
const httpGet = async () => {
  const response=await fetch(`${baseUrl}/api/v1/vehicles/${vehicleId}/latest-location`,{
    headers:{Authorization:`Bearer ${accessToken}`},
  });
  expect(response.status).toBe(200);
  return (await response.json()).data;
};
const rows = async () => (await pool.query('SELECT * FROM locations WHERE device_id=$1 ORDER BY server_received_at', [deviceId])).rows;
const current = async () => (await pool.query(`SELECT *,ST_X(current_position::geometry) AS longitude,
  ST_Y(current_position::geometry) AS latitude,ST_SRID(current_position::geometry) AS srid
  FROM device_status WHERE device_id=$1`,[deviceId])).rows[0];
async function send(name:string) {
  const frame=await fixture(name);
  expect(gt06FamilyFramer.extract(frame).frames).toEqual([frame]);
  const decoded=decoder.decode(frame,new Date());
  const expected=Buffer.from(decoded.acknowledgement!);
  await new Promise<void>((resolve,reject)=>{
    let bytes=Buffer.alloc(0);
    const finish=(error?:Error)=>{
      clearTimeout(timeout);socket!.off('data',onData);socket!.off('error',onError);
      if(error)reject(error);else resolve();
    };
    const onError=(error:Error)=>finish(error);
    const onData=(chunk:Buffer)=>{
      bytes=Buffer.concat([bytes,chunk]);
      if(bytes.length>=expected.length){
        try{expect(bytes).toEqual(expected);finish()}catch(error){finish(error as Error)}
      }
    };
    const timeout=setTimeout(()=>finish(new Error(`No ${name} ACK: ${trackerOutput}`)),10000);
    socket!.on('data',onData);socket!.once('error',onError);socket!.write(frame);
  });
  return decoded;
}

beforeAll(async()=>{
  process.env.NODE_ENV='test';
  // Test-only authentication secrets. DATABASE_URL still uses existing local config.
  process.env.JWT_SECRET='postgres-integration-access-secret-32-characters';
  process.env.JWT_REFRESH_SECRET='postgres-integration-refresh-secret-32-characters';
  process.env.INTERNAL_TRACKER_SECRET='postgres-integration-internal-secret-32-characters';
  const repository=await import('../services/tracker/src/db/repository.js');
  pool=repository.pool;
  const {env}=await import('../services/tracker/src/config/env.js');
  const target=new URL(env.DATABASE_URL);
  if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.pathname!='/fleet'||(target.port&&target.port!=='5432')){
    throw new Error('This integration test permits only the local fleet database on port 5432');
  }
  localTargetVerified=true;
  const info=(await pool.query(`SELECT current_database() AS database,version(),postgis_full_version() AS postgis,
    inet_server_addr()::text AS address,inet_server_port() AS port`)).rows[0];
  expect(info.database).toBe('fleet');expect(info.postgis).toContain('POSTGIS=');
  console.info('REAL_DATABASE',JSON.stringify(info));
  identity=decoder.decode(await fixture('login'),new Date()).imei!;
  expect(identity).toBeTruthy();
  // Refuse collisions; never reuse, update, or delete an existing fixture device.
  expect((await pool.query('SELECT id FROM devices WHERE imei=$1 OR identity_value=$1',[identity])).rows,
    'Fixture identity already exists; integration test will not overwrite it').toHaveLength(0);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[
      userId,email,'$2b$10$9WwvqIMPItT2C/S7TVQ7qOCLXLrSbZ9iOK..JDXtVr.bW0fsIMolm',
    ]);
    await client.query('INSERT INTO vehicles(id,vehicle_number,owner_id) VALUES($1,$2,$3)',[vehicleId,`integration-${vehicleId}`,userId]);
    await client.query("INSERT INTO devices(id,imei,identity_type,identity_value,protocol) VALUES($1,$2,'IMEI',$2,'GT06')",[deviceId,identity]);
    await client.query('INSERT INTO vehicle_device_assignments(id,vehicle_id,device_id) VALUES($1,$2,$3)',[assignmentId,vehicleId,deviceId]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
  const {deviceProtocolResolver}=await import('../services/tracker/src/db/device-protocol-resolver.js');
  expect(await deviceProtocolResolver.find('IMEI',identity)).toMatchObject({id:deviceId,protocol:'GT06',identityValue:identity});
  const {app}=await import('../services/api/src/app.js');
  apiPool=(await import('../services/api/src/db/pool.js')).pool;
  // Observe the final publication callback. All inbound HTTP validation and DB reads/writes are real.
  app.locals.publishVehicleLocation=async(id:string,location:NormalizedLocation)=>{
    expect(id).toBe(vehicleId);
    expect((await apiPool.query('SELECT id FROM locations WHERE device_id=$1',[deviceId])).rowCount).toBeGreaterThan(0);
    delivered.push(location);
  };
  apiServer=createServer(app);baseUrl=`http://127.0.0.1:${await listen(apiServer)}`;
  const login=await fetch(`${baseUrl}/api/v1/auth/login`,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password:'fixture-integration-password'})});
  expect(login.status).toBe(200);accessToken=(await login.json()).data.accessToken;
  const reservation=createServer();tcpPort=await listen(reservation);
  await new Promise<void>(resolve=>reservation.close(()=>resolve()));
  tracker=spawn(process.execPath,['--import','tsx','services/tracker/src/server.ts'],{
    cwd:fileURLToPath(new URL('../',import.meta.url)),windowsHide:true,
    env:{...process.env,DATABASE_URL:env.DATABASE_URL,TCP_PORT:String(tcpPort),INTERNAL_API_URL:`${baseUrl}/internal/v1/telemetry/location`},
    stdio:['ignore','pipe','pipe'],
  });
  await new Promise<void>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error(`Tracker start timeout: ${trackerOutput}`)),15000);
    const data=(chunk:Buffer)=>{trackerOutput+=chunk.toString();if(trackerOutput.includes('tracker listening')){clearTimeout(timeout);resolve()}};
    tracker!.stdout!.on('data',data);tracker!.stderr!.on('data',data);
    tracker!.once('error',error=>{clearTimeout(timeout);reject(error)});
    tracker!.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Tracker exited ${code}: ${trackerOutput}`))});
  });
  socket=connect(tcpPort,'127.0.0.1');await once(socket,'connect');
});

afterAll(async()=>{
  socket?.destroy();
  if(tracker&&tracker.exitCode===null){const exited=once(tracker,'exit');tracker.kill();await exited}
  if(apiServer)await new Promise<void>(resolve=>apiServer!.close(()=>resolve()));
  try{
    if(pool && localTargetVerified){
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        await client.query('DELETE FROM locations WHERE device_id=$1',[deviceId]);
        await client.query('DELETE FROM device_status WHERE device_id=$1',[deviceId]);
        await client.query('DELETE FROM vehicle_device_assignments WHERE id=$1',[assignmentId]);
        await client.query('DELETE FROM devices WHERE id=$1',[deviceId]);
        await client.query('DELETE FROM vehicles WHERE id=$1',[vehicleId]);
        await client.query('DELETE FROM refresh_tokens WHERE user_id=$1',[userId]);
        await client.query('DELETE FROM users WHERE id=$1',[userId]);
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
      const remaining=(await pool.query(`SELECT
        (SELECT count(*) FROM locations WHERE device_id=$1)+
        (SELECT count(*) FROM device_status WHERE device_id=$1)+
        (SELECT count(*) FROM devices WHERE id=$1)+
        (SELECT count(*) FROM vehicles WHERE id=$2)+
        (SELECT count(*) FROM users WHERE id=$3)+
        (SELECT count(*) FROM refresh_tokens WHERE user_id=$3)+
        (SELECT count(*) FROM vehicle_device_assignments WHERE id=$4) AS count`,[deviceId,vehicleId,userId,assignmentId])).rows[0];
      expect(Number(remaining.count)).toBe(0);
      console.info('CLEANUP verified: 0 test rows remain across all 7 touched tables');
    }
  }finally{await apiPool?.end();await pool?.end()}
});

it('persists authentic GT06 TCP captures through real PostgreSQL/PostGIS, merges state, and serves latest location',async()=>{
  const login=await send('login');expect(login.imei).toBe(identity);
  expect((await current()).state).toBe('ONLINE');
  // Exercise persistence creating current state as well as subsequent UPSERT merges.
  await pool.query('DELETE FROM device_status WHERE device_id=$1',[deviceId]);
  const decoded=(await send('location')).location!;
  expect(decoded.trackerTimestamp?.toISOString()).toBe('2006-12-28T16:42:14.000Z');
  expect(decoded.latitude).toBeCloseTo(28.879542,5);expect(decoded.longitude).toBeCloseTo(76.586764,5);
  expect(decoded.speed).toBe(24);expect(decoded.course).toBe(166);expect(decoded.satellites).toBe(6);
  const first=(await rows())[0];expect(await rows()).toHaveLength(1);
  expect(first).toMatchObject({device_id:deviceId,vehicle_id:vehicleId,protocol:'GT06',latitude:decoded.latitude,
    longitude:decoded.longitude,speed:decoded.speed,course:decoded.course,ignition:null,satellites:6,gps_valid:decoded.gpsValid,
    battery_percent:null,battery_voltage:null,gsm_signal:null,metadata:decoded.metadata});
  expect(first.tracker_timestamp).toEqual(decoded.trackerTimestamp);
  const spatial=(await pool.query(`SELECT ST_X(position::geometry) AS longitude,ST_Y(position::geometry) AS latitude,
    ST_SRID(position::geometry) AS srid,ST_Distance(position,ST_SetSRID(ST_MakePoint($2,$3),4326)::geography) AS distance
    FROM locations WHERE device_id=$1`,[deviceId,decoded.longitude,decoded.latitude])).rows[0];
  expect(spatial).toEqual({longitude:decoded.longitude,latitude:decoded.latitude,srid:4326,distance:0});
  const moving=await current();expect(moving).toMatchObject({state:'MOVING',current_speed:24,current_ignition:null,
    current_battery_percent:null,current_gsm_signal:null,latitude:decoded.latitude,longitude:decoded.longitude,srid:4326});
  expect(moving.last_location_at).toEqual(first.server_received_at);
  expect((await pool.query('SELECT last_location_at FROM devices WHERE id=$1',[deviceId])).rows[0].last_location_at).toEqual(first.server_received_at);
  expect(delivered).toHaveLength(1);expect(delivered[0]).toMatchObject({imei:identity,deviceId,vehicleId,latitude:decoded.latitude,longitude:decoded.longitude});
  expect(await httpGet()).toMatchObject({latitude:decoded.latitude,longitude:decoded.longitude,speed:24,ignition:null,
    tracker_timestamp:decoded.trackerTimestamp!.toISOString(),server_received_at:first.server_received_at.toISOString(),state:'MOVING'});

  const heartbeat=await send('heartbeat');expect(heartbeat.metadata).toMatchObject({ignition:false,gsmSignal:4});
  const stopped=await current();expect(stopped).toMatchObject({state:'STOPPED',current_speed:0,current_ignition:false,current_gsm_signal:4,
    latitude:decoded.latitude,longitude:decoded.longitude,current_battery_percent:null});
  expect(stopped.last_location_at).toEqual(moving.last_location_at);expect(stopped.last_heartbeat_at.getTime()).toBeGreaterThanOrEqual(first.server_received_at.getTime());
  expect(await rows()).toHaveLength(1);expect(delivered).toHaveLength(1);
  // Latest-location intentionally exposes recorded speed/ignition, plus current state.
  expect(await httpGet()).toMatchObject({speed:24,ignition:null,state:'STOPPED'});

  await send('location'); // Replay unchanged bytes, with a later server receive time.
  const history=await rows();expect(history).toHaveLength(2);
  expect(history[1].server_received_at.getTime()).toBeGreaterThan(history[0].server_received_at.getTime());
  const merged=await current();expect(merged).toMatchObject({state:'MOVING',current_speed:24,current_ignition:false,current_gsm_signal:4,
    current_battery_percent:null,latitude:decoded.latitude,longitude:decoded.longitude});
  expect(merged.last_heartbeat_at).toEqual(stopped.last_heartbeat_at);
  expect(merged.last_location_at).toEqual(history[1].server_received_at);
  expect(await httpGet()).toMatchObject({server_received_at:history[1].server_received_at.toISOString(),
    tracker_timestamp:decoded.trackerTimestamp!.toISOString(),latitude:decoded.latitude,longitude:decoded.longitude,
    speed:24,ignition:null,gsm_signal:null,state:'MOVING'});
  expect(delivered).toHaveLength(2);
  console.info('VERIFIED GT06',JSON.stringify({identity,latitude:decoded.latitude,longitude:decoded.longitude,
    trackerTimestamp:decoded.trackerTimestamp,speed:decoded.speed,course:decoded.course,locations:history.length,
    states:[moving.state,stopped.state,merged.state],postgisSrid:spatial.srid,postgisDistance:spatial.distance}));
});
