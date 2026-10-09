import type {PoolClient} from 'pg';
import type {NormalizedLocation,DeviceState} from '@fleet/shared-types';
type StateDatabase=Pick<PoolClient,'query'>;

export function derivedState(location:Pick<NormalizedLocation,'speed'|'ignition'|'gpsValid'>,threshold:number):DeviceState {
  return location.gpsValid && location.speed!==null && location.speed>threshold ? 'MOVING'
    : location.ignition===true ? 'IDLE' : location.ignition===false ? 'STOPPED' : 'ONLINE';
}
export function heartbeatState(metadata:Record<string,unknown>):{ignition:boolean|null;gsmSignal:number|null;speed:number|null;state:DeviceState} {
  const ignition=typeof metadata.ignition==='boolean'?metadata.ignition:null;
  const gsmSignal=typeof metadata.gsmSignal==='number'?metadata.gsmSignal:null;
  return {ignition,gsmSignal,speed:ignition===false?0:null,state:ignition===false?'STOPPED':ignition===true?'IDLE':'ONLINE'};
}

/** Ordinary GT06 locations omit ACC. Derive state from merged values so a
 * stationary fix retains the heartbeat's ACC. Invalid GPS cannot prove motion. */
export async function mergeCurrentLocation(client:StateDatabase,deviceId:string,location:NormalizedLocation,threshold:number):Promise<DeviceState> {
  const state=derivedState(location,threshold);
  const result=await client.query<{state:DeviceState}>(`INSERT INTO device_status(device_id,state,last_location_at,connected_at,current_position,current_speed,current_ignition,current_gps_valid,current_satellites,current_battery_percent,current_gsm_signal,updated_at)
    VALUES($1,$2,$3,now(),CASE WHEN $4::double precision IS NULL OR $5::double precision IS NULL OR NOT $8 THEN NULL ELSE ST_SetSRID(ST_MakePoint($5,$4),4326)::geography END,$6,$7,$8,$9,$10,$11,now())
    ON CONFLICT(device_id) DO UPDATE SET
    state=CASE WHEN EXCLUDED.current_gps_valid AND EXCLUDED.current_speed>$12 THEN 'MOVING'
      WHEN COALESCE(EXCLUDED.current_ignition,device_status.current_ignition)=true THEN 'IDLE'
      WHEN COALESCE(EXCLUDED.current_ignition,device_status.current_ignition)=false THEN 'STOPPED' ELSE 'ONLINE' END::device_connection_state,
    last_location_at=EXCLUDED.last_location_at,current_position=COALESCE(EXCLUDED.current_position,device_status.current_position),
    current_speed=EXCLUDED.current_speed,current_ignition=COALESCE(EXCLUDED.current_ignition,device_status.current_ignition),
    current_gps_valid=EXCLUDED.current_gps_valid,current_satellites=COALESCE(EXCLUDED.current_satellites,device_status.current_satellites),
    current_battery_percent=COALESCE(EXCLUDED.current_battery_percent,device_status.current_battery_percent),
    current_gsm_signal=COALESCE(EXCLUDED.current_gsm_signal,device_status.current_gsm_signal),updated_at=now() RETURNING state`,
  [deviceId,state,location.serverReceivedAt,location.latitude,location.longitude,location.gpsValid?location.speed:null,location.ignition,location.gpsValid,location.satellites,location.batteryPercent,location.gsmSignal,threshold]);
  return result.rows[0].state;
}

export async function mergeHeartbeat(client:StateDatabase,identity:string,at:Date,metadata:Record<string,unknown>,threshold:number) {
  const update=heartbeatState(metadata);
  await client.query('UPDATE devices SET last_seen_at=$2,last_heartbeat_at=$2,updated_at=now() WHERE identity_type=$1 AND identity_value=$3 AND active=true',['IMEI',at,identity]);
  return client.query(`INSERT INTO device_status(device_id,state,last_heartbeat_at,current_ignition,current_speed,current_gsm_signal,updated_at)
    SELECT id,$4,$2,$5,$6,$7,now() FROM devices WHERE identity_type=$1 AND identity_value=$3 AND active=true
    ON CONFLICT(device_id) DO UPDATE SET state=CASE
      WHEN EXCLUDED.current_ignition IS NULL THEN device_status.state
      WHEN EXCLUDED.current_ignition=false THEN 'STOPPED'
      WHEN device_status.last_location_at<$2::timestamptz-interval '2 minutes' AND device_status.current_speed>$8 THEN 'ONLINE'
      WHEN device_status.current_gps_valid AND device_status.current_speed>$8 THEN 'MOVING'
      ELSE 'IDLE' END,
    last_heartbeat_at=EXCLUDED.last_heartbeat_at,current_ignition=COALESCE(EXCLUDED.current_ignition,device_status.current_ignition),
    current_speed=COALESCE(EXCLUDED.current_speed,device_status.current_speed),
    current_gsm_signal=COALESCE(EXCLUDED.current_gsm_signal,device_status.current_gsm_signal),updated_at=now()`,
  ['IMEI',at,identity,update.state,update.ignition,update.speed,update.gsmSignal,threshold]);
}
