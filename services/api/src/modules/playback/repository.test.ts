import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
let db:PGlite;
vi.mock('../../db/pool.js',()=>({query:(sql:string,params:unknown[])=>db.query(sql,params)}));
vi.mock('../../config/env.js',()=>({env:{MOVEMENT_THRESHOLD_KPH:5}}));
vi.mock('../cellular/service.js',()=>({displayedAddresses:async(rows:unknown[])=>rows}));
import {playbackPoints} from './repository.js';
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`CREATE TABLE users(id text,owner_id text);INSERT INTO users VALUES('admin',null),('client','admin'),('other',null);
 CREATE TABLE vehicles(id text,owner_id text);INSERT INTO vehicles VALUES('bike','client');
 CREATE TABLE locations(id serial,vehicle_id text,device_id text,tracker_timestamp timestamptz,server_received_at timestamptz,latitude double precision,longitude double precision,speed real,course real,ignition boolean,gps_valid boolean,odometer real,position point,metadata jsonb,protocol text);
 CREATE FUNCTION ST_Distance(point,point) RETURNS double precision LANGUAGE SQL AS $$SELECT 6371000*2*asin(least(1,sqrt(power(sin(radians(($2[1]-$1[1])/2)),2)+cos(radians($1[1]))*cos(radians($2[1]))*power(sin(radians(($2[0]-$1[0])/2)),2))))$$;`);
},30000);
beforeEach(async()=>{await db.exec('TRUNCATE locations')});
afterAll(async()=>db?.close());
const from=new Date('2026-10-09T00:00:00Z'),to=new Date('2026-10-10T00:00:00Z');
async function add(minute:number,lat:number,lon=76,valid=true,device='a'){
 const time=new Date(+from+minute*60000);
 await db.query(`INSERT INTO locations(vehicle_id,device_id,tracker_timestamp,server_received_at,latitude,longitude,speed,gps_valid,position) VALUES('bike',$1,$2,$2,$3,$4,20,$5,point($4,$3))`,[device,time,lat,lon,valid]);
}
it('orders GPS time, excludes invalid fixes and rejects impossible jumps without replacing mileage',async()=>{
 await add(0,0,0);await add(2,28.001);await add(1,28);await add(3,50,100,false);await add(4,28.002);await add(5,50,100);await add(6,28.002);await add(7,28.003);
 const rows=(await playbackPoints('admin','bike',from,to,50000)).rows;
 expect(rows).toHaveLength(6);
 expect(new Date(rows[0].tracker_timestamp).getTime()).toBe(+from+60000);
 expect(Number(rows.at(-1)?.cumulative_distance_km)).toBeCloseTo(0.3336,3);
 expect((await playbackPoints('other','bike',from,to,50000)).rows).toHaveLength(0);
});
it('never measures a jump between different installed devices',async()=>{
 await add(0,28,76,true,'a');await add(1,29,77,true,'b');await add(2,28.001,76,true,'a');await add(3,29.001,77,true,'b');
 const rows=(await playbackPoints('client','bike',from,to,50000)).rows;
 expect(Number(rows.at(-1)?.cumulative_distance_km)).toBeCloseTo(0.2224,3);
});
