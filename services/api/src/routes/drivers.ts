import {Router,type Router as RouterType,type Response,type NextFunction} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {validateDriver} from '@fleet/shared-types';
import type {AuthRequest} from '../middleware/auth.js';
import {AppError} from '../lib/errors.js';
import {listDrivers,createDriver,currentDriver,assignDriver} from '../modules/drivers/repository.js';
const route=(fn:(req:AuthRequest,res:Response)=>Promise<void>)=>(req:AuthRequest,res:Response,next:NextFunction)=>fn(req,res).catch(next);
const writes=rateLimit({windowMs:60000,max:30,keyGenerator:req=>(req as AuthRequest).user!.id,standardHeaders:true,legacyHeaders:false,message:{success:false,error:{code:'RATE_LIMITED',message:'Too many driver changes. Please wait a minute.'}}});
const uuid=z.string().uuid();
export const driversApi:RouterType=Router();
driversApi.use((req,res,next)=>{if(/^\/(drivers|vehicles\/[^/]+\/driver)(\/|$)/.test(req.path))res.set('Cache-Control','no-store');next();});
driversApi.get('/drivers',route(async(req,res)=>{
 const p=z.object({limit:z.coerce.number().int().min(1).max(100).default(50),cursor:uuid.optional(),vehicleId:uuid.optional()}).strict().parse(req.query);
 const rows=await listDrivers(req.user!.id,p.limit,p.cursor,p.vehicleId);res.json({success:true,data:rows,nextCursor:rows.length===p.limit?rows.at(-1)!.id:null});
}));
driversApi.post('/drivers',writes,route(async(req,res)=>{
 const body=z.object({name:z.string(),mobile:z.string(),licenceNumber:z.string(),vehicleId:uuid.optional()}).strict().parse(req.body),check=validateDriver(body);
 if(!check.valid)throw new AppError(400,'INVALID_DRIVER',Object.values(check.errors)[0]!);
 const result=await createDriver(req.user!.id,check.data,body.vehicleId);res.status(result.created?201:200).json({success:true,data:result.driver});
}));
driversApi.get('/vehicles/:id/driver',route(async(req,res)=>{res.json({success:true,data:await currentDriver(req.user!.id,uuid.parse(req.params.id))})}));
driversApi.put('/vehicles/:id/driver',writes,route(async(req,res)=>{
 const body=z.object({driverId:uuid,expectedAssignmentId:uuid.nullable()}).strict().parse(req.body);
 res.json({success:true,data:await assignDriver(req.user!.id,uuid.parse(req.params.id),body.driverId,body.expectedAssignmentId)});
}));
