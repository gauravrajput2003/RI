import type {Socket} from 'node:net';
import type {ProtocolRegistry} from '../protocols/protocol-registry.js';
import {ack} from '../protocols/gt06/acknowledgements.js';
import {crc16X25,gt06ProtocolOffset,validGt06CommandFrame,validGt06Frame} from '../protocols/gt06/parser.js';
/** A receipt ACK grants no device access. Validate CRC/decode and require adapter agreement.
 * Run before any DB queue so slow persistence cannot cause heartbeat/login ACK timeouts. */
export function immediateControlAck(registry:ProtocolRegistry,frame:Buffer,socket:Socket,protocol?:string|null){
 if(socket.destroyed||!socket.writable)return null;
 const type=frame[gt06ProtocolOffset(frame)];
 // The client PDF explicitly requires receipt ACKs even for unregistered IMEIs.
 // This validates the wire frame, grants no identity/assignment/command access,
 // and deliberately runs before ANY resolver/database work.
 if(protocol!=='W15'&&validGt06Frame(frame)&&[1,0x13,0x16].includes(type)){
  const bytes=ack(type,frame.readUInt16BE(frame.length-6));socket.write(bytes);return bytes;
 }
 if(protocol!=='W15'&&type===0x8d&&frame[0]===0x79&&validGt06CommandFrame(frame)&&frame.length>=20){
  const payload=Buffer.from([0,6,0x8d,0,frame[frame.length-6],frame[frame.length-5]]),crc=crc16X25(payload);
  const bytes=Buffer.from([0x79,0x79,...payload,crc>>8,crc&255,13,10]);socket.write(bytes);return bytes;
 }
 if(type!==1&&type!==0x13)return null;
 const configured=protocol?registry.get(protocol):undefined;
 const candidates=configured?[configured]:registry.candidates(frame);if(!candidates.length)return null;
 const messages=candidates.map(adapter=>{try{return adapter.decode(frame,new Date());}catch{return null;}});
 if(messages.some(message=>!message||!['login','heartbeat'].includes(message.type)||!message.acknowledgement))return null;
 const bytes=Buffer.from(messages[0]!.acknowledgement!);
 if(messages.some(message=>!Buffer.from(message!.acknowledgement!).equals(bytes)))return null;
 if(socket.destroyed||!socket.writable)return null;
 socket.write(bytes);return bytes;
}
