import {Router,type Router as RouterType,type NextFunction,type Response} from 'express';
import {z} from 'zod';
import {authorize,type AuthRequest} from '../middleware/auth.js';
import {query} from '../db/pool.js';
import {AppError} from '../lib/errors.js';
import {deviceLookup,packetHealth} from '../modules/vehicles/diagnostics.js';
const route=(fn:(req:AuthRequest,res:Response)=>Promise<void>)=>(req:AuthRequest,res:Response,next:NextFunction)=>fn(req,res).catch(next);
const paging=z.object({search:z.string().trim().max(100).default(''),page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25)});
export const diagnosticsApi:RouterType=Router();
diagnosticsApi.get('/device-lookup',authorize('SUPER_ADMIN'),route(async(req,res)=>{
  const q=paging.parse(req.query),result=await deviceLookup(req.user!.id,q.search,q.page,q.pageSize);
  res.json({success:true,data:result.rows,pagination:{page:q.page,pageSize:q.pageSize,total:result.total}});
}));
diagnosticsApi.get('/packet-health',authorize('SUPER_ADMIN','ADMIN'),route(async(req,res)=>{
  const actor=(await query('SELECT role,active,can_view_packet_health FROM users WHERE id=$1',[req.user!.id])).rows[0];
  if(!actor?.active||(actor.role!=='SUPER_ADMIN'&&(actor.role!=='ADMIN'||!actor.can_view_packet_health)))throw new AppError(403,'FORBIDDEN','Packet-health access is disabled');
  const q=paging.parse(req.query),result=await packetHealth(req.user!.id,q.search,q.page,q.pageSize);
  res.json({success:true,data:result.rows,pagination:{page:q.page,pageSize:q.pageSize,total:result.total}});
}));
