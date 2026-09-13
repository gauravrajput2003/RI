import type { DeviceState } from '@fleet/shared-types';
import { env } from '../../config/env.js';
import { query } from '../../db/pool.js';

/** Read-time status only: never updates current-state merges or location history. */
export function deviceActivity(lastSeen: Date | string | null, storedState: DeviceState | null, active = true, now = new Date()) {
  const seen = lastSeen == null ? NaN : new Date(lastSeen).getTime();
  const offlineAt = seen + env.OFFLINE_TIMEOUT_SECONDS * 1000;
  const offline = !active || !Number.isFinite(seen) || now.getTime() > offlineAt;
  return {
    state: (offline ? 'OFFLINE' : storedState && storedState !== 'OFFLINE' && storedState !== 'UNKNOWN' ? storedState : 'ONLINE') as DeviceState,
    status_checked_at: now.toISOString(),
    offline_at: Number.isFinite(offlineAt) && active ? new Date(offlineAt).toISOString() : null,
  };
}

export async function activityQuery(sql: string, values: unknown[]) {
  const result = await query(sql, values);
  const now = new Date();
  return { ...result, rows: result.rows.map(row => {
    const { activity_state, activity_active, ...record } = row;
    return { ...record, ...deviceActivity(row.last_seen_at ?? null, activity_state ?? null, activity_active ?? false, now) };
  }) };
}

// A vehicle may have multiple devices: use the most recent activity on an active
// device in a current assignment. Pre-assignment activity grants no fresh state.
export const vehicleActivityJoin = `LEFT JOIN LATERAL (
  SELECT CASE WHEN device.last_seen_at>=assign.assigned_at THEN device.last_seen_at END AS last_seen_at,
    CASE WHEN status.updated_at>=assign.assigned_at THEN status.state END AS activity_state,
    device.active AND v.active AS activity_active
  FROM vehicle_device_assignments assign JOIN devices device ON device.id=assign.device_id
  LEFT JOIN device_status status ON status.device_id=device.id
  WHERE assign.vehicle_id=v.id AND assign.unassigned_at IS NULL AND device.active=true
  ORDER BY device.last_seen_at DESC NULLS LAST LIMIT 1
) activity ON true`;
