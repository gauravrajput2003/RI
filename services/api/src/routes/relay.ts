import {Router,type Router as RouterType,type Response,type NextFunction} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import type {AuthRequest} from '../middleware/auth.js';
import {requestRelay,vehicleRelay,relayProbeContext,relayCommandEvidence,cancelRelayProbe} from '../modules/vehicles/relay.js';
import {logger} from '../lib/logger.js';
const route=(fn:(req:AuthRequest,res:Response)=>Promise<void>)=>(req:AuthRequest,res:Response,next:NextFunction)=>fn(req,res).catch(next);
const writes=rateLimit({windowMs:60000,max:10,keyGenerator:req=>(req as AuthRequest).user!.id,standardHeaders:true,legacyHeaders:false,message:{success:false,error:{code:'RATE_LIMITED',message:'Too many relay requests. Please wait a minute.'}}});
const uuid=z.string().uuid();
export const relayApi:RouterType=Router();
relayApi.get('/vehicles/:id/relay/probe',route(async(req,res)=>{res.set('Cache-Control','no-store');res.json({success:true,data:await relayProbeContext(req.user!.id,uuid.parse(req.params.id))});}));
relayApi.get('/vehicles/:id/relay/commands/:commandId',route(async(req,res)=>{res.set('Cache-Control','no-store');res.json({success:true,data:await relayCommandEvidence(req.user!.id,uuid.parse(req.params.id),uuid.parse(req.params.commandId))});}));
relayApi.delete('/vehicles/:id/relay/commands/:commandId',route(async(req,res)=>{await cancelRelayProbe(req.user!.id,uuid.parse(req.params.id),uuid.parse(req.params.commandId));res.status(204).end();}));
relayApi.get('/vehicles/:id/relay',route(async(req,res)=>{
 res.set('Cache-Control','no-store');res.json({success:true,data:await vehicleRelay(req.user!.id,uuid.parse(req.params.id))});
}));
relayApi.post('/vehicles/:id/relay/commands',writes,route(async(req,res)=>{
 res.set('Cache-Control','no-store');
 const body=z.object({action:z.enum(['lock','unlock']),idempotencyKey:uuid,confirmed:z.literal(true),probeProfile:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),probeConnectionId:uuid.optional()}).strict().refine(value=>value.probeProfile?value.action==='unlock'&&Boolean(value.probeConnectionId):!value.probeConnectionId,{message:'Probe mode only allows unlock / HFYD with the current connection ID.'}).parse(req.body);
 const command=await requestRelay(req.user!.id,uuid.parse(req.params.id),body.action,body.idempotencyKey,body.probeProfile?{profile:body.probeProfile,connectionId:body.probeConnectionId!}:undefined);
 logger.info({actorId:req.user!.id,vehicleId:req.params.id,commandId:command.id,action:body.action,status:command.status,code:command.code},'relay request evaluated');
 const accepted=['pending','sent','succeeded'].includes(command.status);
 res.status(accepted?(command.status==='succeeded'?200:202):409).json({success:accepted,data:command,...(accepted?{}:{error:{code:command.code,message:command.message}})});
}));
