import type { ProtocolDecoder } from '@fleet/protocol-types';
import type { DecodedMessage, NormalizedLocation } from '@fleet/shared-types';
import { bcdImei, coordinate } from './parser.js';
import { ack } from './acknowledgements.js';

/** W15 adapter. 0x26 is deliberately opaque until a verified specification is available. */
export class W15Decoder implements ProtocolDecoder {
  readonly protocol = 'W15';
  matches(frame: Buffer): boolean { return frame.length >= 10 && frame[0] === 0x78 && frame[1] === 0x78 && [0x01, 0x13, 0x22, 0x26].includes(frame[3]); }
  decode(frame: Buffer, receivedAt: Date): DecodedMessage {
    const type=frame[3]; const body=frame.subarray(4,frame.length-6); const serial=frame.readUInt16BE(frame.length-6);
    if(type===0x01) return {type:'login',imei:bcdImei(body.subarray(0,8)),acknowledgement:ack(type,serial)};
    if(type===0x13) return {type:'heartbeat',acknowledgement:ack(type,serial),metadata:{terminalInfo:body[0],voltageLevel:body[1]>>4,gsmSignal:body[1]&0x0f}};
    if(type===0x26) return {type:'additional',acknowledgement:ack(type,serial),metadata:{raw:body.toString('hex')}};
    if(type!==0x22||body.length<18) throw new Error('Invalid W15 location');
    const status=body.readUInt16BE(16); const date=new Date(Date.UTC(2000+body[0],body[1]-1,body[2],body[3],body[4],body[5]));
    const location:NormalizedLocation={deviceId:null,vehicleId:null,imei:'',protocol:this.protocol,trackerTimestamp:Number.isNaN(+date)?null:date,serverReceivedAt:receivedAt,latitude:coordinate(body.readUInt32BE(7))*(status&0x0400?1:-1),longitude:coordinate(body.readUInt32BE(11))*(status&0x0800?-1:1),speed:body[15],course:status&0x03ff,ignition:null,satellites:body[6]&0x0f,gpsValid:(status&0x1000)!==0,batteryPercent:null,batteryVoltage:null,gsmSignal:null,odometer:null,ac:null,door:null,relay:null,metadata:{mcc:body.length>=20?body.readUInt16BE(18):null,mnc:body.length>=21?body[20]:null,lac:body.length>=23?body.readUInt16BE(21):null,cellId:body.length>=26?body.readUIntBE(23,3):null}};
    return {type:'location',location,acknowledgement:ack(type,serial)};
  }
}
