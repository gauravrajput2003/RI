import {afterAll,beforeAll,beforeEach,describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
// Execute the tracker's production merge SQL using the API's PostgreSQL test
// runtime. Dynamic URL import keeps this cross-service test out of build roots.
const trackerModule=new URL('../../../../tracker/src/services/current-state.ts',import.meta.url).href;
let db:PGlite;
let mergeLocation:Awaited<ReturnType<typeof importTracker>>['mergeCurrentLocation'];
let mergeHeartbeat:Awaited<ReturnType<typeof importTracker>>['mergeHeartbeat'];
const importTracker=()=>import(/* @vite-ignore */ trackerModule);
const now=new Date('2026-10-08T15:00:00Z');
const client={query:async(sql:string,values:unknown[])=>({rows:(await db.query(sql.replaceAll('::geography','::point'),values)).rows})};
const fix=(speed:number,gpsValid=true)=>({speed,gpsValid,ignition:null,serverReceivedAt:now,latitude:28,longitude:76,satellites:12,batteryPercent:null,gsmSignal:null});
const status=async()=>(await db.query('SELECT state,current_ignition,current_speed FROM device_status')).rows[0];
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE TYPE device_connection_state AS ENUM ('ONLINE','OFFLINE','MOVING','IDLE','STOPPED');
    CREATE TABLE devices(id text PRIMARY KEY,identity_type text,identity_value text,active boolean,last_seen_at timestamptz,last_heartbeat_at timestamptz,updated_at timestamptz);
    CREATE TABLE device_status(device_id text PRIMARY KEY,state device_connection_state,last_location_at timestamptz,last_heartbeat_at timestamptz,connected_at timestamptz,current_position point,current_speed real,current_ignition boolean,current_gps_valid boolean,current_satellites integer,current_battery_percent real,current_gsm_signal integer,updated_at timestamptz);
    CREATE FUNCTION ST_MakePoint(double precision,double precision) RETURNS point LANGUAGE SQL AS 'SELECT point($1,$2)';
    CREATE FUNCTION ST_SetSRID(point,integer) RETURNS point LANGUAGE SQL AS 'SELECT $1';`);
  ({mergeCurrentLocation:mergeLocation,mergeHeartbeat}=await importTracker());
},30000);
beforeEach(async()=>{await db.exec("TRUNCATE devices,device_status;INSERT INTO devices(id,identity_type,identity_value,active) VALUES('d','IMEI','test',true)")});
afterAll(async()=>db?.close());
describe('GT06 heartbeat and GPS state transitions',()=>{
  it('retains ACC ON across ordinary stationary location packets',async()=>{
    await mergeHeartbeat(client,'test',now,{ignition:true},5);
    await mergeLocation(client,'d',fix(0),5);
    expect(await status()).toMatchObject({state:'IDLE',current_ignition:true,current_speed:0});
    await mergeLocation(client,'d',fix(3),5);
    expect(await status()).toMatchObject({state:'IDLE'});
  });
  it('moves running → idle → stopped, retaining the last explicit ACC',async()=>{
    await mergeHeartbeat(client,'test',now,{ignition:true},5);
    await mergeLocation(client,'d',fix(24),5);
    expect(await status()).toMatchObject({state:'MOVING'});
    await mergeHeartbeat(client,'test',now,{ignition:true},5);
    expect(await status()).toMatchObject({state:'MOVING'});
    await mergeLocation(client,'d',fix(0),5);
    expect(await status()).toMatchObject({state:'IDLE'});
    await mergeHeartbeat(client,'test',now,{ignition:false},5);
    expect(await status()).toMatchObject({state:'STOPPED',current_ignition:false,current_speed:0});
    await mergeLocation(client,'d',fix(0),5);
    expect(await status()).toMatchObject({state:'STOPPED'});
  });
  it('does not treat invalid GPS speed as movement or let a status-free packet erase ACC',async()=>{
    await mergeHeartbeat(client,'test',now,{ignition:true},5);
    await mergeLocation(client,'d',fix(24,false),5);
    await mergeHeartbeat(client,'test',now,{},5);
    expect(await status()).toMatchObject({state:'IDLE',current_ignition:true,current_speed:null});
  });
  it('does not keep reporting running from a stale speed when only heartbeats arrive',async()=>{
    await mergeLocation(client,'d',fix(24),5);
    await mergeHeartbeat(client,'test',new Date(+now+180000),{ignition:true},5);
    expect(await status()).toMatchObject({state:'ONLINE',current_ignition:true});
  });
});
