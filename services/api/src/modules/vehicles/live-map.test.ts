import {it,expect} from 'vitest';
import {livePath} from './live-map.js';
import type {MobilePoint} from '../reports/mobile-calculations.js';
const p=(id:string,latitude:number,extra:Partial<MobilePoint>={}):MobilePoint=>({id,vehicle_id:'fixture-vehicle',device_id:'fixture-device',tracker_timestamp:'2026-10-01T00:00:00Z',server_received_at:'2026-10-01T00:00:00Z',latitude,longitude:76,gps_valid:true,ignition:null,ac:null,speed:20,has_distance_pair:true,segment_distance_km:.1,...extra});
it('uses only recorded connected coordinates and breaks rejected jumps, invalid GPS and device switches',()=>{
 const result=livePath([p('a',28,{has_distance_pair:false}),p('b',28.001),p('c',29,{segment_distance_km:0}),p('d',29.001),p('e',29.002,{gps_valid:false}),p('f',30),p('g',30.001),p('h',30.001,{device_id:'replacement'}),p('i',30.002,{device_id:'replacement'})]);
 expect(result).toEqual([[{latitude:28,longitude:76},{latitude:28.001,longitude:76}],[{latitude:29,longitude:76},{latitude:29.001,longitude:76}],[{latitude:30,longitude:76},{latitude:30.001,longitude:76}],[{latitude:30.001,longitude:76},{latitude:30.002,longitude:76}]]);
});
it('never creates a path from no history, a single fix or zero-coordinate placeholders',()=>{expect(livePath([])).toEqual([]);expect(livePath([p('a',28)])).toEqual([]);expect(livePath([p('a',0,{longitude:0}),p('b',28)])).toEqual([])});
