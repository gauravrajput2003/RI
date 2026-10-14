import type {DivIcon} from 'leaflet';
export type VehicleMarkerStatus='running'|'idle'|'stopped'|'unreachable';
export const STATUS_COLORS:Record<VehicleMarkerStatus,{main:string;dark:string}>;
export function getVehicleStatus(vehicle:{speed?:number|null;current_speed?:number|null;ignition?:boolean|number|string|null;lastSeen?:string|null;last_seen_at?:string|null;fleet_status?:string;status?:string;state?:string|null},offlineMins?:number):VehicleMarkerStatus;
export function getVehicleSvg(type?:string|null,status?:string):string;
export function getVehicleIcon(L:typeof import('leaflet'),type?:string|null,status?:string,heading?:number|null):DivIcon;
