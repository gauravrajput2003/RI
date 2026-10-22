import {Router,type Router as RouterType,type Response,type NextFunction} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import type {AuthRequest} from '../middleware/auth.js';
import {requestRelay,vehicleRelay} from '../modules/vehicles/relay.js';
const route=(fn:(req:AuthRequest,res:Response)=>Promise<void>)=>(req:AuthRequest,res:Response,next:NextFunction)=>fn(req,res).catch(next);
const writes=rateLimit({windowMs:60000,max:10,keyGenerator:req=>(req as AuthRequest).user!.id,standardHeaders:true,legacyHeaders:false,message:{success:false,error:{code:'RATE_LIMITED',message:'Too many relay requests. Please wait a minute.'}}});
const uuid=z.string().uuid();
export const relayApi:RouterType=Router();
relayApi.get('/vehicles/:id/relay',route(async(req,res)=>{
 res.set('Cache-Control','no-store');res.json({success:true,data:await vehicleRelay(req.user!.id,uuid.parse(req.params.id))});
}));
relayApi.post('/vehicles/:id/relay/commands',writes,route(async(req,res)=>{
 res.set('Cache-Control','no-store');
 const body=z.object({action:z.enum(['lock','unlock']),idempotencyKey:uuid,confirmed:z.literal(true)}).strict().parse(req.body);
 const command=await requestRelay(req.user!.id,uuid.parse(req.params.id),body.action,body.idempotencyKey);
 // Current adapters always reject. Never return HTTP success for a rejected command.
 res.status(409).json({success:false,data:command,error:{code:command.code,message:command.message}});
}));
