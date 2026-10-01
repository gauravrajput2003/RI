import { Router, type Router as RouterType, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authorize, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { dashboardFleet, type FleetStatus } from '../modules/dashboard/repository.js';
import { playbackPoints } from '../modules/playback/repository.js';
import * as admins from '../modules/admins/repository.js';
import * as clients from '../modules/clients/repository.js';
import * as vehicleManagement from '../modules/vehicles/management.js';
import {query,transaction} from '../db/pool.js';
import {userScopeCte} from '../modules/authorization/scope.js';
import {uploadAvatar,deleteAvatar} from '../modules/profile/cloudinary.js';

const asyncRoute=(fn:(req:AuthRequest,res:Response)=>Promise<void>)=>(req:AuthRequest,res:Response,next:NextFunction)=>fn(req,res).catch(next);
const paging=z.object({page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25),search:z.string().trim().max(100).default('')});
const optionalText=(max:number)=>z.string().trim().max(max).optional().or(z.literal(''));
const username=z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/);
const mobile=z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).optional().or(z.literal(''));
const website=z.string().url().optional().or(z.literal(''));
const inactiveTimeout=z.coerce.number().int().min(300).max(31536000);
export const webApi:RouterType=Router();

webApi.patch('/users/:id/lock',authorize('SUPER_ADMIN'),asyncRoute(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.id),{locked}=z.object({locked:z.boolean()}).parse(req.body);
  const account=await transaction(async client=>{
    const result=await client.query(`${userScopeCte} UPDATE users u SET active=$3,updated_at=now()
      FROM user_scope s WHERE u.id=$2 AND u.id=s.id AND u.role IN ('ADMIN','CLIENT')
      RETURNING u.id,u.active`,[req.user!.id,id,!locked]);
    if(!result.rows[0])throw new AppError(404,'ACCOUNT_NOT_FOUND','Account not found');
    if(locked)await client.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[id]);
    return result.rows[0];
  });
  res.json({success:true,data:{...account,locked}});
}));

webApi.get('/account-summary',asyncRoute(async(req,res)=>{
  const result=await query<{id:string;name:string|null;username:string|null;mobile:string|null;email:string;avatarUrl:string|null;coins:string}>('SELECT id,name,username,mobile,email,avatar_url AS "avatarUrl",coins,can_view_packet_health FROM users WHERE id=$1 AND active=true',[req.user!.id]);
  if(!result.rows[0])throw new AppError(404,'ACCOUNT_NOT_FOUND','Account not found');
  res.json({success:true,data:result.rows[0]});
}));

webApi.post('/account-avatar',asyncRoute(async(req,res)=>{
  const {dataUri}=z.object({dataUri:z.string().max(3_000_000)}).parse(req.body);
  const account=await query<{avatar_public_id:string|null}>('SELECT avatar_public_id FROM users WHERE id=$1 AND active=true',[req.user!.id]);
  if(!account.rows[0])throw new AppError(404,'ACCOUNT_NOT_FOUND','Account not found');
  const uploaded=await uploadAvatar(req.user!.id,dataUri);
  try{
    const updated=await query<{avatarUrl:string}>('UPDATE users SET avatar_url=$2,avatar_public_id=$3,updated_at=now() WHERE id=$1 AND active=true RETURNING avatar_url AS "avatarUrl"',[req.user!.id,uploaded.url,uploaded.publicId]);
    if(!updated.rows[0])throw new AppError(404,'ACCOUNT_NOT_FOUND','Account not found');
    if(account.rows[0].avatar_public_id)void deleteAvatar(account.rows[0].avatar_public_id).catch(()=>{});
    res.json({success:true,data:updated.rows[0]});
  }catch(error){void deleteAvatar(uploaded.publicId).catch(()=>{});throw error}
}));

webApi.get('/dashboard/vehicles',asyncRoute(async(req,res)=>{
  const q=paging.extend({status:z.enum(['ALL','OVERSPEED','RUNNING','IDLE','STOPPED','UNREACHABLE','NEW','INACTIVE']).default('ALL'),clientId:z.string().uuid().optional()}).parse(req.query);
  const result=await dashboardFleet(req.user!.id,q.status as FleetStatus,q.search,q.page,q.pageSize,q.clientId);
  res.json({success:true,data:result.rows,counts:result.counts,pagination:{page:q.page,pageSize:q.pageSize,total:result.total}});
}));

webApi.get('/playback',asyncRoute(async(req,res)=>{
  const q=z.object({vehicleId:z.string().uuid(),start:z.coerce.date(),end:z.coerce.date(),limit:z.coerce.number().int().min(1).max(50000).default(50000)}).parse(req.query);
  if(q.start>q.end)throw new AppError(400,'INVALID_DATE_RANGE','Start must be before end');
  if(q.end.getTime()-q.start.getTime()>31*86400000)throw new AppError(400,'DATE_RANGE_TOO_LARGE','Date range cannot exceed 31 days');
  const result=await playbackPoints(req.user!.id,q.vehicleId,q.start,q.end,q.limit);
  if(!result.rowCount){
    const visible=await import('../modules/vehicles/repository.js').then(m=>m.findVehicle(q.vehicleId,req.user!.id));
    if(!visible.rowCount)throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');
  }
  const last=result.rows.at(-1),first=result.rows[0];
  res.json({success:true,data:result.rows,meta:{totalDistanceKm:Number(last?.cumulative_distance_km??0),avgSpeed:Number(first?.route_avg_speed??0),maxSpeed:Number(first?.route_max_speed??0),pointCount:Number(first?.route_point_count??0),startAt:first?.tracker_timestamp??first?.server_received_at??null,endAt:last?.tracker_timestamp??last?.server_received_at??null}});
}));

webApi.get('/admin-owners',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{res.json({success:true,data:(await admins.ownerOptions(req.user!.id)).rows})}));
webApi.get('/client-options',asyncRoute(async(req,res)=>{res.json({success:true,data:(await admins.clientOptions(req.user!.id)).rows})}));
webApi.get('/admins',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const q=paging.parse(req.query);const result=await admins.listAdmins(req.user!.id,q.search,q.page,q.pageSize);res.json({success:true,data:result.rows,pagination:{page:q.page,pageSize:q.pageSize,total:result.total}})}));
webApi.get('/admins/:id',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const result=await admins.findAdmin(req.user!.id,z.string().uuid().parse(req.params.id));if(!result.rows[0])throw new AppError(404,'ADMIN_NOT_FOUND','Admin not found');res.json({success:true,data:result.rows[0]})}));
webApi.post('/admins',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{
  const body=z.object({ownerId:z.string().uuid(),username:z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),password:z.string().min(8).max(128),name:z.string().trim().min(1).max(120),mobile:z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).optional().or(z.literal('')),email:z.string().email(),company:z.string().trim().max(160).optional(),website:z.string().url().optional().or(z.literal('')),address:z.string().trim().max(500).optional(),coins:z.coerce.number().min(0).default(0),active:z.boolean().default(true)}).parse(req.body);
  res.status(201).json({success:true,data:await admins.createAdmin(req.user!.id,body)});
}));
webApi.patch('/admins/:id',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const body=z.object({ownerId:z.string().uuid().optional(),username:username.optional(),password:z.string().min(8).max(128).optional(),name:z.string().trim().min(1).max(120).optional(),mobile, email:z.string().email().optional(),company:optionalText(160),website,address:optionalText(500),coins:z.coerce.number().min(0).optional(),active:z.boolean().optional(),canViewPacketHealth:z.boolean().optional()}).refine(value=>Object.keys(value).length>0,'At least one field is required').parse(req.body);res.json({success:true,data:await admins.updateAdmin(req.user!.id,z.string().uuid().parse(req.params.id),body)})}));
webApi.delete('/admins/:id',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{await admins.deactivateAdmin(req.user!.id,z.string().uuid().parse(req.params.id));res.status(204).end()}));

webApi.get('/client-owners',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{res.json({success:true,data:(await clients.clientOwnerOptions(req.user!.id)).rows})}));
webApi.get('/clients',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const q=paging.extend({active:z.enum(['true','false']).optional()}).parse(req.query);const result=await clients.listClients(req.user!.id,q.search,q.page,q.pageSize,q.active===undefined?undefined:q.active==='true');res.json({success:true,data:result.rows,pagination:{page:q.page,pageSize:q.pageSize,total:result.total}})}));
webApi.get('/clients/:id',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const result=await clients.findClient(req.user!.id,z.string().uuid().parse(req.params.id));if(!result.rows[0])throw new AppError(404,'CLIENT_NOT_FOUND','Client not found');res.json({success:true,data:result.rows[0]})}));
webApi.post('/clients',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const body=z.object({ownerId:z.string().uuid(),username,password:z.string().min(8).max(128),name:optionalText(120),mobile,email:z.string().email(),company:optionalText(160),website,address:optionalText(500),inactiveTimeoutSeconds:inactiveTimeout,active:z.boolean().default(true)}).parse(req.body);res.status(201).json({success:true,data:await clients.createClient(req.user!.id,body)})}));
webApi.patch('/clients/:id',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const body=z.object({username:username.optional(),name:z.string().trim().max(120).nullable().optional(),mobile:z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).nullable().optional().or(z.literal('')),email:z.string().email().optional(),company:z.string().trim().max(160).nullable().optional(),website:z.string().url().nullable().optional().or(z.literal('')),address:z.string().trim().max(500).nullable().optional(),inactiveTimeoutSeconds:inactiveTimeout.optional(),active:z.boolean().optional()}).refine(value=>Object.keys(value).length>0,'At least one field is required').parse(req.body);res.json({success:true,data:await clients.updateClient(req.user!.id,z.string().uuid().parse(req.params.id),body)})}));
webApi.post('/clients/:id/reset-password',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const body=z.object({password:z.string().min(8).max(128),confirmPassword:z.string().min(8).max(128)}).refine(value=>value.password===value.confirmPassword,{message:'Passwords do not match',path:['confirmPassword']}).parse(req.body);res.json({success:true,data:await clients.resetClientPassword(req.user!.id,z.string().uuid().parse(req.params.id),body.password)})}));
webApi.delete('/clients/:id',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{await clients.deleteClient(req.user!.id,z.string().uuid().parse(req.params.id));res.status(204).end()}));

const vehicleBody=z.object({adminId:z.string().uuid(),clientId:z.string().uuid(),deviceImei:z.string().trim().min(5).max(32).regex(/^[a-zA-Z0-9-]+$/),deviceProtocol:z.enum(['GT06','W15']),simNumber:z.string().trim().max(32).optional().or(z.literal('')),simOperator:z.enum(['Jio','Airtel','VI']),simInfo:optionalText(500),gpsLocation:optionalText(500),vehicleNumber:z.string().trim().min(1).max(80),vehicleType:z.string().trim().min(1).max(80),mileage:z.coerce.number().min(0),overspeedLimit:z.coerce.number().positive(),coins:z.coerce.number().min(0).default(0),billingStart:z.string().date().optional().or(z.literal('')),billingDue:z.string().date().optional().or(z.literal('')),alias:optionalText(120),remark:optionalText(500),active:z.boolean().default(true),autoRenewal:z.boolean().default(false),doorConfigured:z.boolean().default(false),relayConfigured:z.boolean().default(false),buzzerConfigured:z.boolean().default(false),ignitionWiring:z.enum(['UNKNOWN','NOT_CONNECTED','CONNECTED_POWER_PLUS']).default('UNKNOWN'),acPowerPlus:z.boolean().default(false),parkingAlarmOnIgnition:z.boolean().default(false)}).refine(value=>!value.billingStart||!value.billingDue||value.billingDue>=value.billingStart,{message:'Billing due date must be on or after billing start',path:['billingDue']});
webApi.get('/vehicle-admin-options',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{res.json({success:true,data:(await vehicleManagement.vehicleAdminOptions(req.user!.id)).rows})}));
webApi.get('/vehicle-client-options',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const adminId=z.string().uuid().parse(req.query.adminId);res.json({success:true,data:(await vehicleManagement.vehicleClientOptions(req.user!.id,adminId)).rows})}));
webApi.get('/vehicle-device-options',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const q=z.object({clientId:z.string().uuid(),search:z.string().trim().max(100).default('')}).parse(req.query);res.json({success:true,data:(await vehicleManagement.vehicleDeviceOptions(req.user!.id,q.clientId,q.search)).rows})}));
webApi.get('/fleet-vehicles',authorize('SUPER_ADMIN','ADMIN','CLIENT'),asyncRoute(async(req,res)=>{const q=paging.extend({status:z.enum(['ALL','OVERSPEED','RUNNING','IDLE','STOPPED','UNREACHABLE','NEW','INACTIVE']).default('ALL'),adminId:z.string().uuid().optional(),clientId:z.string().uuid().optional(),deviceType:z.string().trim().max(80).optional(),addedFrom:z.coerce.date().optional(),addedTo:z.coerce.date().optional(),modifiedFrom:z.coerce.date().optional(),modifiedTo:z.coerce.date().optional(),subscriptionStartFrom:z.coerce.date().optional(),subscriptionStartTo:z.coerce.date().optional(),subscriptionDueFrom:z.coerce.date().optional(),subscriptionDueTo:z.coerce.date().optional(),inactiveFrom:z.coerce.date().optional(),inactiveTo:z.coerce.date().optional()}).parse(req.query);const result=await vehicleManagement.listManagedVehicles(req.user!.id,{...q,status:q.status as FleetStatus});const clientFields=['id','vehicle_number','vehicle_type','fleet_status','speed','tracker_timestamp','server_received_at','status_since_at','today_distance_km','today_running_seconds','overspeed_limit'] as const;const data=req.user!.role==='CLIENT'?result.rows.map(row=>Object.fromEntries(clientFields.map(field=>[field,row[field]]))):result.rows;res.json({success:true,data,counts:result.counts,pagination:{page:q.page,pageSize:q.pageSize,total:result.total}})}));
webApi.get('/fleet-vehicles/:id',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{const result=await vehicleManagement.managedVehicle(req.user!.id,z.string().uuid().parse(req.params.id));if(!result.rows[0])throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');res.json({success:true,data:result.rows[0]})}));
webApi.post('/fleet-vehicles',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{res.status(201).json({success:true,data:await vehicleManagement.createManagedVehicle(req.user!.id,vehicleBody.parse(req.body))})}));
webApi.put('/fleet-vehicles/:id',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{res.json({success:true,data:await vehicleManagement.updateManagedVehicle(req.user!.id,z.string().uuid().parse(req.params.id),vehicleBody.parse(req.body))})}));
webApi.delete('/fleet-vehicles/:id',authorize('SUPER_ADMIN','ADMIN'),asyncRoute(async(req,res)=>{res.json({success:true,data:await vehicleManagement.deactivateManagedVehicle(req.user!.id,z.string().uuid().parse(req.params.id))})}));
