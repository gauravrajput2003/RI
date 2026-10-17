import {Router,type Router as RouterType,type Response,type NextFunction} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import type {AuthRequest} from '../middleware/auth.js';
import {AppError} from '../lib/errors.js';
import {mobileReport,reportSnapshot} from '../modules/reports/mobile.js';
import {exportMobileReport} from '../modules/reports/mobile-export.js';
const asyncRoute=(fn:(req:AuthRequest,res:Response)=>Promise<void>)=>(req:AuthRequest,res:Response,next:NextFunction)=>fn(req,res).catch(next);
const kind=z.enum(['distance','travel-summary']);
export const mobileReportFilters=z.object({vehicleId:z.string().uuid(),start:z.coerce.date(),end:z.coerce.date(),timeZone:z.string().min(1).max(80).default('Asia/Kolkata')}).superRefine((q,ctx)=>{
 if(q.start>=q.end||+q.end-+q.start>31*86400000)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Select a valid range of at most 31 days.'});
 try{new Intl.DateTimeFormat('en-US',{timeZone:q.timeZone}).format(q.start)}catch{ctx.addIssue({code:z.ZodIssueCode.custom,message:'Invalid time zone.'})}
 if(+q.start>Date.now())ctx.addIssue({code:z.ZodIssueCode.custom,message:'Start date cannot be in the future.'});
});
export const mobileReportsApi:RouterType=Router();
mobileReportsApi.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});
mobileReportsApi.get('/:kind',asyncRoute(async(req,res)=>{res.json({success:true,data:await mobileReport(req.user!.id,kind.parse(req.params.kind),mobileReportFilters.parse(req.query))})}));
mobileReportsApi.post('/:kind/export',rateLimit({windowMs:60_000,limit:10,keyGenerator:req=>(req as AuthRequest).user!.id,standardHeaders:true,legacyHeaders:false}),asyncRoute(async(req,res)=>{
 const body=z.object({snapshotId:z.string().uuid(),format:z.enum(['pdf','xlsx'])}).parse(req.body),report=await reportSnapshot(req.user!.id,kind.parse(req.params.kind),body.snapshotId);
 if(!report.rows.length)throw new AppError(409,'NO_REPORT_DATA','No report data available for the selected period.');
 const buffer=await exportMobileReport(report,body.format);
 res.json({success:true,data:{fileName:`${report.kind}-${report.vehicle.id}-${report.filters.start.slice(0,10)}.${body.format}`,mimeType:body.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',base64:buffer.toString('base64')}});
}));
