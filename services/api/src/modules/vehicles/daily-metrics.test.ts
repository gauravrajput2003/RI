import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {dailyMetricsSql} from './daily-metrics.js';
let db:PGlite;
const checkedAt='2026-10-09T01:00:00Z';
const at=(minute:number)=>new Date(Date.parse('2026-10-08T19:00:00Z')+minute*60000).toISOString();
async function add(time:string,lat:number,lon:number,valid=true,device='a',speed=20){
  await db.query('INSERT INTO locations(vehicle_id,device_id,tracker_timestamp,server_received_at,latitude,longitude,gps_valid,position,speed) VALUES($1,$2,$3,$3,$4,$5,$6,point($5,$4),$7)',['v',device,time,lat,lon,valid,speed]);
}
async function km(){
  const sql=dailyMetricsSql.replaceAll('now()',`'${checkedAt}'::timestamptz`).replaceAll('$3','5');
  const r=await db.query<{today_distance_km:number}>(`SELECT metrics.* FROM vehicles v LEFT JOIN LATERAL (${sql}) metrics ON true`);
  return Number(r.rows[0].today_distance_km);
}
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE TABLE vehicles(id text);INSERT INTO vehicles VALUES('v');
    CREATE TABLE locations(id serial,vehicle_id text,device_id text,tracker_timestamp timestamptz,server_received_at timestamptz,latitude double precision,longitude double precision,gps_valid boolean,position point,speed real,ignition boolean);
    CREATE FUNCTION ST_Distance(point,point) RETURNS double precision LANGUAGE SQL AS $$
      SELECT 6371000*2*asin(least(1,sqrt(power(sin(radians(($2[1]-$1[1])/2)),2)+cos(radians($1[1]))*cos(radians($2[1]))*power(sin(radians(($2[0]-$1[0])/2)),2))))
    $$;`);
},30000);
beforeEach(async()=>{await db.exec('TRUNCATE locations')});
afterAll(async()=>db?.close());
describe('today distance from trustworthy GPS fixes',()=>{
  it('excludes the 0,0 → Rohtak jump without losing real movement',async()=>{
    await add(at(0),0,0);await add(at(1),28.8678,76.5943);await add(at(2),28.8688,76.5943);
    expect(await km()).toBeCloseTo(0.1112,3);
  });
  it('rejects explicitly invalid fixes and implausible teleports',async()=>{
    await add(at(0),28.8678,76.5943);await add(at(1),50,100,false);await add(at(2),28.8688,76.5943);
    await add(at(3),50,100);await add(at(4),28.8688,76.5943);await add(at(5),28.8698,76.5943);
    expect(await km()).toBeCloseTo(0.2224,3);
  });
  it('never joins different devices and ignores equal-time jumps',async()=>{
    await add(at(0),28,76,true,'a');await add(at(1),29,77,true,'b');
    await add(at(2),28.001,76,true,'a');await add(at(3),29.001,77,true,'b');
    expect(await km()).toBeCloseTo(0.2224,3);
    await add(at(3),50,100,true,'b');expect(await km()).toBeCloseTo(0.2224,3);
  });
  it('uses India midnight, rather than database UTC midnight',async()=>{
    await add('2026-10-08T18:29:59Z',28,76);await add('2026-10-08T18:30:00Z',29,76);
    await add('2026-10-08T18:31:00Z',29.001,76);expect(await km()).toBeCloseTo(0.1112,3);
  });
  it('does not accumulate small stationary jitter or invent mileage without fixes',async()=>{
    expect(await km()).toBe(0);
    await add(at(0),28.8678,76.5943,true,'a',0);await add(at(1),28.86782,76.5943,true,'a',0);
    expect(await km()).toBe(0);
  });
});
