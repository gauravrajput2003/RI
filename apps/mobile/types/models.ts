export type VehicleState='ONLINE'|'OFFLINE'|'MOVING'|'IDLE'|'STOPPED';
export interface ActivityStatus {state?:VehicleState;last_seen_at?:string|null;status_checked_at?:string;offline_at?:string|null;unreachable?:boolean;unreachable_at?:string|null}
export interface Location extends ActivityStatus {address?:string|null;address_attribution?:string|null;id?:string;vehicle_id?:string;tracker_timestamp?:string|null;server_received_at:string;latitude?:number|null;longitude?:number|null;speed?:number|null;course?:number|null;ignition?:boolean|null;satellites?:number|null;gps_valid?:boolean|null;battery_percent?:number|null;gsm_signal?:number|null;state?:VehicleState;metadata?:Record<string,unknown>}
export interface Vehicle extends ActivityStatus {id:string;vehicle_number:string;alias:string|null;vehicle_type:string|null;odometer:number|null;active:boolean;protocol?:string;latestLocation?:Location;remark?:string|null;mileage?:number|null;overspeed_limit?:number|null;billing_start?:string|null;billing_due?:string|null}
export interface ApiEnvelope<T>{success:boolean;data:T;nextCursor?:string|null}
export interface Tokens {accessToken:string;refreshToken:string}
