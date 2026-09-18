import {describe,expect,it} from 'vitest';
import {acSessions,haversineKm,localDateKey,summarize,type HistoryPoint} from './calculations.js';
const point=(id:string,time:string,values:Partial<HistoryPoint>={}):HistoryPoint=>({id,vehicle_id:'vehicle',tracker_timestamp:time,server_received_at:time,latitude:28.6,longitude:77.2,speed:0,ignition:false,gps_valid:true,ac:null,...values});
describe('report calculations',()=>{
 it('calculates route distance only from valid recorded positions',()=>{const a=point('a','2026-09-01T00:00:00Z'),b=point('b','2026-09-01T00:01:00Z',{latitude:28.61});expect(haversineKm(a,b)).toBeGreaterThan(1);expect(haversineKm(a,{...b,gps_valid:false})).toBe(0)});
 it('uses canonical motion and offline thresholds for durations and counts',()=>{const result=summarize([point('a','2026-09-01T00:00:00Z',{speed:20,ignition:true}),point('b','2026-09-01T00:01:00Z',{speed:0,ignition:true}),point('c','2026-09-01T00:03:00Z',{speed:0,ignition:false}),point('d','2026-09-01T00:04:00Z')],5,90);expect(result).toMatchObject({runningSeconds:60,idleSeconds:90,unreachableSeconds:30,stopSeconds:60,tripCount:1,idleCount:1,stopCount:1,unreachableCount:1,maxSpeed:20})});
 it('carries AC on state across a report boundary and closes sessions',()=>{const sessions=acSessions([point('before','2026-08-31T23:50:00Z',{ac:true}),point('off','2026-09-01T00:10:00Z',{ac:false})],new Date('2026-09-01T00:00:00Z'),new Date('2026-09-02T00:00:00Z'));expect(sessions).toHaveLength(1);expect(sessions[0]).toMatchObject({startTime:'2026-09-01T00:00:00.000Z',durationSeconds:600})});
 it('uses the requested IANA time zone for calendar grouping',()=>{expect(localDateKey(new Date('2026-09-01T20:00:00Z'),'Asia/Kolkata')).toBe('2026-09-02')});
});
