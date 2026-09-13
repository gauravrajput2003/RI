import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { configureSockets } from './realtime/socket-server.js';
import { vehicleAuthorizer } from './realtime/vehicle-authorizer.js';
import { publishVehicleLocation } from './realtime/socket-server.js';
import { publishedVehicleActivity } from './modules/vehicles/repository.js';

const server=createServer(app); export const io=new Server(server,{cors:{origin:env.CORS_ORIGINS.split(',')}});
configureSockets(io,vehicleAuthorizer);
app.locals.publishVehicleLocation=async(vehicleId:string,payload:Record<string,unknown>)=>{
  const activity=(await publishedVehicleActivity(vehicleId)).rows[0];
  if(activity)await publishVehicleLocation(io,vehicleId,{...payload,...activity});
};
server.listen(env.API_PORT,()=>logger.info({port:env.API_PORT},'api listening'));
const shutdown=()=>server.close(()=>pool.end().finally(()=>process.exit(0)));process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
