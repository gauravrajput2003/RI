import { query } from '../db/pool.js';import type { VehicleAuthorizer } from './authorization.js';import {userScopeCte} from '../modules/authorization/scope.js';
import {hasPermissionForUser} from '../modules/authorization/permissions.js';
import {PERMISSIONS} from '@fleet/shared-types';
const canReadFleet=async(id:string)=>await hasPermissionForUser(id,PERMISSIONS.dashboardView)||await hasPermissionForUser(id,PERMISSIONS.vehicleView);
export const vehicleAuthorizer:VehicleAuthorizer={
 async isActiveUser(id){return Boolean((await query('SELECT id FROM users WHERE id=$1 AND active=true',[id])).rows[0])},
 canReceiveNotifications:id=>hasPermissionForUser(id,PERMISSIONS.notificationsView),
 async canAccessVehicle(userId,vehicleId){return await canReadFleet(userId)&&Boolean((await query(`${userScopeCte} SELECT 1 FROM vehicles v JOIN user_scope scope ON scope.id=v.owner_id WHERE v.id=$2 AND v.active=true AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND active=true)`,[userId,vehicleId])).rowCount)},
 async authorizedVehicleIds(userId){if(!await canReadFleet(userId))return [];return (await query<{id:string}>(`${userScopeCte} SELECT v.id FROM vehicles v JOIN user_scope scope ON scope.id=v.owner_id WHERE v.active=true AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND active=true)`,[userId])).rows.map(row=>row.id)},
};
