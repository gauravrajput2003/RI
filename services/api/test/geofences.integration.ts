import type {Express} from 'express';
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {expect} from 'vitest';

// Called only by the migration gate against its freshly created disposable PostGIS database.
export async function verifyGeofences(app:Express,db:Pool,token:string,owner:string,vehicle:string){
 const stranger=randomUUID(),foreignVehicle=randomUUID(),child=randomUUID(),childVehicle=randomUUID();
 await db.query("INSERT INTO users(id,email,password_hash,owner_id) VALUES($1,$2,'test',NULL),($3,$4,'test',$5)",[stranger,`${stranger}@test.local`,child,`${child}@test.local`,owner]);
 await db.query('INSERT INTO vehicles(id,vehicle_number,owner_id) VALUES($1,$2,$3),($4,$5,$6)',[foreignVehicle,'FOREIGN-FENCE',stranger,childVehicle,'CHILD-FENCE',child]);
 const foreignToken=jwt.sign({id:stranger,role:'USER'},process.env.JWT_SECRET!);
 const call=(method:'get'|'post'|'patch'|'delete',path='',auth=token)=>request(app)[method](`/api/v1/geofences${path}`).set('Authorization',`Bearer ${auth}`);
 const base={name:'Warehouse',categoryKey:'fuel_station',shapeType:'POINT',geometry:{type:'Point',coordinates:[77,28]},radiusMeters:null,vehicleIds:[vehicle,childVehicle]};
 await request(app).get('/api/v1/geofences').expect(401);
 const options=await call('get','/vehicle-options?search=FENCE&pageSize=1').expect(200);
 expect(options.body.data.map((v:{id:string})=>v.id)).toEqual([childVehicle]);
 const point=await call('post').send(base).expect(201),id=point.body.data.id;
 expect(point.body.data).toMatchObject(base);expect(point.body.data.vehicles).toHaveLength(2);
 await call('get',`/${id}`).expect(200);
 for(const method of ['get','patch','delete'] as const){const req=call(method,`/${id}`,foreignToken);if(method==='patch')req.send(base);await req.expect(404)}
 expect((await call('get','',foreignToken)).body.data).toEqual([]);
 await call('post').send({...base,vehicleIds:[foreignVehicle]}).expect(403);
 await call('patch',`/${id}`).send({...base,vehicleIds:[vehicle,foreignVehicle]}).expect(403);
 expect((await call('get',`/${id}`)).body.data.vehicleIds.sort()).toEqual([vehicle,childVehicle].sort());
 for(const invalid of [{categoryKey:'not_a_category'},{vehicleIds:[vehicle,vehicle]},{vehicleIds:[]},{name:' '},{radiusMeters:10},{geometry:{type:'Point',coordinates:[181,28]}},{owner_id:stranger},{assignType:'GROUP'}, {shapeType:'CIRCLE',radiusMeters:0},{shapeType:'CIRCLE',radiusMeters:1000001},{shapeType:'CIRCLE',radiusMeters:null}])await call('post').send({...base,...invalid}).expect(400);
 const ring=[[77,28],[78,28],[78,29],[77,29],[77,28]];
 for(const shapeType of ['POLYGON','RECTANGLE']){
  const response=await call('post').send({...base,name:shapeType,shapeType,geometry:{type:'Polygon',coordinates:[ring]}}).expect(201);
  expect(response.body.data.geometry).toEqual({type:'Polygon',coordinates:[ring]});
  const spatial=await db.query('SELECT GeometryType(geometry) AS type,ST_SRID(geometry) AS srid,ST_IsValid(geometry) AS valid FROM geofences WHERE id=$1',[response.body.data.id]);
  expect(spatial.rows[0]).toEqual({type:'POLYGON',srid:4326,valid:true});
 }
 await call('post').send({...base,shapeType:'POLYGON',geometry:{type:'Polygon',coordinates:[[[77,28],[78,29],[78,28],[77,29],[77,28]]]}}).expect(400);
 await call('post').send({...base,shapeType:'POLYGON',geometry:{type:'Polygon',coordinates:[[[77,28],[78,29],[79,30],[77,28]]]}}).expect(400);
 await call('post').send({...base,shapeType:'RECTANGLE',geometry:{type:'Polygon',coordinates:[[[77,28],[78,29],[78,30],[77,28]]]}}).expect(400);
 const updated=await call('patch',`/${id}`).send({...base,name:'Depot gate',shapeType:'CIRCLE',radiusMeters:1250,vehicleIds:[vehicle]}).expect(200);
 expect(updated.body.data).toMatchObject({id,name:'Depot gate',shapeType:'CIRCLE',radiusMeters:1250,vehicleIds:[vehicle]});
 const circle=await db.query('SELECT GeometryType(geometry) AS type,ST_X(geometry) AS lng,ST_Y(geometry) AS lat,radius_meters FROM geofences WHERE id=$1',[id]);
 expect(circle.rows[0]).toEqual({type:'POINT',lng:77,lat:28,radius_meters:1250});
 for(const search of ['Depot','Fuel Station', (await db.query('SELECT vehicle_number FROM vehicles WHERE id=$1',[vehicle])).rows[0].vehicle_number]){
  const result=await call('get',`?search=${encodeURIComponent(search)}`).expect(200);expect(result.body.data.some((f:{id:string})=>f.id===id)).toBe(true);
 }
 const page=await call('get','?pageSize=1&page=2').expect(200);expect(page.body.data).toHaveLength(1);expect(page.body.pagination.total).toBe(3);
 const empty=await call('get','?pageSize=1&page=99').expect(200);expect(empty.body.data).toEqual([]);expect(empty.body.pagination.total).toBe(3);
 // Ownership changes immediately revoke access to linked records, even before assignments are reconciled.
 await db.query('UPDATE vehicles SET owner_id=$1 WHERE id=$2',[stranger,vehicle]);
 await call('get',`/${id}`).expect(404);await call('delete',`/${id}`).expect(404);
 expect((await call('get')).body.data).toEqual([]);
 await db.query('UPDATE vehicles SET owner_id=$1 WHERE id=$2',[owner,vehicle]);
 await call('delete',`/${id}`).expect(204);await call('get',`/${id}`).expect(404);
 expect((await db.query('SELECT deleted_at FROM geofences WHERE id=$1',[id])).rows[0].deleted_at).not.toBeNull();
 expect((await db.query('SELECT count(*)::int AS count FROM geofence_vehicle_assignments WHERE geofence_id=$1',[id])).rows[0].count).toBe(1);
 expect((await db.query("SELECT indexdef FROM pg_indexes WHERE indexname='geofences_geometry_gist'")).rows[0].indexdef).toContain('USING gist (geometry)');
 console.info('GEOFENCE PASS: CRUD, hierarchy, IDOR, assignment rollback, validation, all shapes, PostGIS roundtrip, search, pagination, ownership transfer, soft deletion and spatial index');
}
