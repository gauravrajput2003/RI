import type {PoolClient} from 'pg';
import {query,transaction} from '../../db/pool.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';
import type {GeofenceInput} from '@fleet/shared-types';

// Re-evaluate vehicle ownership on every read: moved vehicles cannot leak their identity.
const visible=`g.owner_id IN (SELECT id FROM user_scope) AND g.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM geofence_vehicle_assignments a JOIN vehicles v ON v.id=a.vehicle_id WHERE a.geofence_id=g.id AND v.owner_id NOT IN (SELECT id FROM user_scope))`;
const fields=`g.id,g.name,g.category_key AS "categoryKey",g.shape_type AS "shapeType",ST_AsGeoJSON(g.geometry)::json AS geometry,g.radius_meters AS "radiusMeters",g.created_at,g.updated_at,
 COALESCE((SELECT json_agg(json_build_object('id',v.id,'vehicle_number',v.vehicle_number) ORDER BY v.vehicle_number) FROM geofence_vehicle_assignments a JOIN vehicles v ON v.id=a.vehicle_id WHERE a.geofence_id=g.id),'[]') AS vehicles,
 ARRAY(SELECT vehicle_id FROM geofence_vehicle_assignments WHERE geofence_id=g.id) AS "vehicleIds"`;
export async function list(actor:string,search:string,page:number,pageSize:number){
 const predicate=`${visible} AND (g.name ILIKE $2 OR replace(g.category_key,'_',' ') ILIKE $2 OR EXISTS(SELECT 1 FROM geofence_vehicle_assignments a JOIN vehicles v ON v.id=a.vehicle_id WHERE a.geofence_id=g.id AND v.vehicle_number ILIKE $2))`;
 const result=await query(`${userScopeCte}, filtered AS (SELECT g.id,g.created_at FROM geofences g WHERE ${predicate}) SELECT (SELECT count(*)::int FROM filtered) AS total,COALESCE((SELECT json_agg(r) FROM (SELECT ${fields} FROM geofences g JOIN (SELECT id FROM filtered ORDER BY created_at DESC,id LIMIT $3 OFFSET $4) p ON p.id=g.id ORDER BY g.created_at DESC,g.id) r),'[]') AS rows`,[actor,`%${search}%`,pageSize,(page-1)*pageSize]);
 return result.rows[0];
}
export async function find(actor:string,id:string){const result=await query(`${userScopeCte} SELECT ${fields} FROM geofences g WHERE ${visible} AND g.id=$2`,[actor,id]);if(!result.rows[0])throw new AppError(404,'GEOFENCE_NOT_FOUND','Geofence not found');return result.rows[0]}
export async function vehicleOptions(actor:string,search:string,page:number,pageSize:number){return (await query(`${userScopeCte}, filtered AS (SELECT v.id,v.vehicle_number FROM vehicles v JOIN user_scope s ON s.id=v.owner_id WHERE v.vehicle_number ILIKE $2) SELECT (SELECT count(*)::int FROM filtered) AS total,COALESCE((SELECT json_agg(r) FROM (SELECT * FROM filtered ORDER BY vehicle_number,id LIMIT $3 OFFSET $4) r),'[]') AS rows`,[actor,`%${search}%`,pageSize,(page-1)*pageSize])).rows[0]}
async function lockFence(client:PoolClient,actor:string,id:string){const r=await client.query(`${userScopeCte} SELECT g.id FROM geofences g WHERE ${visible} AND g.id=$2 FOR UPDATE OF g`,[actor,id]);if(!r.rows[0])throw new AppError(404,'GEOFENCE_NOT_FOUND','Geofence not found')}
export async function save(actor:string,input:GeofenceInput,id?:string){
 const saved=await transaction(async client=>{
  if(id)await lockFence(client,actor,id);
  const vehicles=await client.query(`${userScopeCte} SELECT v.id FROM vehicles v JOIN user_scope s ON s.id=v.owner_id WHERE v.id=ANY($2::uuid[]) FOR SHARE OF v`,[actor,input.vehicleIds]);
  if(vehicles.rows.length!==input.vehicleIds.length)throw new AppError(403,'INVALID_VEHICLES','One or more selected vehicles are unavailable');
  const geo=JSON.stringify(input.geometry);
  const valid=await client.query('SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1),4326)) AS valid',[geo]);
  if(!valid.rows[0]?.valid)throw new AppError(400,'INVALID_GEOMETRY','The boundary intersects itself or is invalid');
  const values=[input.name,input.categoryKey,input.shapeType,geo,input.radiusMeters];
  const result=id?await client.query(`UPDATE geofences SET name=$1,category_key=$2,shape_type=$3,geometry=ST_SetSRID(ST_GeomFromGeoJSON($4),4326),radius_meters=$5,updated_at=now() WHERE id=$6 RETURNING id`,[...values,id]):await client.query(`INSERT INTO geofences(name,category_key,shape_type,geometry,radius_meters,owner_id) VALUES($1,$2,$3,ST_SetSRID(ST_GeomFromGeoJSON($4),4326),$5,$6) RETURNING id`,[...values,actor]);
  const key=result.rows[0].id as string;
  await client.query('DELETE FROM geofence_vehicle_assignments WHERE geofence_id=$1',[key]);
  await client.query('INSERT INTO geofence_vehicle_assignments(geofence_id,vehicle_id) SELECT $1,unnest($2::uuid[])',[key,input.vehicleIds]);
  return key;
 });
 return find(actor,saved);
}
export async function remove(actor:string,id:string){await transaction(async client=>{await lockFence(client,actor,id);await client.query('UPDATE geofences SET deleted_at=now(),updated_at=now() WHERE id=$1',[id])})}
