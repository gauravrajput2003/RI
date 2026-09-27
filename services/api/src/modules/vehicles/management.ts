import type {PoolClient} from 'pg';
import {env} from '../../config/env.js';
import {query,transaction} from '../../db/pool.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';
import type {FleetStatus} from '../dashboard/repository.js';

export type Capability='ignition'|'door'|'relay'|'buzzer'|'airCondition'|'parkingAlarm';
export type CapabilityState='SUPPORTED'|'UNSUPPORTED'|'UNKNOWN';
export interface VehicleManagementInput {adminId:string;clientId:string;deviceImei:string;deviceProtocol:'GT06'|'W15';simNumber?:string;simOperator:'Jio'|'Airtel'|'VI';vehicleNumber:string;vehicleType?:string;mileage?:number;overspeedLimit?:number;coins:number;billingStart?:string;billingDue?:string;alias?:string;remark?:string;active:boolean;autoRenewal:boolean;doorConfigured:boolean;relayConfigured:boolean;buzzerConfigured:boolean;ignitionWiring:'UNKNOWN'|'NOT_CONNECTED'|'CONNECTED_POWER_PLUS';acPowerPlus:boolean;parkingAlarmOnIgnition:boolean}
const withoutTotal=(row:Record<string,unknown>)=>{const copy={...row};delete copy.total_count;return copy};

const fleetCte=`${userScopeCte}, fleet AS (
  SELECT v.*,client.name AS client_name,client.email AS client_email,client.username AS client_username,
    admin.id AS admin_id,admin.name AS admin_name,admin.email AS admin_email,admin.username AS admin_username,
    d.id AS device_id,d.imei,d.protocol,d.model AS device_model,d.sim_number,d.sim_operator,d.sim_type,d.capabilities,CASE WHEN d.last_seen_at>=a.assigned_at THEN d.last_seen_at END AS last_seen_at,
    latest.speed,latest.tracker_timestamp,latest.server_received_at,latest.address,ds.updated_at AS status_since_at,
    today.today_distance_km,today.today_running_seconds,
    CASE WHEN NOT v.active THEN 'INACTIVE' WHEN d.id IS NULL THEN 'NEW'
      WHEN d.last_seen_at IS NULL OR d.last_seen_at<a.assigned_at OR d.last_seen_at<now()-($2::int*interval '1 minute') THEN 'UNREACHABLE'
      WHEN v.overspeed_limit IS NOT NULL AND COALESCE(latest.speed,CASE WHEN ds.updated_at>=a.assigned_at THEN ds.current_speed END,0)>v.overspeed_limit THEN 'OVERSPEED'
      WHEN ds.updated_at>=a.assigned_at AND ds.state='MOVING' THEN 'RUNNING' WHEN ds.updated_at>=a.assigned_at AND ds.state='IDLE' THEN 'IDLE' WHEN ds.updated_at>=a.assigned_at AND ds.state='STOPPED' THEN 'STOPPED' ELSE 'UNREACHABLE' END AS fleet_status
  FROM vehicles v JOIN user_scope scope ON scope.id=v.owner_id
  JOIN users client ON client.id=v.owner_id AND client.role='CLIENT' JOIN users admin ON admin.id=client.owner_id AND admin.role='ADMIN'
  LEFT JOIN vehicle_device_assignments a ON a.vehicle_id=v.id AND a.unassigned_at IS NULL
  LEFT JOIN devices d ON d.id=a.device_id LEFT JOIN device_status ds ON ds.device_id=d.id
  LEFT JOIN LATERAL(SELECT l.speed,l.tracker_timestamp,l.server_received_at,NULLIF(l.metadata->>'address','') AS address FROM locations l WHERE l.vehicle_id=v.id AND l.device_id=d.id AND l.server_received_at>=a.assigned_at ORDER BY l.server_received_at DESC LIMIT 1) latest ON true
  LEFT JOIN LATERAL(
    SELECT
      SUM(CASE WHEN daily.gps_valid AND daily.position IS NOT NULL AND daily.previous_position IS NOT NULL THEN ST_Distance(daily.previous_position,daily.position) ELSE 0 END)/1000.0 AS today_distance_km,
      SUM(CASE WHEN daily.next_at IS NOT NULL AND COALESCE(daily.speed,0)>$3 THEN EXTRACT(EPOCH FROM (daily.next_at-daily.observed_at)) END) AS today_running_seconds
    FROM (
      SELECT l.position,l.gps_valid,l.speed,COALESCE(l.tracker_timestamp,l.server_received_at) AS observed_at,
        lag(l.position) OVER(ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at),l.id) AS previous_position,
        lead(COALESCE(l.tracker_timestamp,l.server_received_at)) OVER(ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at),l.id) AS next_at
      FROM locations l WHERE l.vehicle_id=v.id
        AND COALESCE(l.tracker_timestamp,l.server_received_at)>=date_trunc('day',now())
        AND COALESCE(l.tracker_timestamp,l.server_received_at)<date_trunc('day',now())+interval '1 day'
    ) daily
  ) today ON true
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

function capabilityState(capabilities:unknown,key:Capability):CapabilityState{if(!capabilities||typeof capabilities!=='object')return'UNKNOWN';const value=(capabilities as Record<string,unknown>)[key];return value==='SUPPORTED'||value===true?'SUPPORTED':value==='UNSUPPORTED'||value===false?'UNSUPPORTED':'UNKNOWN'}
function validateCapabilities(input:VehicleManagementInput,capabilities:unknown){const required:[boolean,Capability,string][]=[[input.doorConfigured,'door','Door'],[input.relayConfigured,'relay','Relay'],[input.buzzerConfigured,'buzzer','Buzzer'],[input.ignitionWiring!=='UNKNOWN','ignition','Ignition wiring'],[input.acPowerPlus,'airCondition','Air-condition wiring'],[input.parkingAlarmOnIgnition,'parkingAlarm','Parking alarm']];for(const[enabled,key,label]of required)if(enabled&&capabilityState(capabilities,key)==='UNSUPPORTED')throw new AppError(400,'UNSUPPORTED_CAPABILITY',`${label} is not supported by the selected device`)}

async function validateRelations(client:PoolClient,actorId:string,input:VehicleManagementInput){const relation=await client.query(`${userScopeCte} SELECT c.id FROM users c JOIN user_scope s ON s.id=c.id JOIN users a ON a.id=c.owner_id WHERE c.id=$3 AND c.role='CLIENT' AND a.id=$2 AND a.role='ADMIN' AND a.active=true`,[actorId,input.adminId,input.clientId]);if(!relation.rows[0])throw new AppError(403,'INVALID_VEHICLE_OWNER','Admin and Client relationship is outside your authorized hierarchy')}

const protocolCapabilities=(protocol:VehicleManagementInput['deviceProtocol'])=>protocol==='GT06'?{ignition:'SUPPORTED'}:{};
async function provisionDevice(client:PoolClient,input:VehicleManagementInput){
  const imei=input.deviceImei.trim();
  const existing=await client.query<{id:string;owner_id:string|null;protocol:string;capabilities:unknown}>('SELECT id,owner_id,protocol,capabilities FROM devices WHERE imei=$1 FOR UPDATE',[imei]);
  if(existing.rows[0]&&existing.rows[0].owner_id!==input.clientId)throw new AppError(403,'INVALID_DEVICE','IMEI is already registered to another Client');
  if(existing.rows[0]){
    const capabilities=existing.rows[0].protocol===input.deviceProtocol?existing.rows[0].capabilities:protocolCapabilities(input.deviceProtocol);
    const updated=await client.query<{id:string;capabilities:unknown}>('UPDATE devices SET protocol=$2,identity_type=\'IMEI\',identity_value=$1,owner_id=$3,sim_number=$4,sim_operator=$5,capabilities=$6,active=true,updated_at=now() WHERE id=$7 RETURNING id,capabilities',[imei,input.deviceProtocol,input.clientId,input.simNumber?.trim()||null,input.simOperator,JSON.stringify(capabilities),existing.rows[0].id]);
    return updated.rows[0];
  }
  const created=await client.query<{id:string;capabilities:unknown}>('INSERT INTO devices(imei,protocol,identity_type,identity_value,owner_id,sim_number,sim_operator,capabilities) VALUES($1,$2,\'IMEI\',$1,$3,$4,$5,$6) RETURNING id,capabilities',[imei,input.deviceProtocol,input.clientId,input.simNumber?.trim()||null,input.simOperator,JSON.stringify(protocolCapabilities(input.deviceProtocol))]);
  return created.rows[0];
}
const values=(input:VehicleManagementInput)=>[input.vehicleNumber.trim(),input.vehicleType?.trim()||null,input.mileage??null,input.overspeedLimit??null,input.clientId,input.coins,input.billingStart||null,input.billingDue||null,input.alias?.trim()||null,input.remark?.trim()||null,input.active,input.autoRenewal,input.doorConfigured,input.relayConfigured,input.buzzerConfigured,input.ignitionWiring,input.acPowerPlus,input.parkingAlarmOnIgnition];

export async function createManagedVehicle(actorId:string,input:VehicleManagementInput){return transaction(async client=>{await validateRelations(client,actorId,input);const device=await provisionDevice(client,input);validateCapabilities(input,device.capabilities);if((await client.query('SELECT 1 FROM vehicle_device_assignments WHERE device_id=$1 AND unassigned_at IS NULL',[device.id])).rows[0])throw new AppError(409,'DEVICE_ASSIGNED','Device IMEI already has an active vehicle assignment');try{const created=await client.query(`INSERT INTO vehicles(vehicle_number,vehicle_type,mileage,overspeed_limit,owner_id,coins,billing_start,billing_due,alias,remark,active,auto_renewal,door_configured,relay_configured,buzzer_configured,ignition_wiring,ac_power_plus,parking_alarm_on_ignition) VALUES(${values(input).map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,values(input));await client.query('INSERT INTO vehicle_device_assignments(vehicle_id,device_id) VALUES($1,$2)',[created.rows[0].id,device.id]);return created.rows[0]}catch(error){if(error&&typeof error==='object'&&'code'in error&&(error as{code:string}).code==='23505')throw new AppError(409,'VEHICLE_CONFLICT','Vehicle number or device IMEI already exists');throw error}})}

export async function updateManagedVehicle(actorId:string,id:string,input:VehicleManagementInput){return transaction(async client=>{await validateRelations(client,actorId,input);const visible=await client.query(`${userScopeCte} SELECT v.id FROM vehicles v JOIN user_scope s ON s.id=v.owner_id WHERE v.id=$2`,[actorId,id]);if(!visible.rows[0])throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');const assigned=await client.query('SELECT device_id FROM vehicle_device_assignments WHERE vehicle_id=$1 AND unassigned_at IS NULL',[id]);const oldDevice=assigned.rows[0]?.device_id as string|undefined;const device=await provisionDevice(client,input);validateCapabilities(input,device.capabilities);if(oldDevice!==device.id&&(await client.query('SELECT 1 FROM vehicle_device_assignments WHERE device_id=$1 AND unassigned_at IS NULL',[device.id])).rows[0])throw new AppError(409,'DEVICE_ASSIGNED','Device IMEI already has an active vehicle assignment');try{const params=[...values(input),id];const updated=await client.query(`UPDATE vehicles SET vehicle_number=$1,vehicle_type=$2,mileage=$3,overspeed_limit=$4,owner_id=$5,coins=$6,billing_start=$7,billing_due=$8,alias=$9,remark=$10,active=$11,auto_renewal=$12,door_configured=$13,relay_configured=$14,buzzer_configured=$15,ignition_wiring=$16,ac_power_plus=$17,parking_alarm_on_ignition=$18,updated_at=now() WHERE id=$19 RETURNING *`,params);if(oldDevice!==device.id){if(oldDevice)await client.query('UPDATE vehicle_device_assignments SET unassigned_at=now() WHERE vehicle_id=$1 AND device_id=$2 AND unassigned_at IS NULL',[id,oldDevice]);await client.query('INSERT INTO vehicle_device_assignments(vehicle_id,device_id) VALUES($1,$2)',[id,device.id])}return updated.rows[0]}catch(error){if(error&&typeof error==='object'&&'code'in error&&(error as{code:string}).code==='23505')throw new AppError(409,'VEHICLE_CONFLICT','Vehicle number or device IMEI already exists');throw error}})}
