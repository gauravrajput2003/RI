import {query} from '../../db/pool.js';
import {env} from '../../config/env.js';
import {logger} from '../../lib/logger.js';
import {enrichAddresses} from '../geocoding/service.js';
import {lookupAddress} from '../geocoding/provider.js';
import {reportedCell,cellKey,lookupCell,type Cell} from './provider.js';

type Point=Record<string,unknown>;
type Cached={cell_key:string;latitude:number|null;longitude:number|null;accuracy_m:number|null;address:string|null;attribution:string|null;lookup_status?:string;resolved_at:Date|string;expires_at:Date|string};
const pending=new Set<string>();let queue=Promise.resolve(),nextRequestAt=0,cooldownUntil=0;
function schedule(cell:Cell){
  const key=cellKey(cell);
  if(pending.has(key)||pending.size>=100||Date.now()<cooldownUntil)return;
  pending.add(key);
  queue=queue.then(async()=>{
    if(Date.now()<cooldownUntil)return;
    const delay=nextRequestAt-Date.now();if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));nextRequestAt=Date.now()+1000;
    const estimate=await lookupCell(cell,env.OPENCELLID_API_KEY);
    let address:string|null=null;
    if(estimate&&env.GEOAPIFY_API_KEY){
      try {address=(await lookupAddress(estimate.latitude,estimate.longitude,env.GEOAPIFY_API_KEY,fetch,'street'))?.address??null;}catch { /* Keep the cell estimate; never substitute GPS. */ }
    }
    await query(`INSERT INTO cell_location_cache(cell_key,latitude,longitude,accuracy_m,address,attribution,lookup_status,resolved_at,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$8,now(),now()+($7::int*interval '1 second'))
      ON CONFLICT(cell_key) DO UPDATE SET latitude=COALESCE(EXCLUDED.latitude,cell_location_cache.latitude),longitude=COALESCE(EXCLUDED.longitude,cell_location_cache.longitude),accuracy_m=COALESCE(EXCLUDED.accuracy_m,cell_location_cache.accuracy_m),
      address=CASE WHEN EXCLUDED.latitude IS NULL THEN cell_location_cache.address
        WHEN EXCLUDED.latitude IS NOT DISTINCT FROM cell_location_cache.latitude AND EXCLUDED.longitude IS NOT DISTINCT FROM cell_location_cache.longitude
          THEN COALESCE(EXCLUDED.address,cell_location_cache.address) ELSE EXCLUDED.address END,
      attribution=COALESCE(EXCLUDED.attribution,cell_location_cache.attribution),
      lookup_status=EXCLUDED.lookup_status,resolved_at=CASE WHEN EXCLUDED.latitude IS NOT NULL THEN EXCLUDED.resolved_at ELSE cell_location_cache.resolved_at END,expires_at=EXCLUDED.expires_at`,
    [key,estimate?.latitude??null,estimate?.longitude??null,estimate?.accuracy_m??null,address,
      estimate?'OpenCellID (https://opencellid.org/) · CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)'+(address?' · Geoapify · © OpenStreetMap contributors':''):null,estimate?(address?30*86400:3600):300,estimate?'resolved':'not_found']);
  }).catch(()=>{cooldownUntil=Date.now()+60_000;logger.warn('Cell lookup temporarily unavailable; GPS ingestion continues');}).finally(()=>pending.delete(key));
}

/** Called only after ownership-scoped queries. Historical rows use their own
 * cell observations; live rows expire 30 minutes after the last cell packet. */
export async function displayedAddresses<T extends Point>(rows:T[],historical=false):Promise<T[]> {
  if(env.ADDRESS_SOURCE!=='cell'){
    const gpsRows=historical?rows.map(row=>({...row,address:row.address??(row.metadata as Point|undefined)?.address??null})):await enrichAddresses(rows);
    return gpsRows.map(row=>({...row,address_source:'gps',gps_address:row.address??null}));
  }
  const items=rows.map(row=>({row,cell:reportedCell(row.cellular_metadata??row.metadata,row.cell_protocol??row.protocol,env.GT06_CELL_RADIO)}));
  const keys=[...new Set(items.flatMap(({cell})=>cell?.radio?[cellKey(cell)]:[]))];
  let cache=new Map<string,Cached>();
  try {if(keys.length)cache=new Map((await query<Cached>('SELECT * FROM cell_location_cache WHERE cell_key=ANY($1::text[])',[keys])).rows.map(hit=>[hit.cell_key,hit]));}catch {logger.warn('Cell cache unavailable');}
  return items.map(({row,cell})=>{
    const observed=row.cell_observed_at??row.server_received_at;
    const age=Date.now()-new Date(observed as string).getTime();
    const hit=cell?.radio?cache.get(cellKey(cell)):undefined;
    const observationFresh=historical||Number.isFinite(age)&&age>=-60_000&&age<=30*60_000;
    const cacheFresh=hit&&new Date(hit.expires_at).getTime()>Date.now();
    const status=!cell?'missing_cell':!observationFresh?'stale':!cell.radio?'radio_required':!env.OPENCELLID_API_KEY?'unconfigured':!cacheFresh?'pending':hit.lookup_status==='not_found'||hit.latitude==null?'not_found':!hit.address?'address_unavailable':'resolved';
    if(cell?.radio&&observationFresh&&env.OPENCELLID_API_KEY&&!cacheFresh)schedule(cell);
    const metadata=row.metadata as Record<string,unknown>|undefined;
    return {...row,gps_address:row.address??metadata?.address??null,address_source:status==='resolved'?'cell':'unavailable',
      address:status==='resolved'?`Cell area (approx.): ${hit!.address}`:`Cell area unavailable (${status.replaceAll('_',' ')})`,
      address_attribution:status==='resolved'?hit!.attribution:null,
      tower_status:status,tower_cell:cell,tower_observed_at:observed??null,
      tower_location:hit?.latitude!=null?{latitude:hit.latitude,longitude:hit.longitude,accuracy_m:hit.accuracy_m,resolved_at:hit.resolved_at,provider:'OpenCellID',attribution:{text:'Cell data from OpenCellID',source:'https://opencellid.org/',license:'https://creativecommons.org/licenses/by-sa/4.0/'}}:null} as T;
  });
}
