/** Read-only verification. Select the bike from actual persisted history, never a fixed ID. */
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {pool} from '../src/db/pool.js';
import {env} from '../src/config/env.js';
import {api} from '../src/routes/api.js';
import {errorHandler} from '../src/lib/errors.js';
import {liveMapData} from '../src/modules/vehicles/live-map.js';
import {playbackPoints} from '../src/modules/playback/repository.js';
import type {LiveMapData} from '@fleet/shared-types';
const output=new URL('../../../artifacts/live-map/',import.meta.url);
try{
 await pool.query('SET default_transaction_read_only = on');pool.on('connect',client=>{void client.query('SET default_transaction_read_only = on')});
 const vehicle=(await pool.query(`SELECT v.id,v.vehicle_number,v.owner_id,v.odometer,max(COALESCE(l.tracker_timestamp,l.server_received_at)) latest FROM vehicles v JOIN users u ON u.id=v.owner_id AND u.active JOIN locations l ON l.vehicle_id=v.id WHERE l.gps_valid AND l.position IS NOT NULL AND lower(v.vehicle_type) IN('bike','motorcycle','motor bike','scooter','scooty') GROUP BY v.id ORDER BY latest DESC LIMIT 1`)).rows[0];assert(vehicle,'No bike has stored GPS history');
 const app=express();app.use(express.json());app.use('/api/v1',api);app.use(errorHandler);
 const response=await request(app).get(`/api/v1/vehicles/${vehicle.id}/live-map`).auth(jwt.sign({id:vehicle.owner_id},env.JWT_SECRET,{expiresIn:'5m'}),{type:'bearer'});assert.equal(response.status,200,JSON.stringify(response.body));
 const data=response.body.data as LiveMapData;
 const check=async(summary:LiveMapData,until:Date)=>{
  const from=new Date(`${summary.day}T00:00:00+05:30`),points=(await playbackPoints(vehicle.owner_id,vehicle.id,from,until,250001,false)).rows as Array<{cumulative_distance_km:number;route_avg_speed:number;route_max_speed:number}>;
  if(points.length>1)assert(Math.abs(summary.todayKm!-Number(points.at(-1)!.cumulative_distance_km))<1e-8);else assert.equal(summary.todayKm,null);
  if(points.length){assert(Math.abs(summary.avgSpeed!-Number(points[0].route_avg_speed))<1e-8);assert.equal(summary.maxSpeed,Number(points[0].route_max_speed))}else{assert.equal(summary.avgSpeed,null);assert.equal(summary.maxSpeed,null)}
  assert.equal(summary.totalKm,vehicle.odometer==null?null:Number(vehicle.odometer));
  const stored=new Set((await pool.query('SELECT latitude,longitude FROM locations WHERE vehicle_id=$1 AND gps_valid AND COALESCE(tracker_timestamp,server_received_at)>=$2 AND COALESCE(tracker_timestamp,server_received_at)<$3',[vehicle.id,from,until])).rows.map(p=>`${p.latitude},${p.longitude}`));
  for(const segment of summary.path)for(const point of segment)assert(stored.has(`${point.latitude},${point.longitude}`),'Path contains a coordinate not in stored GPS data');
 };
 await check(data,new Date(+new Date(data.generatedAt)+1));
 const last=new Date(vehicle.latest),key=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(last);
 // Exercise an actual historical day if today has no fixes. This is verification only.
 const historic=await liveMapData(vehicle.owner_id,vehicle.id,new Date(`${key}T23:59:59+05:30`));await check(historic,new Date(`${key}T23:59:59.001+05:30`));
 await mkdir(output,{recursive:true});const result={vehicle:vehicle.vehicle_number,current:data,historical:historic,checks:['Authenticated live-map endpoint','Today and historical GPS metrics match production playback SQL','Every path coordinate exists in persisted history','Total km equals configured vehicle odometer or null','All database connections read-only; no telemetry seeded or modified']};
 await writeFile(new URL('verification.json',output),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await pool.end()}
