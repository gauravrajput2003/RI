import {processParkingModes} from './modules/parking/service.js';
import {withParkingDelivery} from './modules/parking/delivery.js';
import {publishVehicleParking} from './realtime/socket-server.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { configureSockets } from './realtime/socket-server.js';
import { vehicleAuthorizer } from './realtime/vehicle-authorizer.js';
import { publishVehicleLocation,publishVehicleNotification,publishUserNotification } from './realtime/socket-server.js';
import { publishedVehicleActivity } from './modules/vehicles/repository.js';
import {processVehicleTelemetry,processUnreachableVehicles,type TelemetryAlertInput} from './modules/alerts/engine.js';
import {processSubscriptionAlerts} from './modules/alerts/subscriptions.js';
import {displayedAddresses} from './modules/cellular/service.js';
import {collectTransitions,flushPushOutbox} from './modules/mobile-push/service.js';

const server=createServer(app); export const io=new Server(server,{cors:{origin:env.CORS_ORIGINS.split(',')}});
configureSockets(io,vehicleAuthorizer);
app.locals.publishVehicleLocation=async(vehicleId:string,payload:Record<string,unknown>)=>{
  const activity=(await publishedVehicleActivity(vehicleId)).rows[0];
  if(activity){const combined:Record<string,unknown>={...payload,...activity,ignition:payload.ignition??(activity as typeof activity & {current_ignition?:boolean|null}).current_ignition??null,fleet_status:activity.state==='MOVING'?'RUNNING':activity.state};const published=env.ADDRESS_SOURCE==='cell'?(await displayedAddresses([combined]))[0]:combined;await publishVehicleLocation(io,vehicleId,published);for(const notification of await processVehicleTelemetry(vehicleId,combined as TelemetryAlertInput))await publishVehicleNotification(io,vehicleId,notification as unknown as Record<string,unknown>)}
};
app.locals.publishParkingState=(vehicleId:string,payload:Record<string,unknown>)=>publishVehicleParking(io,vehicleId,payload);
const unreachableSweep=setInterval(()=>{void processUnreachableVehicles().then(async notifications=>{for(const notification of notifications)await publishVehicleNotification(io,notification.vehicleId,notification as unknown as Record<string,unknown>)}).catch(error=>logger.error({err:error},'unreachable alert sweep failed'))},60_000);unreachableSweep.unref();
const subscriptionSweep=setInterval(()=>{void processSubscriptionAlerts().then(async notifications=>{for(const notification of notifications)await publishUserNotification(io,notification.recipientUserId,notification as unknown as Record<string,unknown>)}).catch(error=>logger.error({err:error},'subscription alert sweep failed'))},60_000);subscriptionSweep.unref();
let mobileAlertBusy=false;
const mobileAlertSweep=setInterval(()=>{if(mobileAlertBusy)return;mobileAlertBusy=true;
 void (async()=>{await collectTransitions((userId,payload)=>io.to(`user:${userId}`).emit('mobile:vehicle-alert',payload)).catch(error=>logger.error({err:error},'state transition collection failed'));for(const notification of await processParkingModes().catch(error=>{logger.error({err:error},'parking sweep failed');return [];})){await withParkingDelivery(notification as unknown as Record<string,unknown>,()=>publishVehicleNotification(io,notification.vehicleId,notification as unknown as Record<string,unknown>));await publishVehicleParking(io,notification.vehicleId,{vehicleId:notification.vehicleId});}await flushPushOutbox();})()
 .catch(error=>logger.error({err:error},'mobile push sweep failed')).finally(()=>{mobileAlertBusy=false});
},5000);mobileAlertSweep.unref();
const port=env.PORT??env.API_PORT;
server.listen(port,()=>logger.info({port},'api listening'));
const shutdown=()=>{clearInterval(mobileAlertSweep);clearInterval(unreachableSweep);clearInterval(subscriptionSweep);server.close(()=>pool.end().finally(()=>process.exit(0)))};process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
