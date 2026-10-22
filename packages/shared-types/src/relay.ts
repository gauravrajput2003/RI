export type RelayAction='lock'|'unlock';
export type RelayCommandStatus='pending'|'sent'|'succeeded'|'failed'|'timed_out'|'rejected';
export interface RelayCommand {
 id:string;vehicleId:string;action:RelayAction;status:RelayCommandStatus;
 code:string;message:string;createdAt:string;
}
export interface VehicleRelay {
 vehicleId:string;vehicleNumber:string;vehicleType:string|null;configured:boolean;
 protocol:string|null;state:'unknown';stateMessage:string;
 canLock:boolean;canUnlock:boolean;code:string;message:string;
 history:RelayCommand[];requestKey:string;
}
/** No registered adapter has verified model/firmware commands, safe operating
 * restrictions, downstream routing or relay-result parsing. A database flag
 * must never enable physical dispatch. Add support only with verified evidence. */
export function relayProtocolSupport(protocol:string|null):{supported:false;code:string;message:string}{
 return {supported:false,code:'RELAY_UNSUPPORTED',message:protocol==='GT06'||protocol==='W15'
  ?'This tracker does not support verified remote relay control in this server. Its command syntax, safety restrictions and result handling have not been verified.'
  :'This tracker does not support remote relay control.'};
}
