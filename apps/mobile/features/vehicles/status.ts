import type { ActivityStatus, Location, Vehicle } from '../../types/models';

// Use the newest server observation. When disconnected this remains last-known
// state; a client clock cannot determine whether the server received heartbeats.
export function stateForVehicle(vehicle: Vehicle, live?: Location) {
  const observedAt = (value: ActivityStatus) => Date.parse(value.status_checked_at ?? ('server_received_at' in value ? String(value.server_received_at) : '')) || 0;
  const source = live?.state && observedAt(live) >= observedAt(vehicle) ? live : vehicle;
  return source.state;
}

/** Use the newest server activity even when its last usable GPS fix is older. */
export function currentSpeedForVehicle(vehicle: Vehicle, live?: Location): number | null | undefined {
  const checked = (value: ActivityStatus) => Date.parse(value.status_checked_at ?? '') || 0;
  const source = live && checked(live) >= checked(vehicle) ? live : vehicle;
  return source.current_speed !== undefined ? source.current_speed : live?.speed;
}
