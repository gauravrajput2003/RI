/** Read-only verification against the configured database. Never seeds telemetry. */
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import {pool} from '../src/db/pool.js';
import {env} from '../src/config/env.js';
import {api} from '../src/routes/api.js';
import {errorHandler} from '../src/lib/errors.js';
import {playbackPoints} from '../src/modules/playback/repository.js';
import {reportColumns,exportValue} from '../src/modules/reports/mobile-export.js';
import type {MobileReport,MobileReportKind} from '@fleet/shared-types';
const output=new URL('../../../artifacts/mobile-reports/',import.meta.url);
const app=express();app.use(express.json());app.use('/api/v1',api);app.use(errorHandler);
try{
 // Every connection used by the report/API queries is explicitly read-only.
 env.ADDRESS_SOURCE='gps'; // Historical metadata only; disable background cell lookup scheduling.
 await pool.query("SET default_transaction_read_only = on");
 pool.on('connect',client=>{void client.query('SET default_transaction_read_only = on')});
 const vehicle=(await pool.query(`SELECT v.id,v.vehicle_number,v.owner_id,u.role,count(l.id)::int count,max(COALESCE(l.tracker_timestamp,l.server_received_at)) latest FROM vehicles v JOIN users u ON u.id=v.owner_id AND u.active JOIN locations l ON l.vehicle_id=v.id WHERE l.gps_valid AND l.position IS NOT NULL AND lower(v.vehicle_type) IN('bike','motorcycle','motor bike','scooty','scooter') GROUP BY v.id,u.role ORDER BY latest DESC LIMIT 1`)).rows[0];
 assert(vehicle,'No actual bike GPS history is available');
 const token=jwt.sign({id:vehicle.owner_id},env.JWT_SECRET,{expiresIn:'5m'});
 const days=(await pool.query(`SELECT to_char(COALESCE(tracker_timestamp,server_received_at) AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') date,count(*)::int packets,count(*) FILTER(WHERE gps_valid AND position IS NOT NULL)::int gps FROM locations WHERE vehicle_id=$1 GROUP BY 1 ORDER BY 1`,[vehicle.id])).rows;
 const from=days[0].date,to=days.at(-1)!.date;
 const start=new Date(`${from}T00:00:00+05:30`).toISOString(),end=new Date(+new Date(`${to}T00:00:00+05:30`)+86400000).toISOString();
 await mkdir(output,{recursive:true});
 const reports:MobileReport[]=[];
 const call=(kind:MobileReportKind,from=start,until=end)=>request(app).get(`/api/v1/reports/mobile/${kind}`).query({vehicleId:vehicle.id,start:from,end:until,timeZone:'Asia/Kolkata'}).auth(token,{type:'bearer'});
 for(const kind of ['distance','travel-summary'] as const){
  const response=await call(kind);assert.equal(response.status,200,JSON.stringify(response.body));const report=response.body.data as MobileReport;
  assert.equal(report.vehicle.id,vehicle.id);assert.equal(report.rows.length,days.filter(d=>d.gps>0).length);
  for(const row of report.rows){
   const dayStart=new Date(`${row.date}T00:00:00+05:30`),dayEnd=new Date(+dayStart+86400000);
   const playback=await playbackPoints(vehicle.owner_id,vehicle.id,dayStart,dayEnd,250001);
   const expected=playback.rows.at(-1) as {cumulative_distance_km?:number;route_avg_speed?:number;route_max_speed?:number}|undefined;
   assert.equal(row.gpsPointCount,playback.rows.length);
   if(playback.rows.length>1)assert(Math.abs(row.km!-Number(expected?.cumulative_distance_km))<1e-8,'Report distance differs from playback');
   if(expected){assert.equal(row.avgSpeed,Number(expected.route_avg_speed));assert.equal(row.maxSpeed,Number(expected.route_max_speed))}
   if(playback.rows.length){
    const first=playback.rows[0] as {tracker_timestamp:Date|null;server_received_at:Date;latitude:number;longitude:number},last=playback.rows.at(-1) as typeof first;
    assert.equal(row.startTime,new Date(first.tracker_timestamp??first.server_received_at).toISOString());assert.equal(row.endTime,new Date(last.tracker_timestamp??last.server_received_at).toISOString());
    assert.deepEqual(row.startLocation,{latitude:first.latitude,longitude:first.longitude});assert.deepEqual(row.endLocation,{latitude:last.latitude,longitude:last.longitude});
   }
   const gaps=(await pool.query(`WITH observations AS(SELECT EXTRACT(EPOCH FROM(lead(COALESCE(tracker_timestamp,server_received_at)) OVER(PARTITION BY device_id ORDER BY COALESCE(tracker_timestamp,server_received_at),server_received_at,id)-COALESCE(tracker_timestamp,server_received_at))) seconds FROM locations WHERE vehicle_id=$1 AND COALESCE(tracker_timestamp,server_received_at)>=$2 AND COALESCE(tracker_timestamp,server_received_at)<$3) SELECT COALESCE(sum(greatest(seconds-$4,0)),0)::double precision unreachable FROM observations`,[vehicle.id,dayStart,dayEnd,env.NO_SIGNAL_TIMEOUT_MINUTES*60])).rows[0];
   if(row.unreachableSeconds!=null)assert.equal(row.unreachableSeconds,gaps.unreachable);
   const raw=(await pool.query(`SELECT count(*)::int count,count(*) FILTER(WHERE ignition IS NULL)::int missing_ignition,EXTRACT(EPOCH FROM(max(COALESCE(tracker_timestamp,server_received_at))-min(COALESCE(tracker_timestamp,server_received_at))))::double precision duration FROM locations WHERE vehicle_id=$1 AND COALESCE(tracker_timestamp,server_received_at)>=$2 AND COALESCE(tracker_timestamp,server_received_at)<$3`,[vehicle.id,dayStart,dayEnd])).rows[0];
   assert.equal(row.pointCount,raw.count);if(raw.duration>0)assert.equal(row.durationSeconds,raw.duration);
   if(raw.missing_ignition===raw.count){assert.equal(row.idleSeconds,null);assert.equal(row.stoppedSeconds,null);assert.equal(row.halts,null)}
  }
  const columns=reportColumns(kind);
  for(const format of ['pdf','xlsx'] as const){
   const exported=await request(app).post(`/api/v1/reports/mobile/${kind}/export`).auth(token,{type:'bearer'}).send({snapshotId:report.snapshotId,format});assert.equal(exported.status,200,JSON.stringify(exported.body));
   const buffer=Buffer.from(exported.body.data.base64,'base64');
   if(format==='pdf')assert.equal(buffer.subarray(0,5).toString(),'%PDF-');
   else{const book=new ExcelJS.Workbook();await book.xlsx.load(buffer);const sheet=book.getWorksheet('Report')!;assert.equal(sheet.rowCount,report.rows.length+1);report.rows.forEach((row,index)=>columns.forEach(([,key],column)=>assert.equal(sheet.getCell(index+2,column+1).value,exportValue(row[key]),`Export mismatch ${key}`)));assert.equal(book.getWorksheet('Applied filters')!.getCell('B2').value,vehicle.vehicle_number)}
   await writeFile(new URL(`${kind}.${format}`,output),buffer);
  }
  await writeFile(new URL(`${kind}.json`,output),JSON.stringify({...report,snapshotId:null},null,2));reports.push(report);
 }
 assert.deepEqual(reports[0].rows,reports[1].rows);
 const emptyEnd=new Date(start),emptyStart=new Date(+emptyEnd-86400000);
 if(+emptyStart<Date.now()){const empty=await call('distance',emptyStart.toISOString(),emptyEnd.toISOString());assert.equal(empty.status,200);assert.deepEqual(empty.body.data.rows,[]);assert.equal(empty.body.data.snapshotId,null)}
 const summary={vehicle:vehicle.vehicle_number,availableDates:days,filters:{start,end,timeZone:'Asia/Kolkata'},rows:reports[0].rows,checks:['Authenticated report APIs match persisted GPS counts, raw speed aggregates and playback distance','Both reports return identical underlying daily records','PDF header valid; Excel round-trip matches every report cell and filters','No-data historical period has no cards or export snapshot','Database connections read-only; no telemetry changes']};
 await writeFile(new URL('verification.json',output),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{await pool.end()}
