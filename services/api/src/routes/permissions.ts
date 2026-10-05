import {Router,type Router as RouterType,type Response,type NextFunction} from 'express';
import {z} from 'zod';
import {permissionDefinitions,permissionKeys,viewPermission,type PermissionKey} from '@fleet/shared-types';
import {authorize,type AuthRequest} from '../middleware/auth.js';
import {effectivePermissions,adminPermissionDetail,saveAdminPermissions,allAdminPermissionTargets,saveAllAdminPermissions} from '../modules/authorization/permissions.js';
import {listAdmins} from '../modules/admins/repository.js';
const route=(fn:(req:AuthRequest,res:Response)=>Promise<void>)=>(req:AuthRequest,res:Response,next:NextFunction)=>{void fn(req,res).catch(next)};
const allowedKeys=z.array(z.string().refine(key=>permissionKeys.includes(key as PermissionKey),'Unknown permission')).max(permissionKeys.length).refine(keys=>keys.every(key=>{if(!permissionKeys.includes(key as PermissionKey))return false;const view=viewPermission(key as PermissionKey);return !view||keys.includes(view)}),'Action permissions require resource view access');
export const permissionsApi:RouterType=Router();
permissionsApi.get('/auth/permissions',route(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json({success:true,data:{id:req.user!.id,role:req.user!.role,permissions:await effectivePermissions(req.user!.id,req.user!.role)}});
}));
permissionsApi.use('/super-admin/permissions',authorize('SUPER_ADMIN'));
permissionsApi.get('/super-admin/permissions/catalogue',(_req,res)=>res.json({success:true,data:permissionDefinitions}));
permissionsApi.get('/super-admin/permissions/admins',route(async(req,res)=>{
  const q=z.object({search:z.string().trim().max(100).default(''),page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(25)}).parse(req.query);
  const result=await listAdmins(req.user!.id,q.search,q.page,q.pageSize);
  res.json({success:true,data:result.rows,pagination:{page:q.page,pageSize:q.pageSize,total:result.total}});
}));
permissionsApi.get('/super-admin/permissions/all',route(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.json({success:true,data:await allAdminPermissionTargets(req.user!.id)});
}));
permissionsApi.put('/super-admin/permissions/all',route(async(req,res)=>{
  const body=z.object({permissions:allowedKeys,targets:z.array(z.object({id:z.string().uuid(),version:z.number().int().min(0)}).strict()).min(1)}).strict().parse(req.body);
  res.json({success:true,data:await saveAllAdminPermissions(req.user!.id,body.permissions as PermissionKey[],body.targets)});
}));
permissionsApi.get('/super-admin/permissions/:id',route(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.json({success:true,data:await adminPermissionDetail(req.user!.id,z.string().uuid().parse(req.params.id))});
}));
permissionsApi.put('/super-admin/permissions/:id',route(async(req,res)=>{
  const body=z.object({permissions:allowedKeys,version:z.number().int().min(0)}).strict().parse(req.body);
  res.json({success:true,data:await saveAdminPermissions(req.user!.id,z.string().uuid().parse(req.params.id),body.permissions as PermissionKey[],body.version)});
}));
