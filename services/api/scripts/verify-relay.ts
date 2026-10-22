import {mkdir,writeFile,readdir} from 'node:fs/promises';
import {pool} from '../src/db/pool.js';
import {vehicleRelay} from '../src/modules/vehicles/relay.js';
const folder=new URL('../../../artifacts/relay/',import.meta.url);
const client=await pool.connect();
try{
 await client.query('BEGIN READ ONLY');
 const applied=(await client.query<{name:string}>('SELECT name FROM schema_migrations ORDER BY name')).rows.map(row=>row.name);
 const pending=(await readdir(new URL('../../../database/migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')&&!applied.includes(name));
 const vehicles=(await client.query(`SELECT v.id,v.owner_id,v.vehicle_number,v.vehicle_type,v.active,v.relay_configured,d.protocol,d.model,
  d.capabilities->>'relay' AS device_relay_capability,d.active AS device_active,d.last_seen_at,
  (SELECT max(l.server_received_at) FROM locations l WHERE l.vehicle_id=v.id AND l.device_id=d.id AND l.server_received_at>=a.assigned_at) AS last_gps_received
 FROM vehicles v LEFT JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.unassigned_at IS NULL
 LEFT JOIN devices d ON d.id=a.device_id ORDER BY v.vehicle_number`)).rows;
 await client.query('ROLLBACK');
 // Only SELECT APIs are used. No command attempts or GPS records are created.
 const responses=[];
 if(!pending.includes('028_vehicle_relay_commands.sql')){
  // All pool connections are read only, including the scoped API read below.
  await pool.query('SET default_transaction_read_only=on');
  pool.on('connect',connection=>{void connection.query('SET default_transaction_read_only=on');});
  for(const v of vehicles){const result=await vehicleRelay(v.owner_id,v.id);responses.push({vehicleNumber:result.vehicleNumber,configured:result.configured,state:result.state,canLock:result.canLock,canUnlock:result.canUnlock,code:result.code,message:result.message});}
 }
 const evidence={verifiedAt:new Date().toISOString(),pendingMigrations:pending,vehicles:vehicles.map(({id,owner_id,...publicFields})=>{void id;void owner_id;return publicFields;}),responses,physicalCommandsSent:0};
 await mkdir(folder,{recursive:true});await writeFile(new URL('verification.json',folder),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence,null,2));
}finally{client.release();await pool.end();}
