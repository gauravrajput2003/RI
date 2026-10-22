import {Router,type Router as RouterType,type Response,type NextFunction} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {PARKING_RADII,PARKING_INTERVALS} from '@fleet/shared-types';
import type {AuthRequest} from '../middleware/auth.js';
import {parkingStatus,saveParking} from '../modules/parking/service.js';
const route=(fn:(req:AuthRequest,res:Response)=>Promise<void>)=>(req:AuthRequest,res:Response,next:NextFunction)=>fn(req,res).catch(next);
const writes=rateLimit({windowMs:60000,max:20,keyGenerator:req=>(req as AuthRequest).user!.id,standardHeaders:true,legacyHeaders:false,message:{success:false,error:{code:'RATE_LIMITED',message:'Too many parking changes. Wait a minute.'}}});
const uuid=z.string().uuid();
const body=z.object({enabled:z.boolean(),radius:z.number().refine(value=>(PARKING_RADII as readonly number[]).includes(value)),repeatMinutes:z.number().refine(value=>(PARKING_INTERVALS as readonly number[]).includes(value)),expectedVersion:z.number().int().positive().nullable(),confirmed:z.literal(true)}).strict();
export const parkingApi:RouterType=Router();
parkingApi.get('/vehicles/:id/parking',route(async(req,res)=>{res.set('Cache-Control','no-store');res.json({success:true,data:await parkingStatus(req.user!.id,uuid.parse(req.params.id))});}));
parkingApi.put('/vehicles/:id/parking',writes,route(async(req,res)=>{
 const result=await saveParking(req.user!.id,uuid.parse(req.params.id),body.parse(req.body));
 const publish=req.app.locals.publishParkingState as undefined|((vehicleId:string,payload:Record<string,unknown>)=>Promise<void>);
 // A publication outage must not turn a committed save into an apparent failure.
 if(publish)await publish(result.vehicleId,{vehicleId:result.vehicleId,enabled:result.enabled,version:result.version}).catch(()=>{});
 res.set('Cache-Control','no-store');res.json({success:true,data:result});
}));
