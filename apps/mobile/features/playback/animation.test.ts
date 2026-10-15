import {it,expect} from 'vitest';
import {animationTimeline,animationFrame} from './animation';
const fix=(seconds:number,latitude:number,speed=0)=>({latitude,longitude:76,speed,server_received_at:new Date(Date.UTC(2026,9,14)+seconds*1000).toISOString()});
it('compresses hours of waiting while preserving the original GPS timestamps',()=>{
 const points=[fix(0,28),fix(3600,28),fix(3610,28.0001,10)],before=JSON.stringify(points);
 expect(animationTimeline(points)).toEqual([0,2000,12000]);expect(JSON.stringify(points)).toBe(before);
 expect(animationFrame(points,animationTimeline(points),12000)?.index).toBe(2);
});
it('compresses a whole stationary run instead of waiting on thousands of stopped packets',()=>{
 const points=Array.from({length:1001},(_,index)=>fix(index*10,28));
 const timeline=animationTimeline(points);expect(timeline.at(-1)).toBeCloseTo(2000);
});
it('interpolates a plausible recorded segment and jumps across a long missing-data gap',()=>{
 const points=[fix(0,28,10),fix(10,28.0001,10),fix(3600,28.1,10)],timeline=animationTimeline(points);
 const moving=animationFrame(points,timeline,5000)!;expect(moving.latitude).toBeCloseTo(28.00005,6);expect(moving.index).toBe(0);expect(moving.heading).toBeCloseTo(0);
 const gap=animationFrame(points,timeline,11000)!;expect(gap.latitude).toBe(28.0001);
 expect(animationFrame(points,timeline,12000)?.latitude).toBe(28.1);
});
