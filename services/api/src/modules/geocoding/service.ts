import {query} from '../../db/pool.js';
import {env} from '../../config/env.js';
import {logger} from '../../lib/logger.js';
import {coordinateKey,lookupAddress,type AddressResult} from './provider.js';

type Point = Record<string, unknown>;
const pending = new Set<string>();
let queue = Promise.resolve();
let nextRequestAt = 0;
let cooldownUntil = 0;

function schedule(row:Point,key:string) {
  if(pending.has(key) || pending.size>=100 || Date.now()<cooldownUntil) return;
  pending.add(key);
  queue=queue.then(async()=>{
    if(Date.now()<cooldownUntil) return;
    const delay=nextRequestAt-Date.now();
    if(delay>0) await new Promise(resolve=>setTimeout(resolve,delay));
    nextRequestAt=Date.now()+1000;
    const result=await lookupAddress(row.latitude as number,row.longitude as number,env.GEOAPIFY_API_KEY);
    await query(`INSERT INTO reverse_geocode_cache(coordinate_key,address,attribution,expires_at)
      VALUES($1,$2,$3,now()+($4::int*interval '1 second'))
      ON CONFLICT(coordinate_key) DO UPDATE SET address=EXCLUDED.address,attribution=EXCLUDED.attribution,expires_at=EXCLUDED.expires_at`,
    [key,result?.address??null,result?.attribution??null,result?30*86400:300]);
    if(result) await saveAddress(row,result);
  }).catch(()=>{
    // Never log a fetch error/URL: it can contain the provider API key.
    cooldownUntil=Date.now()+60_000;
    logger.warn('Address lookup temporarily unavailable; GPS ingestion continues');
  }).finally(()=>pending.delete(key));
}

async function saveAddress(row:Point,result:AddressResult) {
  if(!row.vehicle_id && !row.id) return;
  // Only annotate this vehicle's fixes at these exact coordinates. Never change
  // coordinates, activity timestamps, device assignments, or tracker status.
  await query(`UPDATE locations SET metadata=metadata||jsonb_build_object('address',$4::text,'address_attribution',$5::text)
    WHERE vehicle_id=$1 AND latitude=$2 AND longitude=$3 AND COALESCE(metadata->>'address','')=''`,
  [row.vehicle_id??row.id,row.latitude,row.longitude,result.address,result.attribution]);
}

/** Only scoped read results enter here. Provider calls run in the background;
 * cached addresses are returned on the next dashboard/mobile refresh. */
export async function enrichAddresses<T extends Point>(rows:T[]):Promise<T[]> {
  if(!env.GEOAPIFY_API_KEY || !rows.length) return rows;
  const keyed=rows.map(row=>({row,key:coordinateKey(row.latitude,row.longitude,row.gps_valid)}));
  const keys=[...new Set(keyed.flatMap(item=>item.key?[item.key]:[]))];
  if(!keys.length) return rows;
  try {
    const cached=await query<{coordinate_key:string;address:string|null;attribution:string|null}>(
      'SELECT coordinate_key,address,attribution FROM reverse_geocode_cache WHERE coordinate_key=ANY($1::text[]) AND expires_at>now()',[keys]);
    const cache=new Map(cached.rows.map(row=>[row.coordinate_key,row]));
    return keyed.map(({row,key})=>{
      if(!key || (typeof row.address==='string' && row.address.trim())) return row;
      const hit=cache.get(key);
      if(!hit) {schedule(row,key);return row;}
      return {...row,address:hit.address,address_attribution:hit.attribution};
    });
  } catch {
    logger.warn('Address cache unavailable; returning vehicle data without enrichment');
    return rows;
  }
}
