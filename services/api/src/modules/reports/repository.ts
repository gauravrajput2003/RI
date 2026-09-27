import {query} from '../../db/pool.js';
import {userScopeCte} from '../authorization/scope.js';
import type {HistoryPoint} from './calculations.js';
export interface ReportVehicle {id:string;vehicle_number:string;alias:string|null;overspeed_limit:number|null;total_count:number}
export async function reportVehicles(actorId:string,{vehicleId,search,page,pageSize}:{vehicleId?:string;search:string;page:number;pageSize:number}){return query<ReportVehicle>(`${userScopeCte}
 SELECT v.id,v.vehicle_number,v.alias,v.overspeed_limit,count(*) OVER()::int total_count FROM vehicles v JOIN user_scope s ON s.id=v.owner_id
 WHERE ($2::uuid IS NULL OR v.id=$2) AND ($3='%%' OR v.vehicle_number ILIKE $3 OR COALESCE(v.alias,'') ILIKE $3)
 ORDER BY v.vehicle_number,v.id LIMIT $4 OFFSET $5`,[actorId,vehicleId??null,`%${search}%`,pageSize,(page-1)*pageSize])}
export async function reportHistory(actorId:string,vehicleIds:string[],start:Date,end:Date,includePrevious=false){if(!vehicleIds.length)return{rows:[] as HistoryPoint[],rowCount:0};return query<HistoryPoint>(`${userScopeCte}, selected AS (SELECT v.id FROM vehicles v JOIN user_scope s ON s.id=v.owner_id WHERE v.id=ANY($2::uuid[])), ranged AS (
 SELECT l.id,l.vehicle_id,l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,l.ignition,l.gps_valid,l.ac,l.metadata FROM locations l JOIN selected v ON v.id=l.vehicle_id WHERE COALESCE(l.tracker_timestamp,l.server_received_at)>=$3 AND COALESCE(l.tracker_timestamp,l.server_received_at)<$4
 ${includePrevious?`UNION ALL SELECT previous.* FROM selected v CROSS JOIN LATERAL (SELECT l.id,l.vehicle_id,l.tracker_timestamp,l.server_received_at,l.latitude,l.longitude,l.speed,l.ignition,l.gps_valid,l.ac,l.metadata FROM locations l WHERE l.vehicle_id=v.id AND COALESCE(l.tracker_timestamp,l.server_received_at)<$3 ORDER BY COALESCE(l.tracker_timestamp,l.server_received_at) DESC LIMIT 1) previous`:''}
 ) SELECT * FROM ranged ORDER BY vehicle_id,COALESCE(tracker_timestamp,server_received_at),server_received_at,id LIMIT 250001`,[actorId,vehicleIds,start,end])}
