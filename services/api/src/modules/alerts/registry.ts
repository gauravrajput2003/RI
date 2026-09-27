export const ALERT_EVENTS=[
 {type:'VEHICLE_RUNNING',label:'Vehicle is Running',source:'Current vehicle state transitions to MOVING.'},
 {type:'VEHICLE_IDLE',label:'Vehicle is Idle',source:'Current vehicle state transitions to IDLE.'},
 {type:'VEHICLE_STOPPED',label:'Vehicle has Stopped',source:'Current vehicle state transitions to STOPPED.'},
 {type:'VEHICLE_OVERSPEED',label:'Vehicle is Overspeeding',source:'Telemetry speed crosses the vehicle overspeed limit.'},
 {type:'VEHICLE_UNREACHABLE',label:'Vehicle is Unreachable',source:'The assigned device exceeds the configured no-signal timeout.'},
 {type:'VEHICLE_ONLINE',label:'Vehicle is Online',source:'Telemetry resumes after an unreachable transition.'},
 {type:'AC_ON',label:'AC is On',source:'Supported telemetry AC state changes to on.'},
 {type:'AC_OFF',label:'AC is Off',source:'Supported telemetry AC state changes to off.'},
 {type:'DOOR_OPENED',label:'Door Opened',source:'Configured door telemetry changes to open.'},
 {type:'DOOR_CLOSED',label:'Door Closed',source:'Configured door telemetry changes to closed.'},
 {type:'GEOFENCE_IN',label:'Geofence In',source:'PostGIS position evaluation changes from outside to inside.'},
 {type:'GEOFENCE_OUT',label:'Geofence Out',source:'PostGIS position evaluation changes from inside to outside.'},
 {type:'SUBSCRIPTION_EXPIRED',label:'Subscription has Expired',source:'The persisted subscription status or end date becomes expired.'},
 {type:'SUBSCRIPTION_RENEWED',label:'Subscription has Renewed',source:'A previously expired persisted subscription becomes active with a valid end date.'},
] as const;
export type AlertEventType=typeof ALERT_EVENTS[number]['type'];
export const alertEventTypes=ALERT_EVENTS.map(event=>event.type) as [AlertEventType,...AlertEventType[]];
export const isAlertEventType=(value:string):value is AlertEventType=>ALERT_EVENTS.some(event=>event.type===value);
