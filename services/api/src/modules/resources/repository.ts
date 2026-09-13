import { query } from '../../db/pool.js';
import { activityQuery } from '../vehicles/activity.js';

// Ownership is derived only from persisted relationships, never request filters.
export const listDevices = (owner: string, limit: number) => activityQuery(`
  SELECT d.*,ds.state AS activity_state,d.active AS activity_active FROM devices d
  LEFT JOIN device_status ds ON ds.device_id=d.id
  WHERE EXISTS (
    SELECT 1 FROM vehicle_device_assignments a JOIN vehicles v ON v.id=a.vehicle_id
    WHERE a.device_id=d.id AND a.unassigned_at IS NULL AND v.owner_id=$1
  ) ORDER BY d.created_at DESC LIMIT $2`, [owner, limit]);

// A device may move between customers. Its current assignment cannot grant
// access to historical events; only the event's recorded vehicle does that.
export const listEvents = (owner: string, limit: number) => query(`
  SELECT e.* FROM events e JOIN vehicles v ON v.id=e.vehicle_id
  WHERE v.owner_id=$1 ORDER BY e.created_at DESC LIMIT $2`, [owner, limit]);

export const listGroups = (owner: string, limit: number) => query(
  'SELECT * FROM groups WHERE owner_id=$1 ORDER BY created_at DESC LIMIT $2', [owner, limit]);

export const listSubscriptions = (owner: string, limit: number) => query(
  'SELECT * FROM subscriptions WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2', [owner, limit]);
