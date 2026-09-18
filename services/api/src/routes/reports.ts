import {Router,type Router as RouterType,type NextFunction,type Response} from 'express';
import {z} from 'zod';
import type {AuthRequest} from '../middleware/auth.js';
import {AppError} from '../lib/errors.js';
import {reportVehicles} from '../modules/reports/repository.js';
import {acReport,dailyReport,distanceReport,packetReport,travelReport,type ReportQuery} from '../modules/reports/service.js';
const asyncRoute=(fn:(req:AuthRequest,res:Response)=>Promise<void>)=>(req:AuthRequest,res:Response,next:NextFunction)=>fn(req,res).catch(next);
const base=z.object({vehicleId:z.string().uuid().optional(),start:z.coerce.date(),end:z.coerce.date(),timeZone:z.string().min(1).max(80).default('UTC'),search:z.string().trim().max(100).default(''),page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25)});
function parsed(input:unknown):ReportQuery {const q=base.parse(input);if(q.start>=q.end)throw new AppError(400,'INVALID_DATE_RANGE','Start must be before end');if(+q.end-+q.start>31*86400000)throw new AppError(400,'DATE_RANGE_TOO_LARGE','Date range cannot exceed 31 days');try{new Intl.DateTimeFormat('en-US',{timeZone:q.timeZone}).format(q.start)}catch{throw new AppError(400,'INVALID_TIME_ZONE','Time zone is invalid')}return q}
export const reportsApi:RouterType=Router();
reportsApi.get('/options',asyncRoute(async(req,res)=>{const search=z.string().trim().max(100).default('').parse(req.query.search);const result=await reportVehicles(req.user!.id,{search,page:1,pageSize:100});res.json({success:true,data:result.rows.map(row=>({id:row.id,vehicle_number:row.vehicle_number,alias:row.alias}))})}));
for(const [path,reader] of [['distance',distanceReport],['ac',acReport],['travel-summary',travelReport],['daily-trip-summary',dailyReport]] as const)reportsApi.get('/'+path,asyncRoute(async(req,res)=>{const q=parsed(req.query),result=await reader(req.user!.id,q);res.json({success:true,data:result.rows,...('dates'in result?{dates:result.dates}:{}),pagination:{page:q.page,pageSize:q.pageSize,total:result.total}})}));
reportsApi.get('/packet',asyncRoute(async(req,res)=>{const q=parsed(req.query),interval=z.coerce.number().int().min(1).max(24).default(1).parse(req.query.intervalHours),result=await packetReport(req.user!.id,q,interval);res.json({success:true,data:result.rows,pagination:{page:1,pageSize:result.rows.length||1,total:result.total}})}));
