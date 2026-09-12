import pino from 'pino'; import { env } from '../config/env.js';
export const logger=pino({level:process.env.LOG_LEVEL??'info',transport:env.NODE_ENV==='development'?{target:'pino-pretty'}:undefined,redact:['req.headers.authorization','password','password_hash','token']});
