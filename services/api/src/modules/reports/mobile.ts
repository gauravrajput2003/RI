import {randomUUID} from 'node:crypto';
import type {MobileReport,MobileReportKind} from '@fleet/shared-types';
import {query} from '../../db/pool.js';
import {env} from '../../config/env.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';
import {mobileDailyRows,type MobilePoint} from './mobile-calculations.js';
export interface MobileFilters {vehicleId:string;start:Date;end:Date;timeZone:string}
export async function mobileReportVehicle(actorId:string,vehicleId:string){
 const result=await query<{id:string;vehicleNumber:string;vehicleType:string|null}>(`${userScopeCte} SELECT v.id,v.vehicle_number AS "vehicleNumber",v.vehicle_type AS "vehicleType" FROM vehicles v JOIN user_scope s ON s.id=v.owner_id WHERE v.id=$2`,[actorId,vehicleId]);
 if(!result.rows.length)throw new AppError(404,'VEHICLE_NOT_FOUND','Vehicle not found');return result.rows[0];
}
/** Same validity, device partition, 200 km/h jump rejection and 10m jitter rule as playback. */
export const mobileHistorySql=`${userScopeCte}, bounded AS (
 SELECT l.*,COALESCE(l.tracker_timestamp,l.server_received_at) observed_at,
 (COALESCE(l.tracker_timestamp,l.server_received_at) AT TIME ZONE $5)::date report_day
 FROM locations l JOIN vehicles v ON v.id=l.vehicle_id JOIN user_scope s ON s.id=v.owner_id
 WHERE l.vehicle_id=$2 AND COALESCE(l.tracker_timestamp,l.server_received_at)>=$3 AND COALESCE(l.tracker_timestamp,l.server_received_at)<$4
 ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at),l.server_received_at,l.id LIMIT 250001
), valid AS (
 SELECT *,lag(position) OVER route previous_position,lag(observed_at) OVER route previous_at,lag(speed) OVER route previous_speed
 FROM bounded WHERE gps_valid AND position IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND NOT(latitude=0 AND longitude=0)
 WINDOW route AS(PARTITION BY device_id,report_day ORDER BY observed_at,server_received_at,id)
), measured AS (
 SELECT id,ST_Distance(previous_position,position) metres,EXTRACT(EPOCH FROM(observed_at-previous_at)) seconds,speed,previous_speed FROM valid
)
SELECT b.id,b.device_id,b.vehicle_id,b.tracker_timestamp,b.server_received_at,b.latitude,b.longitude,b.speed,b.ignition,(b.gps_valid AND b.position IS NOT NULL) AS gps_valid,b.ac,b.metadata,b.protocol,
 COALESCE(m.seconds>0,false) has_distance_pair,
 CASE WHEN m.seconds>0 AND m.metres<=m.seconds*(200.0/3.6) AND(m.metres>=10 OR m.speed>$6 OR m.previous_speed>$6) THEN m.metres/1000.0 ELSE 0 END segment_distance_km
 FROM bounded b LEFT JOIN measured m ON m.id=b.id ORDER BY b.observed_at,b.server_received_at,b.id`;
const snapshots=new Map<string,{actorId:string;expires:number;report:MobileReport}>();
function store(actorId:string,report:MobileReport){
 for(const [key,value] of snapshots)if(value.expires<Date.now())snapshots.delete(key);
 while(snapshots.size>=200)snapshots.delete(snapshots.keys().next().value!);
 const id=randomUUID();report.snapshotId=id;snapshots.set(id,{actorId,expires:Date.now()+15*60_000,report:structuredClone(report)});return report;
}
export async function mobileReport(actorId:string,kind:MobileReportKind,filters:MobileFilters):Promise<MobileReport>{
 const vehicle=await mobileReportVehicle(actorId,filters.vehicleId);
 const result=await query<MobilePoint>(mobileHistorySql,[actorId,filters.vehicleId,filters.start,filters.end,filters.timeZone,env.MOVEMENT_THRESHOLD_KPH]);
 if(result.rows.length>250000)throw new AppError(413,'REPORT_TOO_LARGE','Narrow the date range. This report exceeds 250,000 records.');
 const report:MobileReport={kind,vehicle,filters:{start:filters.start.toISOString(),end:filters.end.toISOString(),timeZone:filters.timeZone},rows:mobileDailyRows(result.rows,filters.timeZone,env.MOVEMENT_THRESHOLD_KPH,env.OFFLINE_TIMEOUT_SECONDS,env.NO_SIGNAL_TIMEOUT_MINUTES*60),generatedAt:new Date().toISOString(),snapshotId:null};
 report.rows=report.rows.filter(row=>row.gpsPointCount>0);
 return report.rows.length?store(actorId,report):report;
}
export async function reportSnapshot(actorId:string,kind:MobileReportKind,id:string){
 const snapshot=snapshots.get(id);
 if(!snapshot||snapshot.actorId!==actorId||snapshot.report.kind!==kind||snapshot.expires<Date.now())throw new AppError(409,'REPORT_EXPIRED','Refresh the report before exporting.');
 await mobileReportVehicle(actorId,snapshot.report.vehicle.id);return structuredClone(snapshot.report);
}
