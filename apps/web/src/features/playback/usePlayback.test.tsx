import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {usePlayback} from './usePlayback';
import type {PlaybackPoint} from '../../types';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});
it('advances, pauses and replays actual GPS recordings after reaching the end',()=>{
 let tick:FrameRequestCallback=()=>{};
 vi.stubGlobal('requestAnimationFrame',vi.fn((callback:FrameRequestCallback)=>{tick=callback;return 1}));
 vi.stubGlobal('cancelAnimationFrame',vi.fn());
 vi.spyOn(performance,'now').mockReturnValue(0);
 const points:PlaybackPoint[]=[0,10,20].map((seconds)=>({id:String(seconds),tracker_timestamp:new Date(Date.parse('2026-10-09T00:00:00Z')+seconds*1000).toISOString(),server_received_at:'2026-10-09T00:00:00Z',latitude:28,longitude:76,speed:0,course:0,ignition:true,gps_valid:true,odometer:null}));
 const {result}=renderHook(()=>usePlayback(points));
 act(()=>result.current.toggle());
 act(()=>tick(200));expect(result.current.index).toBe(1);
 act(()=>result.current.toggle());expect(result.current.playing).toBe(false);
 act(()=>result.current.toggle());act(()=>tick(400));
 expect(result.current.index).toBe(2);expect(result.current.playing).toBe(false);
 act(()=>result.current.toggle());expect(result.current.index).toBe(0);expect(result.current.playing).toBe(true);
});
