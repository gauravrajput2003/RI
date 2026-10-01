import express,{type Express}from 'express';import helmet from 'helmet';import cors from 'cors';import {resolve,join}from 'node:path';import {existsSync}from 'node:fs';import {api}from './routes/api.js';import {internalTelemetry}from './realtime/internal-telemetry-route.js';import {errorHandler}from './lib/errors.js';import {env}from './config/env.js';import {pool}from './db/pool.js';import {apiRateLimit,authRateLimit,historyRateLimit}from './middleware/rate-limits.js';import {authenticate}from './middleware/auth.js';
const imageSources=["'self'",'data:','https://tile.openstreetmap.org','https://server.arcgisonline.com','https://res.cloudinary.com'];
const connectSources=["'self'",...(process.env.RENDER_EXTERNAL_HOSTNAME?['wss://'+process.env.RENDER_EXTERNAL_HOSTNAME]:[])];
export const app:Express=express();app.use(helmet({contentSecurityPolicy:{directives:{imgSrc:imageSources,connectSrc:connectSources}},referrerPolicy:{policy:'strict-origin-when-cross-origin'}}));app.use(cors({origin:env.CORS_ORIGINS.split(','),credentials:true}));app.use('/api/v1/account-avatar',authenticate,express.json({limit:'3mb'}));app.use('/api/v1/announcements/image',authenticate,express.json({limit:'7mb'}));app.use(express.json({limit:'100kb'}));app.use('/internal/v1',internalTelemetry);app.use('/api/v1/auth',authRateLimit);app.use('/api/v1/vehicles/:id/history',historyRateLimit);app.use('/api/v1',apiRateLimit);app.get('/health',(_q,r)=>r.json({success:true,data:{status:'ok'}}));app.get('/health/live',(_q,r)=>r.json({success:true,data:{status:'live'}}));app.get('/health/ready',async(_q,r,next)=>{try{await pool.query('SELECT 1');r.json({success:true,data:{status:'ready'}})}catch(error){next(error)}});app.use('/api/v1',api);
if(env.NODE_ENV==='production'){
 const webDist=resolve(process.cwd(),'apps/web/dist');
 if(existsSync(join(webDist,'index.html'))){
  app.use(express.static(webDist,{index:false}));
  app.get(/^(?!\/(?:api|internal|health|socket\.io)(?:\/|$)).*/,(_req,res,next)=>{
   res.sendFile(join(webDist,'index.html'),error=>{if(error)next(error)});
  });
 }
}
app.use(errorHandler);
