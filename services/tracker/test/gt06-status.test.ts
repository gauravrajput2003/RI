import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {Gt06Decoder} from '../src/protocols/gt06/decoder.js';
import {crc16X25} from '../src/protocols/gt06/parser.js';
const decoder=new Gt06Decoder();
const fixture=(name:string)=>Buffer.from(readFileSync(new URL(`./fixtures/gt06/${name}.hex`,import.meta.url),'utf8').trim(),'hex');
function packet(type:number,body:Buffer) {
  const frame=Buffer.concat([Buffer.from([0x78,0x78,body.length+5,type]),body,Buffer.from([0,1,0,0,0x0d,0x0a])]);
  frame.writeUInt16BE(crc16X25(frame.subarray(2,-4)),frame.length-4);return frame;
}
describe('GT06 v1.8.1 status fields',()=>{
  it('uses ACC bit 1 independently of charging/GPS bits',()=>{
    for(const [terminal,ignition] of [[0x44,false],[0x46,true],[0x02,true],[0x40,false]] as const) {
      const decoded=decoder.decode(packet(0x13,Buffer.from([terminal,6,4,0,2])),new Date());
      expect(decoded.metadata?.ignition).toBe(ignition);
    }
  });
  it('reads GPS validity from course/status bit 12, not the GPS length nibble',()=>{
    const body=fixture('location').subarray(4,-6);body[6]=0xc6;body.writeUInt16BE(0x04a6,16);
    expect(decoder.decode(packet(0x12,body),new Date()).location?.gpsValid).toBe(false);
    body[6]=0x06;body.writeUInt16BE(0x14a6,16);
    expect(decoder.decode(packet(0x12,body),new Date()).location?.gpsValid).toBe(true);
  });
  it('decodes ACC in the combined 0x16 alarm packet without inventing it for 0x12',()=>{
    const gps=fixture('location').subarray(4,22);
    const body=Buffer.concat([gps,Buffer.from([9,1,0xcc,0,0,1,0,0,1,0x46,6,4,0,2])]);
    expect(body.length).toBe(32);
    const decoded=decoder.decode(packet(0x16,body),new Date());
    expect(decoded.location?.ignition).toBe(true);expect(decoded.acknowledgement?.[3]).toBe(0x16);
    expect(decoder.decode(fixture('location'),new Date()).location?.ignition).toBeNull();
  });
  it('rejects a heartbeat without its terminal status fields',()=>{
    expect(()=>decoder.decode(packet(0x13,Buffer.alloc(0)),new Date())).toThrow('Truncated');
  });
});
