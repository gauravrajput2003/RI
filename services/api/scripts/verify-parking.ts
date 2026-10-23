import {mkdir,writeFile} from 'node:fs/promises';
import {pool} from '../src/db/pool.js';
import {parkingStatus} from '../src/modules/parking/service.js';
const folder=new URL('../../../artifacts/parking/',import.meta.url);
try{
 await pool.query('SET default_transaction_read_only=on');pool.on('connect',client=>{void client.query('SET default_transaction_read_only=on');});
 const vehicles=(await pool.query('SELECT v.id,v.owner_id,v.vehicle_number FROM vehicles v JOIN users u ON u.id=v.owner_id WHERE u.active ORDER BY v.vehicle_number')).rows;
 const responses=[];
 for(const vehicle of vehicles){const result=await parkingStatus(vehicle.owner_id,vehicle.id);responses.push({vehicleNumber:result.vehicleNumber,enabled:result.enabled,canEnable:result.canEnable,monitoring:result.monitoring,pushAvailable:result.pushAvailable,reference:result.reference,message:result.message});}
 const push=(await pool.query("SELECT count(*)::int AS registered_devices,count(*) FILTER(WHERE enabled AND expo_token IS NOT NULL)::int AS enabled_push_tokens FROM mobile_push_devices")).rows[0];
 const counts=(await pool.query('SELECT (SELECT count(*)::int FROM parking_modes) AS parking_configurations,(SELECT count(*)::int FROM notification_history WHERE event_type LIKE \'PARKING_%\') AS parking_events')).rows[0];
 const migrations=(await pool.query("SELECT name FROM schema_migrations WHERE name IN ('029_parking_mode.sql','030_parking_reference_accuracy.sql') ORDER BY name")).rows.map(row=>row.name);
 const evidence={migrations,verifiedAt:new Date().toISOString(),responses,push,counts,verification:'Read-only persisted configuration and scoped service reads; no activation, telemetry writes or notification sends.'};
 await mkdir(folder,{recursive:true});await writeFile(new URL('verification.json',folder),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{await pool.end();}
