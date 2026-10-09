import {dailyMetricsSql} from './daily-metrics.js';
import type {PoolClient} from 'pg';
import {env} from '../../config/env.js';
import {query,transaction} from '../../db/pool.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';
import type {FleetStatus} from '../dashboard/repository.js';

export type Capability='ignition'|'door'|'relay'|'buzzer'|'airCondition'|'parkingAlarm';
export type CapabilityState='SUPPORTED'|'UNSUPPORTED'|'UNKNOWN';
export interface VehicleManagementInput {adminId:string;clientId:string;deviceImei:string;deviceProtocol:'GT06'|'W15'|'';simNumber?:string;simInfo?:string;gpsLocation?:string;simOperator:'Jio'|'Airtel'|'VI'|'';vehicleNumber:string;vehicleType?:string;mileage?:number|null;overspeedLimit?:number|null;coins:number;billingStart?:string;billingDue?:string;alias?:string;remark?:string;active:boolean;autoRenewal:boolean;doorConfigured:boolean;relayConfigured:boolean;buzzerConfigured:boolean;ignitionWiring:'UNKNOWN'|'NOT_CONNECTED'|'CONNECTED_POWER_PLUS';acPowerPlus:boolean;parkingAlarmOnIgnition:boolean}
const withoutTotal=(row:Record<string,unknown>)=>{const copy={...row};delete copy.total_count;return copy};

const fleetCte=`${userScopeCte}, fleet AS (
  SELECT v.id,v.vehicle_number,v.alias,v.vehicle_type,v.image_url,v.remark,v.mileage,v.odometer,v.overspeed_limit,v.owner_id,v.active,v.created_at,v.updated_at,v.coins,v.billing_start,v.billing_due,v.auto_renewal,v.door_configured,v.relay_configured,v.buzzer_configured,v.ignition_wiring,v.ac_power_plus,v.parking_alarm_on_ignition,v.gps_location,d.sim_info,client.role AS owner_role,CASE WHEN client.role='CLIENT' THEN client.name END AS client_name,CASE WHEN client.role='CLIENT' THEN client.email END AS client_email,CASE WHEN client.role='CLIENT' THEN client.username END AS client_username,
    admin.id AS admin_id,admin.name AS admin_name,admin.email AS admin_email,admin.username AS admin_username,
    d.id AS device_id,d.imei,d.protocol,d.model AS device_model,d.sim_number,d.sim_operator,d.sim_type,d.capabilities,CASE WHEN d.last_seen_at>=a.assigned_at THEN d.last_seen_at END AS last_seen_at,
    latest.speed,latest.tracker_timestamp,latest.server_received_at,latest.address,ds.updated_at AS status_since_at,
    today.today_distance_km,today.today_running_seconds,
    CASE WHEN NOT v.active THEN 'INACTIVE' WHEN d.id IS NULL THEN 'NEW'
      WHEN d.last_seen_at IS NULL OR d.last_seen_at<a.assigned_at OR d.last_seen_at<now()-($2::int*interval '1 minute') THEN 'UNREACHABLE'
      WHEN v.overspeed_limit IS NOT NULL AND COALESCE(CASE WHEN ds.updated_at>=a.assigned_at THEN ds.current_speed END,latest.speed,0)>v.overspeed_limit THEN 'OVERSPEED'
      WHEN ds.updated_at>=a.assigned_at AND ds.state='MOVING' THEN 'RUNNING' WHEN ds.updated_at>=a.assigned_at AND ds.state='IDLE' THEN 'IDLE' WHEN ds.updated_at>=a.assigned_at AND ds.state='STOPPED' THEN 'STOPPED' ELSE 'UNREACHABLE' END AS fleet_status
  FROM vehicles v JOIN user_scope scope ON scope.id=v.owner_id
  JOIN users client ON client.id=v.owner_id LEFT JOIN users admin ON admin.id=CASE WHEN client.role='CLIENT' THEN client.owner_id WHEN client.role='ADMIN' THEN client.id END AND admin.role='ADMIN'
  LEFT JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.unassigned_at IS NULL
  LEFT JOIN devices d ON d.id=a.device_id LEFT JOIN device_status ds ON ds.device_id=d.id
  LEFT JOIN LATERAL(SELECT l.speed,l.tracker_timestamp,l.server_received_at,NULLIF(l.metadata->>'address','') AS address FROM locations l WHERE l.vehicle_id=v.id AND l.device_id=d.id AND l.server_received_at>=a.assigned_at ORDER BY l.server_received_at DESC LIMIT 1) latest ON true
  LEFT JOIN LATERAL (${dailyMetricsSql}) today ON true
)`;

export async function listManagedVehicles(actorId:string,filters:{status:FleetStatus;search:string;page:number;pageSize:number;adminId?:string;clientId?:string;deviceType?:string;addedFrom?:Date;addedTo?:Date;modifiedFrom?:Date;modifiedTo?:Date;subscriptionStartFrom?:Date;subscriptionStartTo?:Date;subscriptionDueFrom?:Date;subscriptionDueTo?:Date;inactiveFrom?:Date;inactiveTo?:Date}){
  const values=[actorId,env.NO_SIGNAL_TIMEOUT_MINUTES,env.MOVEMENT_THRESHOLD_KPH,filters.status,`%${filters.search}%`,filters.adminId??null,filters.clientId??null,filters.deviceType??null,filters.addedFrom??null,filters.addedTo??null,filters.modifiedFrom??null,filters.modifiedTo??null,filters.subscriptionStartFrom??null,filters.subscriptionStartTo??null,filters.subscriptionDueFrom??null,filters.subscriptionDueTo??null,filters.inactiveFrom??null,filters.inactiveTo??null,filters.pageSize,(filters.page-1)*filters.pageSize];
  const predicate=`($4='ALL' OR fleet_status=$4) AND ($5='%%' OR vehicle_number ILIKE $5 OR COALESCE(alias,'') ILIKE $5 OR COALESCE(imei,'') ILIKE $5) AND ($6::uuid IS NULL OR admin_id=$6) AND ($7::uuid IS NULL OR owner_id=$7) AND ($8::text IS NULL OR protocol=$8 OR device_model=$8) AND ($9::timestamptz IS NULL OR created_at>=$9) AND ($10::timestamptz IS NULL OR created_at<$10+interval '1 day') AND ($11::timestamptz IS NULL OR updated_at>=$11) AND ($12::timestamptz IS NULL OR updated_at<$12+interval '1 day') AND ($13::date IS NULL OR billing_start>=$13) AND ($14::date IS NULL OR billing_start<=$14) AND ($15::date IS NULL OR billing_due>=$15) AND ($16::date IS NULL OR billing_due<=$16) AND ($17::timestamptz IS NULL OR (NOT active AND updated_at>=$17)) AND ($18::timestamptz IS NULL OR (NOT active AND updated_at<$18+interval '1 day'))`;
  const rows=await query(`${fleetCte} SELECT *,count(*) OVER()::int AS total_count FROM fleet WHERE ${predicate} ORDER BY created_at DESC,id LIMIT $19 OFFSET $20`,values);
  const counts=await query(`${fleetCte} SELECT fleet_status,count(*)::int AS count FROM fleet GROUP BY fleet_status`,[actorId,env.NO_SIGNAL_TIMEOUT_MINUTES,env.MOVEMENT_THRESHOLD_KPH]);
  const mapped:Record<string,number>={ALL:0,OVERSPEED:0,RUNNING:0,IDLE:0,STOPPED:0,UNREACHABLE:0,NEW:0,INACTIVE:0};for(const row of counts.rows){mapped[String(row.fleet_status)]=Number(row.count);mapped.ALL+=Number(row.count)}
  return{rows:rows.rows.map(withoutTotal),total:Number(rows.rows[0]?.total_count??0),counts:mapped};
}

export const managedVehicle=(actorId:string,id:string)=>query(`${fleetCte} SELECT * FROM fleet WHERE id=$4`,[actorId,env.NO_SIGNAL_TIMEOUT_MINUTES,env.MOVEMENT_THRESHOLD_KPH,id]);
export async function deactivateManagedVehicle(actorId:string,id:string){const result=await query(`${userScopeCte} UPDATE vehicles v SET active=false,updated_at=now() FROM user_scope scope WHERE v.id=$2 AND v.owner_id=scope.id RETURNING v.id,v.active,v.updated_at`,[actorId,id]);if(!result.rows[0])throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');return result.rows[0]}
export const vehicleAdminOptions=(actorId:string)=>query(`${userScopeCte} SELECT u.id,u.name,u.username,u.email FROM users u JOIN user_scope s ON s.id=u.id WHERE u.role='ADMIN' AND u.active=true ORDER BY u.name NULLS LAST,u.email`,[actorId]);
export const vehicleClientOptions=(actorId:string,adminId:string)=>query(`${userScopeCte} SELECT c.id,c.name,c.username,c.email,c.owner_id,c.active FROM users c JOIN user_scope s ON s.id=c.id JOIN users a ON a.id=c.owner_id WHERE c.role='CLIENT' AND a.id=$2 AND a.role='ADMIN' ORDER BY c.active DESC,c.name NULLS LAST,c.username NULLS LAST,c.email`,[actorId,adminId]);
export const vehicleDeviceOptions=(actorId:string,clientId:string,search:string)=>query(`${userScopeCte} SELECT d.id,d.imei,d.protocol,d.model,d.sim_number,d.sim_operator,d.sim_type,d.capabilities,EXISTS(SELECT 1 FROM vehicle_device_assignments a WHERE a.device_id=d.id AND a.unassigned_at IS NULL) AS assigned FROM devices d JOIN user_scope s ON s.id=d.owner_id WHERE d.owner_id=$2 AND d.active=true AND ($3='%%' OR d.imei ILIKE $3 OR COALESCE(d.model,'') ILIKE $3 OR d.protocol ILIKE $3) ORDER BY d.imei LIMIT 50`,[actorId,clientId,`%${search}%`]);

/** Run inside a transaction. Both admin updates and client moves preserve history here. */
export async function reassignDevice(client:PoolClient,vehicleId:string,deviceId:string,moveFromVehicleId?:string){
  // This lock also serializes with tracker persistence, which updates the device
  // before resolving its active vehicle assignment.
  await client.query('SELECT id FROM devices WHERE id=$1 FOR UPDATE',[deviceId]);
  const current=await client.query<{vehicle_id:string}>('SELECT vehicle_id FROM vehicle_device_assignments WHERE device_id=$1 AND unassigned_at IS NULL FOR UPDATE',[deviceId]);
  const source=current.rows[0]?.vehicle_id;
  if(source===vehicleId)return;
  if(source&&source!==moveFromVehicleId)throw new AppError(409,'DEVICE_ASSIGNED','Tracker is assigned to another vehicle. Confirm the move first.');
  if(moveFromVehicleId&&source!==moveFromVehicleId)throw new AppError(409,'ASSIGNMENT_CHANGED','Tracker assignment changed. Refresh and confirm the move again.');
  // Lock the outgoing device too, so no packet can be attributed across the swap.
  await client.query('SELECT d.id FROM devices d JOIN vehicle_device_assignments a ON a.device_id=d.id WHERE a.vehicle_id=$1 AND a.unassigned_at IS NULL ORDER BY d.id FOR UPDATE OF d',[vehicleId]);
  await client.query('UPDATE vehicle_device_assignments SET unassigned_at=clock_timestamp() WHERE unassigned_at IS NULL AND (vehicle_id=$1 OR device_id=$2)',[vehicleId,deviceId]);
  await client.query('INSERT INTO vehicle_device_assignments(vehicle_id,device_id,assigned_at) VALUES($1,$2,clock_timestamp())',[vehicleId,deviceId]);
}

// No IMEI or protocol is sent to client screens. Opaque IDs + SIM/model/vehicle
// labels identify their own hardware without revealing registration fields.
export const clientDevices=(ownerId:string)=>query(`SELECT d.id,d.model,d.sim_number,d.sim_operator,d.sim_info,v.id AS vehicle_id,v.vehicle_number
  FROM devices d LEFT JOIN vehicle_device_assignments a ON a.device_id=d.id AND a.unassigned_at IS NULL
  LEFT JOIN vehicles v ON v.id=a.vehicle_id AND v.owner_id=$1
  WHERE d.owner_id=$1 AND d.active=true ORDER BY d.model NULLS LAST,d.sim_number NULLS LAST,d.id`,[ownerId]);

export async function clientVehicle(ownerId:string,id:string){
  const result=await managedVehicle(ownerId,id);
  const row=result.rows[0];
  if(!row||row.owner_id!==ownerId)throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');
  return row;
}

export async function reassignClientDevice(ownerId:string,vehicleId:string,deviceId:string,moveFromVehicleId?:string){
  return transaction(async client=>{
    const targets=await client.query<{id:string}>('SELECT id FROM vehicles WHERE id=ANY($1::uuid[]) AND owner_id=$2 ORDER BY id FOR UPDATE',[[vehicleId,...(moveFromVehicleId?[moveFromVehicleId]:[])],ownerId]);
    if(!targets.rows.some(row=>row.id===vehicleId)||(moveFromVehicleId&&!targets.rows.some(row=>row.id===moveFromVehicleId)))throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');
    const device=await client.query('SELECT id FROM devices WHERE id=$1 AND owner_id=$2 AND active=true FOR UPDATE',[deviceId,ownerId]);
    if(!device.rows[0])throw new AppError(404,'DEVICE_NOT_FOUND','Tracker not found');
    // Even a malformed legacy assignment cannot be used to move a foreign vehicle.
    const assignment=await client.query<{owner_id:string}>('SELECT v.owner_id FROM vehicle_device_assignments a JOIN vehicles v ON v.id=a.vehicle_id WHERE a.device_id=$1 AND a.unassigned_at IS NULL',[deviceId]);
    if(assignment.rows[0]&&assignment.rows[0].owner_id!==ownerId)throw new AppError(404,'DEVICE_NOT_FOUND','Tracker not found');
    await reassignDevice(client,vehicleId,deviceId,moveFromVehicleId);
    return {id:vehicleId,device_id:deviceId};
  });
}

export async function updateClientDeviceSim(ownerId:string,id:string,input:{simNumber?:string;simOperator?:string;simInfo?:string}){
  return transaction(async client=>{
    const device=await client.query('SELECT id FROM devices WHERE id=$1 AND owner_id=$2 FOR UPDATE',[id,ownerId]);
    if(!device.rows[0])throw new AppError(404,'DEVICE_NOT_FOUND','Tracker not found');
    const result=await client.query(`UPDATE devices SET
      sim_number=CASE WHEN $3 THEN $4 ELSE sim_number END,
      sim_operator=CASE WHEN $5 THEN $6 ELSE sim_operator END,
      sim_info=CASE WHEN $7 THEN $8 ELSE sim_info END,updated_at=now()
      WHERE id=$1 AND owner_id=$2 RETURNING id,sim_number,sim_operator,sim_info`,
      [id,ownerId,input.simNumber!==undefined,input.simNumber?.trim()||null,input.simOperator!==undefined,input.simOperator??null,input.simInfo!==undefined,input.simInfo?.trim()||null]);
    return result.rows[0];
  });
}

function capabilityState(capabilities:unknown,key:Capability):CapabilityState{if(!capabilities||typeof capabilities!=='object')return'UNKNOWN';const value=(capabilities as Record<string,unknown>)[key];return value==='SUPPORTED'||value===true?'SUPPORTED':value==='UNSUPPORTED'||value===false?'UNSUPPORTED':'UNKNOWN'}
function validateCapabilities(input:VehicleManagementInput,capabilities:unknown){const required:[boolean,Capability,string][]=[[input.doorConfigured,'door','Door'],[input.relayConfigured,'relay','Relay'],[input.buzzerConfigured,'buzzer','Buzzer'],[input.ignitionWiring!=='UNKNOWN','ignition','Ignition wiring'],[input.acPowerPlus,'airCondition','Air-condition wiring'],[input.parkingAlarmOnIgnition,'parkingAlarm','Parking alarm']];for(const[enabled,key,label]of required)if(enabled&&capabilityState(capabilities,key)==='UNSUPPORTED')throw new AppError(400,'UNSUPPORTED_CAPABILITY',`${label} is not supported by the selected device`)}

async function validateRelations(client:PoolClient,actorId:string,input:VehicleManagementInput,existingVehicleId?:string){const relation=await client.query(`${userScopeCte} SELECT c.id FROM users c JOIN user_scope s ON s.id=c.id JOIN users a ON a.id=$2 WHERE c.id=$3 AND a.role='ADMIN' AND a.active=true AND ((c.role='CLIENT' AND c.owner_id=a.id) OR (c.role='ADMIN' AND c.id=a.id AND EXISTS(SELECT 1 FROM vehicles v WHERE v.id=$4 AND v.owner_id=c.id)))`,[actorId,input.adminId,input.clientId,existingVehicleId??null]);if(!relation.rows[0])throw new AppError(403,'INVALID_VEHICLE_OWNER','Admin and Client relationship is outside your authorized hierarchy')}

const protocolCapabilities=(protocol:VehicleManagementInput['deviceProtocol'])=>protocol==='GT06'?{ignition:'SUPPORTED'}:{};
async function provisionDevice(client:PoolClient,input:VehicleManagementInput,transferableDeviceId?:string){
  if(!input.deviceProtocol||!input.simOperator)throw new AppError(400,'DEVICE_CONFIGURATION_REQUIRED','Choose the device type and SIM operator');
  const imei=input.deviceImei.trim();
  const existing=await client.query<{id:string;owner_id:string|null;protocol:string;capabilities:unknown}>('SELECT id,owner_id,protocol,capabilities FROM devices WHERE imei=$1 FOR UPDATE',[imei]);
  if(existing.rows[0]&&existing.rows[0].owner_id!==input.clientId&&existing.rows[0].id!==transferableDeviceId)throw new AppError(403,'INVALID_DEVICE','IMEI is already registered to another Client');
  if(existing.rows[0]){
    const capabilities=existing.rows[0].protocol===input.deviceProtocol?existing.rows[0].capabilities:protocolCapabilities(input.deviceProtocol);
    const updated=await client.query<{id:string;capabilities:unknown}>('UPDATE devices SET protocol=$2,identity_type=\'IMEI\',identity_value=$1,owner_id=$3,sim_number=$4,sim_operator=$5,capabilities=$6,active=true,updated_at=now(),sim_info=$8 WHERE id=$7 RETURNING id,capabilities',[imei,input.deviceProtocol,input.clientId,input.simNumber?.trim()||null,input.simOperator,JSON.stringify(capabilities),existing.rows[0].id,input.simInfo?.trim()||null]);
    return updated.rows[0];
  }
  const created=await client.query<{id:string;capabilities:unknown}>('INSERT INTO devices(imei,protocol,identity_type,identity_value,owner_id,sim_number,sim_operator,capabilities,sim_info) VALUES($1,$2,\'IMEI\',$1,$3,$4,$5,$6,$7) RETURNING id,capabilities',[imei,input.deviceProtocol,input.clientId,input.simNumber?.trim()||null,input.simOperator,JSON.stringify(protocolCapabilities(input.deviceProtocol)),input.simInfo?.trim()||null]);
  return created.rows[0];
}
const values=(input:VehicleManagementInput)=>[input.vehicleNumber.trim(),input.vehicleType?.trim()||null,input.mileage??null,input.overspeedLimit??null,input.clientId,input.coins,input.billingStart||null,input.billingDue||null,input.alias?.trim()||null,input.remark?.trim()||null,input.active,input.autoRenewal,input.doorConfigured,input.relayConfigured,input.buzzerConfigured,input.ignitionWiring,input.acPowerPlus,input.parkingAlarmOnIgnition,input.simInfo?.trim()||null,input.gpsLocation?.trim()||null];

export async function createManagedVehicle(actorId:string,input:VehicleManagementInput){return transaction(async client=>{await validateRelations(client,actorId,input);const device=await provisionDevice(client,input);validateCapabilities(input,device.capabilities);if((await client.query('SELECT 1 FROM vehicle_device_assignments WHERE device_id=$1 AND unassigned_at IS NULL',[device.id])).rows[0])throw new AppError(409,'DEVICE_ASSIGNED','Device IMEI already has an active vehicle assignment');try{const created=await client.query(`INSERT INTO vehicles(vehicle_number,vehicle_type,mileage,overspeed_limit,owner_id,coins,billing_start,billing_due,alias,remark,active,auto_renewal,door_configured,relay_configured,buzzer_configured,ignition_wiring,ac_power_plus,parking_alarm_on_ignition,sim_info,gps_location) VALUES(${values(input).map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,values(input));await client.query('INSERT INTO vehicle_device_assignments(vehicle_id,device_id) VALUES($1,$2)',[created.rows[0].id,device.id]);return created.rows[0]}catch(error){if(error&&typeof error==='object'&&'code'in error&&(error as{code:string}).code==='23505')throw new AppError(409,'VEHICLE_CONFLICT','Vehicle number or device IMEI already exists');throw error}})}

export async function updateManagedVehicle(actorId:string,id:string,input:VehicleManagementInput){return transaction(async client=>{await validateRelations(client,actorId,input,id);const visible=await client.query(`${userScopeCte} SELECT v.id FROM vehicles v JOIN user_scope s ON s.id=v.owner_id WHERE v.id=$2 FOR UPDATE OF v`,[actorId,id]);if(!visible.rows[0])throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');const assigned=await client.query('SELECT device_id FROM vehicle_device_assignments WHERE vehicle_id=$1 AND unassigned_at IS NULL',[id]);const oldDevice=assigned.rows[0]?.device_id as string|undefined;const transferable=oldDevice?(await client.query(`${userScopeCte} SELECT d.id FROM devices d JOIN user_scope s ON s.id=d.owner_id WHERE d.id=$2`,[actorId,oldDevice])).rows[0]?.id as string|undefined:undefined;const device=input.deviceImei?await provisionDevice(client,input,transferable):null;if(!device&&oldDevice)throw new AppError(400,'DEVICE_REQUIRED','Keep the assigned IMEI or choose a replacement');if(device)validateCapabilities(input,device.capabilities);try{const params=[...values(input),id];const updated=await client.query(`UPDATE vehicles SET vehicle_number=$1,vehicle_type=$2,mileage=$3,overspeed_limit=$4,owner_id=$5,coins=$6,billing_start=$7,billing_due=$8,alias=$9,remark=$10,active=$11,auto_renewal=$12,door_configured=$13,relay_configured=$14,buzzer_configured=$15,ignition_wiring=$16,ac_power_plus=$17,parking_alarm_on_ignition=$18,sim_info=$19,gps_location=$20,updated_at=now() WHERE id=$21 RETURNING *`,params);if(device)await reassignDevice(client,id,device.id);return updated.rows[0]}catch(error){if(error&&typeof error==='object'&&'code'in error&&(error as{code:string}).code==='23505')throw new AppError(409,'VEHICLE_CONFLICT','Vehicle number or device IMEI already exists');throw error}})}
