import type {Response,NextFunction} from 'express';
import {PERMISSIONS as P,permissionDefinitions,hasEffectivePermission,type PermissionKey} from '@fleet/shared-types';
import type {AuthRequest} from './auth.js';
import {effectivePermissions} from '../modules/authorization/permissions.js';
import {AppError} from '../lib/errors.js';

type Rule={methods:string[];path:RegExp;any:PermissionKey[]};
const rule=(methods:string,path:RegExp,...any:PermissionKey[]):Rule=>({methods:methods.split('|'),path,any});
const crud=(path:RegExp,keys:{view:PermissionKey;add:PermissionKey;edit:PermissionKey;delete:PermissionKey}):Rule[]=>[
  rule('GET|HEAD',path,keys.view),rule('POST',path,keys.add),rule('PUT|PATCH',path,keys.edit),rule('DELETE',path,keys.delete),
];
const reportKeys=permissionDefinitions.filter(d=>d.group==='Reports').map(d=>d.key);
/** All endpoint aliases and selector dependencies are covered here before any router runs. */
export const permissionApiRules:Rule[]=[
  rule('GET|HEAD',/^\/dashboard\/vehicles$/,P.dashboardView),
  rule('GET|HEAD',/^\/playback$/,P.playbackView),
  rule('GET|HEAD',/^\/vehicles\/[^/]+\/history$/,P.playbackView),
  rule('GET|HEAD',/^\/vehicles\/[^/]+\/latest-location$/,P.dashboardView,P.vehicleView),
  ...crud(/^\/(?:vehicles|fleet-vehicles)(?:\/[^/]+)?$/,{view:P.vehicleView,add:P.vehicleAdd,edit:P.vehicleEdit,delete:P.vehicleDelete}),
  rule('GET|HEAD',/^\/vehicle-(?:admin|client|device)-options$/,P.vehicleView),
  rule('GET|HEAD',/^\/admin-owners$/,P.adminView),
  rule('GET|HEAD',/^\/client-owners$/,P.clientView),
  rule('GET|HEAD',/^\/client-options$/,P.dashboardView,P.vehicleView,P.clientView),
  rule('POST',/^\/clients\/[^/]+\/reset-password$/,P.clientEdit),
  ...crud(/^\/admins(?:\/[^/]+)?$/,{view:P.adminView,add:P.adminAdd,edit:P.adminEdit,delete:P.adminDelete}),
  ...crud(/^\/clients(?:\/[^/]+)?$/,{view:P.clientView,add:P.clientAdd,edit:P.clientEdit,delete:P.clientDelete}),
  ...crud(/^\/geofences(?:\/[^/]+)?$/,{view:P.geofenceView,add:P.geofenceAdd,edit:P.geofenceEdit,delete:P.geofenceDelete}),
  rule('GET|HEAD',/^\/alerts\/(?:events|mapping-options)$/,P.alertView),
  rule('PATCH',/^\/alerts\/[^/]+\/status$/,P.alertEdit),
  ...crud(/^\/alerts(?:\/[^/]+)?$/,{view:P.alertView,add:P.alertAdd,edit:P.alertEdit,delete:P.alertDelete}),
  rule('GET|HEAD',/^\/notifications(?:\/[^/]+)?$/,P.notificationsView),
  rule('POST|DELETE',/^\/announcements\/image$/,P.announcementAdd,P.announcementEdit),
  rule('POST',/^\/announcements\/[^/]+\/dismiss$/,P.announcementView),
  ...crud(/^\/announcements(?:\/[^/]+)?$/,{view:P.announcementView,add:P.announcementAdd,edit:P.announcementEdit,delete:P.announcementDelete}),
  rule('GET|HEAD',/^\/reports\/options$/,P.playbackView,...reportKeys),
  rule('GET|HEAD',/^\/reports\/(?:coin-admins|coin-distribution)$/,P.coinDistributionView),
  ...permissionDefinitions.filter(d=>d.group==='Reports').map(d=>rule('GET|HEAD',new RegExp(`^/reports/${d.resource.slice('reports.'.length)}$`),d.key)),
  rule('GET|HEAD',/^\/coin-flow$/,P.coinDistributionView),
  rule('POST',/^\/coin-(?:sales|grants)$/,P.coinDistributionAdd),
  rule('GET|HEAD',/^\/web\/packet-health$/,P.packetHealthView),
  rule('GET|HEAD',/^\/devices$/,P.deviceView),rule('GET|HEAD',/^\/events$/,P.eventView),
  rule('GET|HEAD',/^\/groups$/,P.groupView),rule('GET|HEAD',/^\/subscriptions$/,P.subscriptionView),
  rule('GET|HEAD',/^\/account-summary$/,P.profileView),rule('POST',/^\/account-avatar$/,P.profileEdit),
];
export function apiPermissionRequirement(method:string,path:string):PermissionKey[]|undefined {
  return permissionApiRules.filter(r=>r.methods.includes(method)&&r.path.test(path)).flatMap(r=>r.any).reduce<PermissionKey[]>((all,key)=>all.includes(key)?all:[...all,key],[]);
}
export async function enforceApiPermissions(req:AuthRequest,_res:Response,next:NextFunction) {
  try{
    if(req.user?.role!=='ADMIN'){next();return}
    const path=req.path.replace(/\/+$/,'')||'/';
    // Bootstrap always works; management endpoints retain their SUPER_ADMIN role guard.
    if(path==='/auth/permissions'||path.startsWith('/super-admin/permissions')){next();return}
    // Reading explicitly received notices is independent of announcement-management grants.
    if((['GET','HEAD'].includes(req.method)&&path==='/announcements/my')||
       (req.method==='POST'&&/^\/announcements\/[^/]+\/(?:read|hide-popup)$/.test(path))){next();return}
    const permissions=await effectivePermissions(req.user.id,'ADMIN');
    const required=apiPermissionRequirement(req.method,path);
    if(!required?.length||!required.some(key=>hasEffectivePermission(permissions,key)))throw new AppError(403,'FORBIDDEN','You do not have permission to perform this operation.');
    if(/^\/admins(?:\/[^/]+)?$/.test(path)&&['POST','PATCH'].includes(req.method)&&req.body?.coins!==undefined&&(req.method==='PATCH'||Number(req.body.coins)>0)&&!hasEffectivePermission(permissions,P.coinDistributionAdd))throw new AppError(403,'FORBIDDEN','You do not have permission to distribute coins.');
    next();
  }catch(error){next(error)}
}
