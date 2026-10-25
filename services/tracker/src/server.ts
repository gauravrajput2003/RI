import net from 'node:net';
import {env,relayModels} from './config/env.js';
import {logger} from './logger.js';
import {protocolRegistry} from './protocols/registry.js';
import {framingRegistry} from './protocols/framing/framing-registry.js';
import {deviceProtocolResolver} from './db/device-protocol-resolver.js';
import {markHeartbeat,persist,pool} from './db/repository.js';
import {HttpTelemetryBoundary} from './services/http-telemetry-boundary.js';
import {LiveTelemetryQueue} from './services/live-telemetry-queue.js';
import {RelayDispatcher} from './services/relay-dispatcher.js';
import {attachTrackerSocket} from './transport/tcp-session.js';
import {redactRelayReply} from './services/relay-models.js';

const commands=new RelayDispatcher(pool,error=>logger.warn({err:error},'relay dispatcher unavailable'),(fields,message)=>fields.warning?logger.warn(fields,message):logger.info(fields,message),relayModels,env.INTERNAL_TRACKER_SECRET);
const relayTimer=setInterval(()=>void commands.tick(),1000);relayTimer.unref();
const telemetry=new LiveTelemetryQueue(new HttpTelemetryBoundary(env.INTERNAL_API_URL,env.INTERNAL_TRACKER_SECRET),(error,location)=>logger.warn({err:error,deviceId:location.deviceId},'realtime delivery failed; location remains saved'),location=>logger.warn({deviceId:location.deviceId},'live delivery queue full; oldest saved update skipped'));
const sockets=new Set<net.Socket>();
const server=net.createServer(socket=>{
 sockets.add(socket);socket.once('close',()=>sockets.delete(socket));
 attachTrackerSocket(socket,{registry:protocolRegistry,framing:framingRegistry,resolver:deviceProtocolResolver,commands,logger,timeoutMs:env.TRACKER_SOCKET_TIMEOUT_MS,persist,heartbeat:markHeartbeat,telemetry,redactFrame:frame=>redactRelayReply(relayModels,'',frame.toString('hex')).hex});
});
server.on('error',error=>{logger.error({err:error,port:env.TCP_PORT},'tracker server listen failed');clearInterval(relayTimer);void pool.end().finally(()=>process.exit(1));});
server.listen(env.TCP_PORT,()=>logger.info({port:env.TCP_PORT},'tracker listening'));
let stopping=false;
const stop=()=>{if(stopping)return;stopping=true;clearInterval(relayTimer);logger.info('tracker shutting down');for(const socket of sockets)socket.destroy();server.close(()=>pool.end().finally(()=>process.exit(0)));};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
