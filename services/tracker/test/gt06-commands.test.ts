import {expect,it} from 'vitest';
import {encodeRelay,decodeCommandReply,relayReplyResult} from '../src/protocols/gt06/commands.js';
import {validGt06Frame,crc16X25} from '../src/protocols/gt06/parser.js';

it('frames the documented commands with flag, English language, serial and CRC',()=>{
 for(const [action,text] of [['lock','DYD#'],['unlock','HFYD#']] as const){const frame=encodeRelay(action,0x1234abcd);expect(validGt06Frame(frame)).toBe(true);expect(frame[3]).toBe(0x80);expect(frame.readUInt32BE(5)).toBe(0x1234abcd);expect(frame.subarray(9,9+text.length).toString()).toBe(text);expect(frame.readUInt16BE(frame.length-8)).toBe(2);expect(frame.readUInt16BE(frame.length-6)).toBe(0xabcd);}
 expect(()=>encodeRelay('lock',0)).toThrow();
});
it('matches the manufacturer appendix password-command capture byte for byte, including CRC',()=>{
 // Concox v1.8.1 p37: this legacy firmware capture OMITS the language field.
 expect(encodeRelay('lock',0x0001a958,{text:'DYD,000000#',serial:0x00a0,languageField:false}).toString('hex')).toBe('787815800f0001a9584459442c3030303030302300a0dcf10d0a');
});
it('matches a fixed English-language 0x80 vector and independent X25 check values',()=>{
 expect(crc16X25(Buffer.from('123456789'))).toBe(0x906e);
 expect(encodeRelay('lock',1).toString('hex')).toBe('7878108008000000014459442300020001f3ea0d0a');
});
export function response21(flag:number,text:string,extended=true,encoding=2){
 const content=encoding===2?Buffer.from(text,'utf16le').swap16():Buffer.from(text,'ascii');
 const body=Buffer.alloc(5+content.length);body.writeUInt32BE(flag);body[4]=encoding;content.copy(body,5);
 const length=body.length+5,payload=Buffer.from(extended?[length>>8,length&255,0x21,...body,0,77]:[length,0x21,...body,0,77]),crc=crc16X25(payload);
 return Buffer.from([extended?0x79:0x78,extended?0x79:0x78,...payload,crc>>8,crc&255,13,10]);
}
it('decodes short and extended 0x21 ASCII/UTF-16BE replies and rejects damaged frames',()=>{
 for(const extended of [false,true])for(const encoding of [1,2])expect(decodeCommandReply(response21(123,'HFYD=Success!',extended,encoding))).toMatchObject({serverFlag:123,text:'HFYD=Success!'});
 expect(decodeCommandReply(response21(123,'车辆恢复',true,2))?.text).toBe('车辆恢复');
 const broken=response21(1,'OK');broken[10]^=1;expect(()=>decodeCommandReply(broken)).toThrow('CRC');
 expect(()=>decodeCommandReply(response21(1,'OK',true,9))).toThrow('encoding');
});
it('parses the manufacturer appendix HFYD success example without confusing serial and server flag',()=>{
 const frame=Buffer.from('78781915110001a963484659443d53756363657373210002001ef8930d0a','hex');
 expect(decodeCommandReply(frame)).toMatchObject({serverFlag:0x1a963,text:'HFYD=Success!'});
 expect(relayReplyResult('unlock','HFYD=Success!')).toBe('succeeded');expect(relayReplyResult('lock','HFYD=Success!')).toBeNull();
 expect(relayReplyResult('lock','DYD=Speed Limit, Speed 40km/h')).toBe('failed');
 expect(relayReplyResult('lock','OK')).toBeNull();expect(relayReplyResult('lock','DYD=Success! Fail')).toBe('failed');
});
it('parses both client-PDF DYD success vectors with language, echoed flag and independent serial',()=>{
 for(const [serial,crc] of [[0x18,'9177'],[0x0a,'a2e4']] as const){
  const frame=Buffer.from(`78781815100001a9584459443d53756363657373210002${serial.toString(16).padStart(4,'0')}${crc}0d0a`,'hex');
  expect(validGt06Frame(frame)).toBe(true);expect(decodeCommandReply(frame)).toEqual({serverFlag:0x1a958,text:'DYD=Success!',language:2,serial});
 }
 for(const message of ['DYD=Unvalued Fix!','DYD=Speed Limit, Speed 40km/h'])expect(relayReplyResult('lock',message)).toBe('failed');
 expect(relayReplyResult('unlock','HFYD=Fail!')).toBe('failed');
});
it('rejects damaged CRC, length mismatches and non-command frames',()=>{
 const frame=Buffer.from('78781915110001a963484659443d53756363657373210002001ef8930d0a','hex');
 const corrupt=Buffer.from(frame);corrupt[10]^=1;expect(()=>decodeCommandReply(corrupt)).toThrow();
 const malformed=Buffer.from(frame);malformed[4]--;malformed.writeUInt16BE(crc16X25(malformed.subarray(2,-4)),malformed.length-4);expect(()=>decodeCommandReply(malformed)).toThrow(/length/);
 expect(decodeCommandReply(encodeRelay('lock',1))).toBeNull();
});
