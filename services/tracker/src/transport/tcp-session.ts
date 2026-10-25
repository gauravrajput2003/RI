import type {Socket} from 'node:net';
import type {Logger} from 'pino';
import type {NormalizedLocation} from '@fleet/shared-types';
import type {ProtocolRegistry} from '../protocols/protocol-registry.js';
import type {FramingRegistry} from '../protocols/framing/framing-registry.js';
import type {DeviceProtocolResolver} from '../services/device-protocol-resolver.js';
import type {RelayDispatcher} from '../services/relay-dispatcher.js';
import {gt06ProtocolOffset} from '../protocols/gt06/parser.js';
import {ConnectionManager} from './connection-manager.js';
import {immediateControlAck} from './control-ack.js';
import {heartbeatRelayInfo} from '../protocols/gt06/heartbeat.js';

interface Dependencies {
 registry:ProtocolRegistry;framing:FramingRegistry;resolver:DeviceProtocolResolver;
 commands:Pick<RelayDispatcher,'receive'|'bind'|'unbind'>&Partial<Pick<RelayDispatcher,'heartbeat'>>;logger:Pick<Logger,'info'|'warn'>;timeoutMs:number;
 persist(location:NormalizedLocation):Promise<{deviceId:string;vehicleId:string|null}|null>;
 heartbeat(identity:string,at:Date,metadata:Record<string,unknown>):Promise<unknown>;
 telemetry:{enqueue(location:NormalizedLocation):void};
 redactFrame?(frame:Buffer):string;
}
/** Framing/receipt ACKs never wait behind persistence or relay DB transactions. */
export function attachTrackerSocket(socket:Socket,deps:Dependencies){
 const {registry,framing,resolver,commands,logger}=deps;
 const manager=new ConnectionManager(),connection=manager.create(socket.remoteAddress??null);
 let pending=Promise.resolve(),closeReason='remote_close';
 socket.setTimeout(deps.timeoutMs);socket.setKeepAlive(true,30000);
 const fields=()=>({connectionId:connection.context.connectionId,imei:connection.context.identityValue});
 const rawHex=(frame:Buffer)=>deps.redactFrame?.(frame)??frame.toString('hex');
 logger.info({...fields(),remoteAddress:socket.remoteAddress,timeoutMs:deps.timeoutMs},'tracker socket opened');
 const writeAck=(data:Uint8Array)=>{const bytes=Buffer.from(data);if(socket.writable&&!socket.destroyed){socket.write(bytes);logger.info({...fields(),hex:bytes.toString('hex')},'tracker control ACK sent');}};
 socket.on('data',chunk=>{
  const receivedAt=new Date();manager.touch(connection);
  const bytes=connection.buffer.append(chunk),framer=framing.identify(bytes);
  if(!framer){logger.warn({...fields(),reason:'UNKNOWN_PROTOCOL',hex:rawHex(bytes.subarray(0,256))},'connection buffered');return;}
  connection.context.framingFamily=framer.name;
  const extracted=framer.extract(bytes);connection.buffer.clear();if(extracted.remainder.length)connection.buffer.append(extracted.remainder);
  for(const frame of extracted.frames){
   const ackStart=performance.now(),fastAck=immediateControlAck(registry,frame,socket,connection.context.protocol);
   let acknowledged=Boolean(fastAck);
   if(fastAck){const ackLatencyMs=performance.now()-ackStart;logger.info({...fields(),hex:fastAck.toString('hex'),packetType:frame[gt06ProtocolOffset(frame)],ackLatencyMs,receivedToAckMs:Date.now()-+receivedAt},'tracker control ACK sent');if(ackLatencyMs>1000||Date.now()-+receivedAt>1000)logger.warn({...fields(),ackLatencyMs},'tracker ACK latency above 1 second');}
   pending=pending.then(async()=>{
    if(socket.destroyed)return;
    try{
     if(await commands.receive(connection.context.connectionId,frame))return;
     let adapter=connection.context.protocol?registry.get(connection.context.protocol):registry.identify(frame);
     if(!adapter){
      const candidates=registry.candidates(frame);
      if(candidates.length<=1){logger.warn({...fields(),reason:'UNKNOWN_PROTOCOL',hex:rawHex(frame)},'frame quarantined');return;}
      const logins=candidates.map(candidate=>{try{return candidate.decode(frame,receivedAt);}catch{return null;}}).filter(message=>message?.type==='login'&&Boolean(message.imei));
      const identity=logins[0]?.imei;
      if(!identity||logins.some(message=>message?.imei!==identity)){logger.warn({...fields(),reason:'AMBIGUOUS_PROTOCOL',hex:rawHex(frame)},'frame quarantined');return;}
      const registered=await resolver.find('IMEI',identity);
      if(!registered){logger.warn({...fields(),reason:'UNKNOWN_DEVICE',identityType:'IMEI',identityValue:identity,hex:rawHex(frame)},'frame quarantined');return;}
      adapter=registry.get(registered.protocol);
      if(!adapter){logger.warn({...fields(),reason:'UNSUPPORTED_CONFIGURED_PROTOCOL',hex:rawHex(frame)},'frame quarantined');return;}
      connection.context={...connection.context,protocol:registered.protocol,deviceId:registered.id,identityType:registered.identityType,identityValue:registered.identityValue};
     }
     const message=adapter.decode(frame,receivedAt);
     const relayInfo=adapter.protocol==='GT06'?heartbeatRelayInfo(frame):null;
     if(relayInfo)logger.info({...fields(),...relayInfo},'tracker heartbeat terminal information');
     if(message.type==='login'&&message.imei){
      if(connection.context.identityValue&&connection.context.identityValue!==message.imei)throw new Error('Identity changed within an authenticated tracker connection');
      const registered=await resolver.find('IMEI',message.imei);
      if(!registered||registered.protocol!==adapter.protocol)throw new Error('Device registration does not match login');
      connection.context={...connection.context,protocol:registered.protocol,deviceId:registered.id,identityType:registered.identityType,identityValue:registered.identityValue};
      // Registration lookup establishes the protocol; relay DB work cannot hold up login ACK.
      if(!acknowledged&&message.acknowledgement){writeAck(message.acknowledgement);acknowledged=true;}
      await commands.bind(registered.id,connection.context.connectionId,registered.protocol,socket,registered.identityValue);
     }
     logger.info({...fields(),protocol:adapter.protocol,packetType:message.type,receivedAt:receivedAt.toISOString(),ignition:message.metadata?.ignition,gpsPositioned:message.metadata?.gpsPositioned},'tracker packet received');
     const controlAck=message.type==='login'||message.type==='heartbeat';
     if(controlAck&&!acknowledged&&message.acknowledgement)writeAck(message.acknowledgement);
     if(message.imei){connection.context.identityType='IMEI';connection.context.identityValue=message.imei;}
     if(message.location){
      const processingStartedAt=Date.now();message.location.imei=connection.context.identityValue??'';
      const saved=await deps.persist(message.location);
      if(saved){message.location.deviceId=saved.deviceId;message.location.vehicleId=saved.vehicleId;deps.telemetry.enqueue(message.location);
       logger.info({connectionId:connection.context.connectionId,deviceId:saved.deviceId,protocol:adapter.protocol,packetType:frame[3],packetSerial:frame.readUInt16BE(frame.length-6),gpsTime:message.location.trackerTimestamp?.toISOString()??null,gpsTimestampBytes:adapter.protocol==='GT06'?frame.subarray(4,10).toString('hex'):undefined,gpsTimestampCorrection:message.location.metadata.gpsTimestampCorrection,receivedAt:receivedAt.toISOString(),gpsAgeSeconds:message.location.trackerTimestamp?Math.round((+receivedAt-+message.location.trackerTimestamp)/1000):null,queuedMs:processingStartedAt-+receivedAt,persistMs:Date.now()-processingStartedAt},'location persisted');}
     }else if(connection.context.identityValue){await deps.heartbeat(connection.context.identityValue,new Date(),message.metadata??{});if(relayInfo)await commands.heartbeat?.(connection.context.connectionId,frame,receivedAt);}
     // Client PDF: no 0x12 position ACK. Alarm 0x16 ACK already went out before DB.
     if(!controlAck&&!acknowledged&&message.acknowledgement&&!(adapter.protocol==='GT06'&&[0x12,0x18,0x94].includes(frame[gt06ProtocolOffset(frame)])))writeAck(message.acknowledgement);
    }catch(error){logger.warn({err:error,...fields(),packetType:frame[gt06ProtocolOffset(frame)],hex:rawHex(frame)},'tracker frame rejected');}
   }).catch(error=>logger.warn({err:error,...fields()},'tracker connection processing failed'));
  }
 });
 socket.on('end',()=>{closeReason='remote_end';logger.info(fields(),'tracker socket ended by peer');});
 socket.on('error',error=>{closeReason='socket_error';logger.warn({err:error,...fields()},'tracker socket error');});
 socket.on('timeout',()=>{closeReason='idle_timeout';logger.warn({...fields(),timeoutMs:deps.timeoutMs},'tracker socket idle timeout');socket.destroy();});
 socket.on('close',hadError=>{logger.info({...fields(),reason:closeReason,hadError,bytesRead:socket.bytesRead,bytesWritten:socket.bytesWritten},'tracker socket closed');void commands.unbind(connection.context.connectionId,socket).catch(error=>logger.warn({err:error,...fields()},'relay connection cleanup failed'));});
 return connection;
}
