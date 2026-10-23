import { query } from '../db/pool.js';import type { VehicleAuthorizer } from './authorization.js';import {userScopeCte} from '../modules/authorization/scope.js';
import {hasPermissionForUser} from '../modules/authorization/permissions.js';
import {PERMISSIONS} from '@fleet/shared-types';
const canReadFleet=async(id:string)=>await hasPermissionForUser(id,PERMISSIONS.dashboardView)||await hasPermissionForUser(id,PERMISSIONS.vehicleView);
export const vehicleAuthorizer:VehicleAuthorizer={
 async vehicleRecipientIds(vehicleId){return (await query<{id:string}>(`WITH RECURSIVE owners AS (
  SELECT owner_id AS id FROM vehicles WHERE id=$1
  UNION ALL SELECT u.owner_id FROM users u JOIN owners o ON o.id=u.id WHERE u.owner_id IS NOT NULL
 ) SELECT u.id FROM users u JOIN owners o ON o.id=u.id WHERE u.active=true`,[vehicleId])).rows.map(row=>row.id)},
 async isActiveUser(id){return Boolean((await query('SELECT id FROM users WHERE id=$1 AND active=true',[id])).rows[0])},
 async canReceiveNotifications(id,vehicleId){return await hasPermissionForUser(id,PERMISSIONS.notificationsView)&&(!vehicleId||!(await query('SELECT 1 FROM mobile_vehicle_notification_preferences WHERE user_id=$1 AND vehicle_id=$2 AND muted',[id,vehicleId])).rows.length)},
 async canAccessVehicle(userId,vehicleId){return await canReadFleet(userId)&&Boolean((await query(`${userScopeCte} SELECT 1 FROM vehicles v JOIN user_scope scope ON scope.id=v.owner_id WHERE v.id=$2 AND v.active=true AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND active=true)`,[userId,vehicleId])).rowCount)},
 async authorizedVehicleIds(userId){if(!await canReadFleet(userId))return [];return (await query<{id:string}>(`${userScopeCte} SELECT v.id FROM vehicles v JOIN user_scope scope ON scope.id=v.owner_id WHERE v.active=true AND EXISTS(SELECT 1 FROM users WHERE id=$1 AND active=true)`,[userId])).rows.map(row=>row.id)},
};
