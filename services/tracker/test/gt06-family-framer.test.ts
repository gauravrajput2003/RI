import {describe,it,expect}from 'vitest';import {gt06FamilyFramer}from '../src/protocols/framing/gt06-family-framer.js';
const frame=Buffer.from('78780A1345060400010020FDEE0D0A','hex');describe('GT-family framer',()=>{it('retains a partial frame until complete',()=>{expect(gt06FamilyFramer.extract(frame.subarray(0,5))).toEqual({frames:[],remainder:frame.subarray(0,5)});expect(gt06FamilyFramer.extract(frame)).toEqual({frames:[frame],remainder:Buffer.alloc(0)})});it('extracts coalesced frames and drops malformed header safely',()=>{const output=gt06FamilyFramer.extract(Buffer.concat([frame,frame,Buffer.from([0x78,0x78,0x04])]));expect(output.frames).toEqual([frame,frame]);expect(output.remainder).toEqual(Buffer.from([0x04]))})});
it('retains split 7979 headers and extracts mixed short/extended command reply frames',()=>{
 const extended=Buffer.from('7979000b21000000010141000100000d0a','hex');
 expect(gt06FamilyFramer.extract(extended.subarray(0,3))).toEqual({frames:[],remainder:extended.subarray(0,3)});
 expect(gt06FamilyFramer.extract(Buffer.concat([frame,extended,frame])).frames).toEqual([frame,extended,frame]);
});
