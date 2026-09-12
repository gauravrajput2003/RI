export type VehicleState='ONLINE'|'OFFLINE'|'MOVING'|'IDLE'|'STOPPED';
export interface Location {id?:string;vehicle_id?:string;tracker_timestamp?:string|null;server_received_at:string;latitude?:number|null;longitude?:number|null;speed?:number|null;course?:number|null;ignition?:boolean|null;satellites?:number|null;gps_valid?:boolean|null;battery_percent?:number|null;gsm_signal?:number|null;state?:VehicleState;metadata?:Record<string,unknown>}
export interface Vehicle {id:string;vehicle_number:string;alias:string|null;vehicle_type:string|null;odometer:number|null;active:boolean;protocol?:string;latestLocation?:Location}
export interface ApiEnvelope<T>{success:boolean;data:T;nextCursor?:string|null}
export interface Tokens {accessToken:string;refreshToken:string}
