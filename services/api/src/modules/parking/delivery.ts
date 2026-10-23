import {transaction} from '../../db/pool.js';
import {env} from '../../config/env.js';
import {pointQuality,type ParkingPoint} from './policy.js';
/** Linearize delivery with disable/update: a disabling save waits for an already
 * started transport; after that save commits no new delivery can start. */
export async function withParkingDelivery(payload:Record<string,unknown>,send:()=>Promise<void>){
 return transaction(async client=>{
  const vehicle=(await client.query<{owner_id:string;active:boolean}>('SELECT owner_id,active FROM vehicles WHERE id=$1 FOR SHARE',[payload.vehicleId])).rows[0];
  if(!vehicle?.active)return false;
  const p=(await client.query<{enabled:boolean;version:number;owner_id:string;device_id:string;assignment_id:string;boundary_state:string;outside_count:number;movement_id:string|null;last_point:ParkingPoint|null;quality_ok:boolean;radius_m:number}>('SELECT * FROM parking_modes WHERE vehicle_id=$1 FOR UPDATE',[payload.vehicleId])).rows[0];
  if(!p?.enabled||p.version!==payload.parkingVersion||p.owner_id!==vehicle.owner_id||!p.quality_ok||!p.last_point)return false;
  if(payload.eventType==='PARKING_RETURNED'?p.boundary_state!=='inside':p.boundary_state!=='outside'||p.movement_id!==payload.movementId)return false;
  const now=new Date(),policy={maxAgeSeconds:env.PARKING_GPS_MAX_AGE_SECONDS??120,consecutive:env.PARKING_CONSECUTIVE_READINGS??3,hysteresisMeters:env.PARKING_HYSTERESIS_METERS??5};
  if(!pointQuality(p.last_point,now,p.radius_m,policy)||(payload.eventType!=='PARKING_RETURNED'&&p.outside_count<policy.consecutive))return false;
  const assigned=(await client.query(`SELECT 1 FROM vehicle_device_assignments a JOIN devices d ON d.id=a.device_id
   WHERE a.id=$1 AND a.vehicle_id=$2 AND a.device_id=$3 AND a.unassigned_at IS NULL AND d.active AND d.owner_id=$4 AND d.last_seen_at>=now()-($5::int*interval '1 second')
   AND (SELECT count(*) FROM vehicle_device_assignments WHERE vehicle_id=$2 AND unassigned_at IS NULL)=1`,[p.assignment_id,payload.vehicleId,p.device_id,vehicle.owner_id,policy.maxAgeSeconds])).rows[0];
  if(!assigned)return false;await send();return true;
 });
}
