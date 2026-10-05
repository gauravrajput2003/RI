import type {ComponentProps} from 'react';
import {NavLink} from 'react-router-dom';
import {permissionDefinitions,routePermissions,PERMISSIONS,type PermissionKey} from '../../../../../packages/shared-types/src/permissions';
import {usePermissions} from '../../lib/permissions';
export const navigationGroups={
 Dashboard:permissionDefinitions.filter(d=>d.group==='Dashboard'&&d.path).map(d=>d.key),
 Reports:[...permissionDefinitions.filter(d=>d.group==='Reports').map(d=>d.key),PERMISSIONS.coinDistributionView],
 'Vehicle Reports':permissionDefinitions.filter(d=>d.group==='Reports'&&['reports.status','reports.idle','reports.running','reports.stoppage','reports.overspeed','reports.unreachable'].includes(d.resource)).map(d=>d.key),
 Alert:permissionDefinitions.filter(d=>d.group==='Alerts'&&d.action==='view').map(d=>d.key),
};
export function PermissionNavLink(props:ComponentProps<typeof NavLink>){
 const {hasPermission}=usePermissions(),path=typeof props.to==='string'?props.to:props.to.pathname??'',key=routePermissions[path];
 return key&&!hasPermission(key)?null:<NavLink {...props}/>;
}
export const visibleNavigationGroup=(group:keyof typeof navigationGroups,hasPermission:(key:PermissionKey)=>boolean)=>navigationGroups[group].some(hasPermission);
