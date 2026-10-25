export type RelayAction='lock'|'unlock';
export type RelayCommandStatus='pending'|'sent'|'succeeded'|'failed'|'timed_out'|'rejected';
export interface RelayCommand {
 id:string;vehicleId:string;action:RelayAction;status:RelayCommandStatus;
 code:string;message:string;createdAt:string;
 probeProfile?:string|null;
}
export interface VehicleRelay {
 vehicleId:string;vehicleNumber:string;vehicleType:string|null;configured:boolean;
 protocol:string|null;state:'unknown'|'locked'|'unlocked';stateMessage:string;
 canLock:boolean;canUnlock:boolean;code:string;message:string;
 history:RelayCommand[];requestKey:string;
}
/** Relay commands require an explicit model command profile in addition to protocol. */
export function relayProtocolSupport(protocol:string|null,profile?:string|null):{supported:boolean;code:string;message:string}{
 if(protocol==='GT06'&&profile==='CONCOX_GT06_DYD')return {supported:true,code:'RELAY_READY',message:'Concox GT06 relay profile selected. Only a stationary vehicle with fresh GPS and ignition off can be controlled.'};
 return {supported:false,code:'RELAY_UNSUPPORTED',message:protocol==='GT06'
  ?'No supported relay command profile is selected. Ask your administrator to verify the tracker model and select its relay profile in Vehicle management.'
  :'This tracker does not support remote relay control.'};
}

export interface RelaySnapshot {
 id:string;owner_id:string;vehicle_number:string;vehicle_type:string|null;active:boolean;relay_configured:boolean;
 assignment_count:number;assignment_id:string|null;assigned_at:string|null;device_id:string|null;device_active:boolean|null;
 device_owner_matches:boolean|null;protocol:string|null;relay_profile:string|null;last_seen_at:string|null;
 connection_id:string|null;connection_expires_at:string|null;gps_valid:boolean|null;latitude:number|null;longitude:number|null;
 speed:number|null;current_speed:number|null;ignition:boolean|null;heartbeat_at:string|null;tracker_timestamp:string|null;server_received_at:string|null;
}
export function relaySafety(v:RelaySnapshot,now=new Date()){
 if(!v.active)return {code:'VEHICLE_INACTIVE',message:'Vehicle is inactive. Command was not sent.'};
 if(!v.relay_configured)return {code:'RELAY_DISABLED',message:'An installer must confirm relay wiring and enable Relay for this vehicle.'};
 if(v.assignment_count!==1||!v.device_id||!v.assignment_id||!v.device_active||!v.device_owner_matches)return {code:'RELAY_DEVICE_UNAVAILABLE',message:'One active tracker owned by this vehicle’s client must be assigned.'};
 const support=relayProtocolSupport(v.protocol,v.relay_profile);if(!support.supported)return support;
 if(!v.connection_id||!v.connection_expires_at||!Number.isFinite(Date.parse(v.connection_expires_at))||Date.parse(v.connection_expires_at)<=+now)return {code:'RELAY_OFFLINE',message:'Tracker is not connected to RI. Commands are never saved for later reconnection.'};
 const fresh=(value:string|null)=>value!==null&&Number.isFinite(Date.parse(value))&&+now-Date.parse(value)<=60000&&Date.parse(value)<=+now+30000&&Date.parse(value)>=Date.parse(v.assigned_at??'');
 if(!fresh(v.last_seen_at)||!fresh(v.tracker_timestamp)||!fresh(v.server_received_at)||!v.gps_valid||v.latitude===null||v.longitude===null||!Number.isFinite(v.latitude)||!Number.isFinite(v.longitude)||Math.abs(v.latitude)>90||Math.abs(v.longitude)>180||(v.latitude===0&&v.longitude===0))return {code:'RELAY_GPS_STALE',message:'A valid GPS position received and measured within 60 seconds is required.'};
 if(v.speed!==0||v.current_speed!==0||v.ignition!==false||!fresh(v.heartbeat_at))return {code:'RELAY_NOT_STATIONARY',message:'Stop the vehicle, turn ignition off and wait for fresh zero-speed GPS and an ignition-off heartbeat.'};
 return support;
}
