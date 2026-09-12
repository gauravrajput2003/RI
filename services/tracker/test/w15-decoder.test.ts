import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { W15Decoder } from '../src/protocols/w15/decoder.js';
const frame=(name:string)=>Buffer.from(readFileSync(new URL(`./fixtures/w15/${name}.hex`,import.meta.url),'utf8').trim(),'hex'); const decoder=new W15Decoder();
describe('W15 real captures',()=>{
  it('decodes dynamic login identity',()=>expect(decoder.decode(frame('login'),new Date()).imei).toBe('861128069170790'));
  it('decodes verified heartbeat fields',()=>expect(decoder.decode(frame('heartbeat'),new Date()).metadata?.terminalInfo).toBe(0x43));
  it('normalizes verified locations without inventing values',()=>{for(const name of ['location-1','location-2']){const l=decoder.decode(frame(name),new Date()).location!;expect(l.gpsValid).toBe(true);expect(l.ignition).toBeNull();expect(l.batteryPercent).toBeNull();expect(l.latitude).toBeGreaterThan(28);expect(l.longitude).toBeGreaterThan(76)}});
  it('retains 0x26 as opaque data',()=>expect(decoder.decode(frame('additional-1'),new Date()).type).toBe('additional'));
});
