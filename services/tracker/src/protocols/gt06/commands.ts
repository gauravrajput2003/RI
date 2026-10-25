import type {RelayAction} from '@fleet/shared-types';
import {crc16X25,validGt06CommandFrame,gt06ProtocolOffset} from './parser.js';

/** Concox GT06 v1.8.1 §§6.1–6.5. No passwords or arbitrary command input. */
export function encodeRelay(action:RelayAction,serverFlag:number,options:{text?:string;serial?:number;languageField?:boolean}={}){
 if(!Number.isInteger(serverFlag)||serverFlag<1||serverFlag>0xffffffff)throw new Error('Invalid command correlation flag');
 const content=options.text??(action==='lock'?'DYD#':'HFYD#');
 if(!/^[\x20-\x7e]{1,240}#$/.test(content))throw new Error('Relay command must be bounded printable ASCII ending in #');
 const text=Buffer.from(content,'ascii');
 const body=Buffer.alloc(1+4+text.length+(options.languageField===false?0:2));body[0]=4+text.length;body.writeUInt32BE(serverFlag,1);text.copy(body,5);if(options.languageField!==false)body.writeUInt16BE(2,body.length-2);
 const serial=options.serial??(serverFlag&0xffff);if(!Number.isInteger(serial)||serial<0||serial>65535)throw new Error('Invalid command serial');
 const payload=Buffer.alloc(2+body.length+2);payload[0]=payload.length+1;payload[1]=0x80;body.copy(payload,2);payload.writeUInt16BE(serial,payload.length-2);
 const checksum=crc16X25(payload);return Buffer.from([0x78,0x78,...payload,checksum>>8,checksum&255,0x0d,0x0a]);
}
export function decodeCommandReply(frame:Buffer){
 const offset=gt06ProtocolOffset(frame),type=frame[offset];
 if(type!==0x15&&type!==0x21)return null;
 if(!validGt06CommandFrame(frame))throw new Error('Invalid GT06 command reply CRC or frame');
 const body=frame.subarray(offset+1,-6);
 if(type===0x21){
  if(body.length<5)throw new Error('Truncated GT06 0x21 reply');
  const encoding=body[4],content=body.subarray(5);
  if(encoding!==1&&encoding!==2)throw new Error('Unsupported GT06 reply encoding');
  if(encoding===2&&content.length%2)throw new Error('Invalid UTF-16 reply length');
  const text=encoding===1?content.toString('ascii'):Buffer.from(content).swap16().toString('utf16le');
  return {serverFlag:body.readUInt32BE(0),text:text.replace(/\0+$/,'').trim(),language:null,serial:frame.readUInt16BE(frame.length-6)};
 }
 const length=body[0];
 if(length<5||body.length!==length+3)throw new Error('Invalid GT06 command reply length');
 const language=body.readUInt16BE(body.length-2);if(language!==1&&language!==2)throw new Error('Unsupported reply language');
 return {serverFlag:body.readUInt32BE(1),text:body.subarray(5,1+length).toString('ascii').replace(/\0+$/,'').trim(),language,serial:frame.readUInt16BE(frame.length-6)};
}
export function relayReplyResult(action:RelayAction,text:string):'succeeded'|'failed'|null{
 const command=action==='lock'?'DYD':'HFYD';
 if(text.toUpperCase()===`${command}=SUCCESS!`)return 'succeeded';
 return text.toUpperCase().startsWith(`${command}=`)?'failed':null;
}
