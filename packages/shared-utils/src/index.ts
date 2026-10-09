export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type VehicleVisualType = 'bike' | 'scooter' | 'car' | 'truck' | 'bus' | 'van';
export type VehicleVisualIcon = 'two-wheeler' | 'directions-car' | 'local-shipping' | 'airport-shuttle';
export type VehicleVisualState =
  | 'ALL' | 'OVERSPEED' | 'RUNNING' | 'IDLE' | 'STOPPED' | 'UNREACHABLE' | 'NEW' | 'INACTIVE'
  | 'ONLINE' | 'OFFLINE' | 'MOVING' | 'UNKNOWN' | null | undefined;

export const vehicleTypeSpecs: Record<VehicleVisualType, {icon: VehicleVisualIcon; label: string}> = {
  bike: {icon: 'two-wheeler', label: 'Two wheeler'},
  scooter: {icon: 'two-wheeler', label: 'Scooter'},
  car: {icon: 'directions-car', label: 'Car'},
  truck: {icon: 'local-shipping', label: 'Truck'},
  bus: {icon: 'airport-shuttle', label: 'Bus'},
  van: {icon: 'airport-shuttle', label: 'Van'},
};

export function normalizeVehicleType(value?: string | null): VehicleVisualType {
  const type = value?.trim().toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ') ?? '';
  if (/scooty|scooter|moped/.test(type)) return 'scooter';
  if (/bike|motorcycle|motorbike|two wheeler/.test(type)) return 'bike';
  if (/truck|lorry|goods|cargo|tipper/.test(type)) return 'truck';
  if (/minibus|mini bus|bus|coach/.test(type)) return 'bus';
  if (/van|tempo|ambulance/.test(type)) return 'van';
  return 'car';
}

export function vehicleStateAppearance(state: VehicleVisualState) {
  switch (state) {
    case 'RUNNING': case 'MOVING':
      return {key: 'running', color: '#168a55', background: '#e6f7ee', label: 'Running'} as const;
    case 'ONLINE':
      return {key: 'new', color: '#2d73ad', background: '#e6f2fc', label: 'Online (motion unknown)'} as const;
    case 'IDLE':
      return {key: 'idle', color: '#ad7e00', background: '#fff5cc', label: 'Idle'} as const;
    case 'STOPPED':
      return {key: 'stopped', color: '#c33d35', background: '#fde9e7', label: 'Stopped'} as const;
    case 'OVERSPEED':
      return {key: 'overspeed', color: '#d66b16', background: '#fff0df', label: 'Overspeed'} as const;
    case 'NEW':
      return {key: 'new', color: '#2d73ad', background: '#e6f2fc', label: 'New'} as const;
    case 'INACTIVE':
      return {key: 'inactive', color: '#6f7780', background: '#eceff1', label: 'Inactive'} as const;
    case 'UNREACHABLE': case 'OFFLINE': case 'UNKNOWN': case null: case undefined:
      return {key: 'unreachable', color: '#607584', background: '#e9eef1', label: 'No signal'} as const;
    default:
      return {key: 'unreachable', color: '#607584', background: '#e9eef1', label: 'No signal'} as const;
  }
}

export function vehicleAppearance(type?: string | null, state?: VehicleVisualState) {
  const normalizedType = normalizeVehicleType(type);
  return {type: normalizedType, ...vehicleTypeSpecs[normalizedType], ...vehicleStateAppearance(state)};
}

/** Both clients use the same uploaded artwork and tracker-state mapping. */
export function vehicleRasterAsset(type?: string | null, state?: VehicleVisualState) {
  const appearance = vehicleAppearance(type, state);
  if (appearance.type === 'van') return null;
  const imageState = appearance.key === 'overspeed' ? 'running'
    : appearance.key === 'new' || appearance.key === 'inactive' ? 'unreachable'
    : appearance.key;
  return { type: appearance.type, state: imageState };
}
