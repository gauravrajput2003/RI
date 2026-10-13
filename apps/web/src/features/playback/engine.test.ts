import {describe,expect,it} from 'vitest';import {normalizePoints,playbackIndex,pointTime,routeStops,routeFrame} from './engine';import type {PlaybackPoint} from '../../types';
const point=(id:string,time:string,latitude:number|null=28):PlaybackPoint=>({id,tracker_timestamp:time,server_received_at:time,latitude,longitude:76,speed:20,course:0,ignition:true,gps_valid:true,odometer:null});
describe('deterministic playback timeline',()=>{const raw=[point('c','2026-09-16T10:00:20Z'),point('a','2026-09-16T10:00:00Z'),point('b','2026-09-16T10:00:10Z')];it('normalizes points chronologically without inventing data',()=>{expect(normalizePoints(raw).map(p=>p.id)).toEqual(['a','b','c']);expect(raw.map(p=>p.id)).toEqual(['c','a','b'])});it('derives one current index from the shared time position',()=>{const points=normalizePoints(raw);expect(playbackIndex(points,pointTime(points[0]))).toBe(0);expect(playbackIndex(points,new Date('2026-09-16T10:00:15Z').getTime())).toBe(1);expect(playbackIndex(points,pointTime(points[2]))).toBe(2)})});

it('does not animate invalid GPS or out-of-range coordinates',()=>{
  expect(normalizePoints([{...point('bad','2026-09-16T10:00:00Z'),gps_valid:false},point('outside','2026-09-16T10:00:00Z',100),point('missing','2026-09-16T10:00:00Z',null)])).toEqual([]);
});

it('animates between recorded positions and compresses stationary time gaps without altering GPS values',()=>{
 const points=[point('a','2026-09-16T10:00:00Z',28),point('stop','2026-09-16T12:00:00Z',28),point('b','2026-09-16T12:00:20Z',28.01)];
 const stops=routeStops(points);expect(stops).toEqual([0,2]);
 expect(routeFrame(points,stops,.5).position?.latitude).toBeCloseTo(28.005);
 expect(routeFrame(points,stops,1).index).toBe(2);
 expect(points[0].latitude).toBe(28);expect(points[0].speed).toBe(20);
});
it('keeps a genuinely stationary route stationary',()=>{
 const points=[point('a','2026-09-16T10:00:00Z'),point('b','2026-09-16T12:00:00Z')];
 expect(routeStops(points)).toEqual([0]);
});
