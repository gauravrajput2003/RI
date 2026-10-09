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

const server=createServer(app); export const io=new Server(server,{cors:{origin:env.CORS_ORIGINS.split(',')}});
configureSockets(io,vehicleAuthorizer);
app.locals.publishVehicleLocation=async(vehicleId:string,payload:Record<string,unknown>)=>{
  const activity=(await publishedVehicleActivity(vehicleId)).rows[0];
  if(activity){const combined:Record<string,unknown>={...payload,...activity,ignition:payload.ignition??(activity as typeof activity & {current_ignition?:boolean|null}).current_ignition??null,fleet_status:activity.state==='MOVING'?'RUNNING':activity.state};const published=env.ADDRESS_SOURCE==='cell'?(await displayedAddresses([combined]))[0]:combined;await publishVehicleLocation(io,vehicleId,published);for(const notification of await processVehicleTelemetry(vehicleId,combined as TelemetryAlertInput))await publishVehicleNotification(io,vehicleId,notification as unknown as Record<string,unknown>)}
};
const unreachableSweep=setInterval(()=>{void processUnreachableVehicles().then(async notifications=>{for(const notification of notifications)await publishVehicleNotification(io,notification.vehicleId,notification as unknown as Record<string,unknown>)}).catch(error=>logger.error({error},'unreachable alert sweep failed'))},60_000);unreachableSweep.unref();
const subscriptionSweep=setInterval(()=>{void processSubscriptionAlerts().then(async notifications=>{for(const notification of notifications)await publishUserNotification(io,notification.recipientUserId,notification as unknown as Record<string,unknown>)}).catch(error=>logger.error({error},'subscription alert sweep failed'))},60_000);subscriptionSweep.unref();
const port=env.PORT??env.API_PORT;
server.listen(port,()=>logger.info({port},'api listening'));
const shutdown=()=>{clearInterval(unreachableSweep);clearInterval(subscriptionSweep);server.close(()=>pool.end().finally(()=>process.exit(0)))};process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
