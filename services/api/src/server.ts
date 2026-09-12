import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { configureSockets } from './realtime/socket-server.js';
import { vehicleAuthorizer } from './realtime/vehicle-authorizer.js';
import { publishVehicleLocation } from './realtime/socket-server.js';

const server=createServer(app); export const io=new Server(server,{cors:{origin:env.CORS_ORIGINS.split(',')}});
configureSockets(io,vehicleAuthorizer);
app.locals.publishVehicleLocation=(vehicleId:string,payload:Record<string,unknown>)=>publishVehicleLocation(io,vehicleId,payload);
server.listen(env.API_PORT,()=>logger.info({port:env.API_PORT},'api listening'));
const shutdown=()=>server.close(()=>pool.end().finally(()=>process.exit(0)));process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
