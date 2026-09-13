import { afterAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import request from 'supertest';
import bcrypt from 'bcrypt';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const database = `fleet_migration_test_${randomUUID().replaceAll('-', '')}`;
let admin: Pool | undefined, verification: Pool | undefined, application: Pool | undefined;
let created = false;
let originalFleet: unknown;
const tables = ['users','groups','devices','vehicles','vehicle_device_assignments','vehicle_groups',
  'device_status','locations','events','subscriptions','refresh_tokens','schema_migrations'].sort();

async function snapshot() {
  return {
    columns: (await verification!.query(`SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default
      FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows,
    constraints: (await verification!.query(`SELECT c.conname,c.contype,c.conrelid::regclass::text AS table_name,
      pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname='public' ORDER BY table_name,c.conname`)).rows,
    indexes: (await verification!.query(`SELECT tablename,indexname,indexdef FROM pg_indexes
      WHERE schemaname='public' ORDER BY tablename,indexname`)).rows,
    relations: (await verification!.query(`SELECT c.oid,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' ORDER BY c.relname`)).rows,
    migrations: (await verification!.query('SELECT name,applied_at FROM schema_migrations ORDER BY name')).rows,
  };
}

function assertCleanupTarget() {
  if (!/^fleet_migration_test_[0-9a-f]{32}$/.test(database) || database === 'fleet') throw new Error('Unsafe cleanup target');
}

afterAll(async () => {
  try {
    await application?.end();
    await verification?.end();
  } finally {
    try {
      if (admin && created) {
        assertCleanupTarget();
        await admin.query(`DROP DATABASE "${database}"`);
        expect((await admin.query('SELECT datname FROM pg_database WHERE datname=$1',[database])).rows).toEqual([]);
        expect((await admin.query("SELECT oid,datname FROM pg_database WHERE datname='fleet'")).rows).toEqual(originalFleet);
        console.info('CLEANUP PASS', JSON.stringify({database,exists:false,fleetUnchanged:originalFleet}));
      }
    } finally { await admin?.end(); }
  }
});

it('initializes a pristine real PostgreSQL/PostGIS database with the repository runner and verifies idempotency and API compatibility', async () => {
  dotenv.config();
  dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url))});
  dotenv.config({path:fileURLToPath(new URL('../../../.env',import.meta.url))});
  const source = new URL(process.env.DATABASE_URL!);
  if (!['localhost','127.0.0.1','[::1]'].includes(source.hostname) || (source.port && source.port !== '5432')) {
    throw new Error('Migration gate only permits the local PostgreSQL instance on port 5432');
  }
  const adminUrl = new URL(source); adminUrl.pathname='/postgres';
  admin = new Pool({connectionString:adminUrl.href,connectionTimeoutMillis:3000,query_timeout:10000});
  originalFleet=(await admin.query("SELECT oid,datname FROM pg_database WHERE datname='fleet'")).rows;
  expect(originalFleet).toHaveLength(1);
  expect((await admin.query('SELECT datname FROM pg_database WHERE datname=$1',[database])).rows).toEqual([]);
  await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
  created=true;
  const target = new URL(source); target.pathname=`/${database}`;
  process.env.DATABASE_URL=target.href;
  process.env.NODE_ENV='test';
  process.env.JWT_SECRET='migration-gate-access-secret-at-least-32-characters';
  process.env.JWT_REFRESH_SECRET='migration-gate-refresh-secret-at-least-32-characters';
  process.env.INTERNAL_TRACKER_SECRET='migration-gate-internal-secret-at-least-32-characters';
  verification=new Pool({connectionString:target.href,connectionTimeoutMillis:3000,query_timeout:10000});
  expect((await verification.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows).toEqual([]);
  expect((await verification.query("SELECT extname FROM pg_extension WHERE extname IN ('postgis','pgcrypto')")).rows).toEqual([]);

  const runner = new URL('../src/db/migrate.ts',import.meta.url);
  const sourceText = await readFile(runner,'utf8');
  const relative = sourceText.match(/new URL\('([^']+)', import\.meta\.url\)/)?.[1];
  expect(relative).toBeDefined();
  const resolved = fileURLToPath(new URL(relative!,runner));
  expect(await realpath(resolved)).toBe(await realpath(fileURLToPath(new URL('../../../database/migrations',import.meta.url))));
  const names=(await readdir(resolved)).filter(name=>name.endsWith('.sql')).sort();
  expect(names).toEqual(['001_initial.sql','002_current_device_state.sql']);
  console.info('MIGRATION TARGET',JSON.stringify({database,runner:fileURLToPath(runner),directory:resolved,names}));
  const migrate = async (cwd:string) => {
    const output=await exec(process.execPath,['--import','tsx',fileURLToPath(runner)],{
      cwd,env:{...process.env,DATABASE_URL:target.href},windowsHide:true,timeout:30000,
    });
    expect(output.stderr).toBe('');
  };
  await migrate(root);
  const version=(await verification.query('SELECT current_database() AS database,version(),postgis_full_version() AS postgis')).rows[0];
  expect(version.database).toBe(database);expect(version.postgis).toContain('POSTGIS=');
  console.info('REAL SERVER',JSON.stringify(version));
  const actualTables=(await verification.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(row=>row.tablename);
  expect(actualTables).toEqual([...tables,'spatial_ref_sys'].sort());
  expect((await verification.query("SELECT extname FROM pg_extension WHERE extname IN ('postgis','pgcrypto') ORDER BY extname")).rows.map(row=>row.extname)).toEqual(['pgcrypto','postgis']);
  const first = await snapshot();
  expect(first.migrations.map(row=>row.name)).toEqual(names);
  expect(first.migrations.every(row=>row.applied_at instanceof Date)).toBe(true);

  // Assert all application primary keys and declared foreign-key relationships.
  const primary = Object.fromEntries(first.constraints.filter(row=>row.contype==='p' && tables.includes(row.table_name))
    .map(row=>[row.table_name,row.definition]));
  for (const table of tables) expect(primary[table]).toBe(
    table==='vehicle_groups'?'PRIMARY KEY (vehicle_id, group_id)':table==='device_status'?'PRIMARY KEY (device_id)':
    table==='schema_migrations'?'PRIMARY KEY (name)':'PRIMARY KEY (id)');
  const expectedForeign:Record<string,string[]> = {
    groups:['FOREIGN KEY (owner_id) REFERENCES users(id)'],vehicles:['FOREIGN KEY (owner_id) REFERENCES users(id)'],
    vehicle_device_assignments:['FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)','FOREIGN KEY (device_id) REFERENCES devices(id)'],
    vehicle_groups:['FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE','FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE'],
    device_status:['FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE'],
    locations:['FOREIGN KEY (device_id) REFERENCES devices(id)','FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)'],
    events:['FOREIGN KEY (device_id) REFERENCES devices(id)','FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)'],
    subscriptions:['FOREIGN KEY (user_id) REFERENCES users(id)'],refresh_tokens:['FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'],
  };
  for (const [table,definitions] of Object.entries(expectedForeign)) expect(first.constraints
    .filter(row=>row.table_name===table && row.contype==='f').map(row=>row.definition).sort()).toEqual(definitions.sort());
  const unique:Record<string,string> = {users:'UNIQUE (email)',groups:'UNIQUE (owner_id, name)',devices:'UNIQUE (imei)',
    vehicles:'UNIQUE (vehicle_number)',refresh_tokens:'UNIQUE (token_hash)'};
  for(const [table,definition] of Object.entries(unique)) expect(first.constraints).toContainEqual(expect.objectContaining({table_name:table,contype:'u',definition}));
  expect(first.constraints).toContainEqual(expect.objectContaining({table_name:'vehicle_device_assignments',contype:'c',
    definition:'CHECK (((unassigned_at IS NULL) OR (unassigned_at > assigned_at)))'}));

  const notNull:Record<string,string[]> = {
    users:['id','email','password_hash','role','active','created_at','updated_at'],
    groups:['id','name','owner_id','created_at','updated_at'],
    devices:['id','imei','protocol','active','created_at','updated_at','identity_type','identity_value'],
    vehicles:['id','vehicle_number','active','owner_id','created_at','updated_at'],
    vehicle_device_assignments:['id','vehicle_id','device_id','assigned_at'],vehicle_groups:['vehicle_id','group_id'],
    device_status:['device_id','state','updated_at'],
    locations:['id','device_id','server_received_at','gps_valid','protocol','metadata','created_at'],
    events:['id','event_type','severity','occurred_at','payload','created_at'],
    subscriptions:['id','user_id','plan','status','created_at','updated_at'],
    refresh_tokens:['id','user_id','token_hash','expires_at','created_at'],schema_migrations:['name','applied_at'],
  };
  for(const [table,columns] of Object.entries(notNull)) expect(first.columns
    .filter(row=>row.table_name===table && row.is_nullable==='NO').map(row=>row.column_name).sort()).toEqual(columns.sort());
  const indexes:Record<string,string> = {
    devices_last_seen_at_idx:'ON public.devices USING btree (last_seen_at DESC)',
    one_active_device_assignment:'UNIQUE INDEX one_active_device_assignment ON public.vehicle_device_assignments USING btree (device_id) WHERE (unassigned_at IS NULL)',
    active_vehicle_assignment_idx:'ON public.vehicle_device_assignments USING btree (vehicle_id) WHERE (unassigned_at IS NULL)',
    locations_device_time_idx:'ON public.locations USING btree (device_id, tracker_timestamp DESC)',
    locations_vehicle_time_idx:'ON public.locations USING btree (vehicle_id, tracker_timestamp DESC)',
    locations_received_idx:'ON public.locations USING btree (server_received_at DESC)',
    locations_protocol_idx:'ON public.locations USING btree (protocol)',locations_position_gist:'ON public.locations USING gist ("position")',
    events_vehicle_time_idx:'ON public.events USING btree (vehicle_id, occurred_at DESC)',
    refresh_tokens_user_idx:'ON public.refresh_tokens USING btree (user_id) WHERE (revoked_at IS NULL)',
    devices_identity_unique:'UNIQUE INDEX devices_identity_unique ON public.devices USING btree (identity_type, identity_value)',
  };
  for(const [name,definition] of Object.entries(indexes)) expect(first.indexes.find(row=>row.indexname===name)?.indexdef.replaceAll('"','')).toContain(definition.replaceAll('"',''));
  expect((await verification.query(`SELECT i.indexrelid FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND (NOT i.indisvalid OR NOT i.indisready)`)).rows).toEqual([]);
  expect((await verification.query(`SELECT f_table_name,f_geography_column,type,srid,coord_dimension FROM geography_columns ORDER BY f_table_name`)).rows).toEqual([
    {f_table_name:'device_status',f_geography_column:'current_position',type:'Point',srid:4326,coord_dimension:2},
    {f_table_name:'locations',f_geography_column:'position',type:'Point',srid:4326,coord_dimension:2},
  ]);
  const enums=(await verification.query(`SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid ORDER BY t.typname,e.enumsortorder`)).rows;
  expect(enums.filter(row=>row.typname==='user_role').map(row=>row.enumlabel)).toEqual(['SUPER_ADMIN','ADMIN','USER']);
  expect(enums.filter(row=>row.typname==='device_connection_state').map(row=>row.enumlabel)).toEqual(['ONLINE','OFFLINE','MOVING','IDLE','STOPPED']);

  // Different cwd on the second execution also exercises source-relative Windows paths.
  await migrate(fileURLToPath(new URL('../',import.meta.url)));
  expect(await snapshot()).toEqual(first);
  console.info('SCHEMA AND IDEMPOTENCY PASS',JSON.stringify({tables:tables.length,primaryKeys:Object.keys(primary).length,
    foreignKeys:Object.values(expectedForeign).flat().length,uniqueConstraints:Object.keys(unique).length,
    explicitIndexes:Object.keys(indexes).length,notNullColumns:Object.values(notNull).flat().length,
    migrations:first.migrations,identicalCatalogsAndRelationOids:true}));

  // Real API compatibility, using the freshly migrated DB and existing repositories.
  const {app}=await import('../src/app.js');
  application=(await import('../src/db/pool.js')).pool;
  const user=randomUUID(),device=randomUUID(),password='migration-test-password';
  await verification.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',[user,'migration@example.invalid',await bcrypt.hash(password,4)]);
  const login=await request(app).post('/api/v1/auth/login').send({email:'migration@example.invalid',password}).expect(200);
  const token=login.body.data.accessToken;
  const create=await request(app).post('/api/v1/vehicles').set('Authorization',`Bearer ${token}`).send({vehicleNumber:`migration-${user}`}).expect(201);
  const vehicle=create.body.data.id;
  await verification.query("INSERT INTO devices(id,imei,protocol,identity_value) VALUES($1,$2,'TEST',$2)",[device,`migration-${device}`.slice(0,32)]);
  await verification.query('INSERT INTO vehicle_device_assignments(vehicle_id,device_id) VALUES($1,$2)',[vehicle,device]);
  await verification.query("INSERT INTO device_status(device_id,last_location_at,current_position) VALUES($1,now(),ST_SetSRID(ST_MakePoint(10,20),4326)::geography)",[device]);
  await verification.query("INSERT INTO locations(device_id,vehicle_id,tracker_timestamp,latitude,longitude,position,gps_valid,protocol) VALUES($1,$2,now(),20,10,ST_SetSRID(ST_MakePoint(10,20),4326)::geography,true,'TEST')",[device,vehicle]);
  await verification.query("INSERT INTO groups(name,owner_id) VALUES('migration',$1)",[user]);
  await verification.query("INSERT INTO subscriptions(user_id,plan,status) VALUES($1,'test','active')",[user]);
  await verification.query("INSERT INTO events(device_id,vehicle_id,event_type) VALUES($1,$2,'migration')",[device,vehicle]);
  for(const resource of ['vehicles','devices','events','groups','subscriptions']) {
    const response=await request(app).get(`/api/v1/${resource}`).set('Authorization',`Bearer ${token}`).expect(200);
    expect(response.body.data).toHaveLength(1);
  }
  await request(app).get(`/api/v1/vehicles/${vehicle}`).set('Authorization',`Bearer ${token}`).expect(200);
  const latest=await request(app).get(`/api/v1/vehicles/${vehicle}/latest-location`).set('Authorization',`Bearer ${token}`).expect(200);
  expect(latest.body.data).toMatchObject({latitude:20,longitude:10,gps_valid:true});
  const now=Date.now();
  const history=await request(app).get(`/api/v1/vehicles/${vehicle}/history`).query({from:new Date(now-86400000).toISOString(),to:new Date(now+86400000).toISOString()})
    .set('Authorization',`Bearer ${token}`).expect(200);
  expect(history.body.data).toHaveLength(1);
  await request(app).patch(`/api/v1/vehicles/${vehicle}`).set('Authorization',`Bearer ${token}`).send({alias:'migrated'}).expect(200);
  await request(app).delete(`/api/v1/vehicles/${vehicle}`).set('Authorization',`Bearer ${token}`).expect(204);
  const spatial=(await verification.query('SELECT ST_SRID(position::geometry) AS srid,ST_X(position::geometry) AS longitude,ST_Y(position::geometry) AS latitude FROM locations')).rows;
  expect(spatial).toEqual([{srid:4326,longitude:10,latitude:20}]);

  // Assert representative constraints reject invalid data, inside rolled-back statements.
  const rejects=async(sql:string,values:unknown[],code:string)=>{
    const client=await verification!.connect();
    try {await client.query('BEGIN');await expect(client.query(sql,values)).rejects.toMatchObject({code});}
    finally {await client.query('ROLLBACK');client.release();}
  };
  await rejects("INSERT INTO vehicle_device_assignments(vehicle_id,device_id) VALUES($1,$2)",[vehicle,device],'23505');
  await rejects("INSERT INTO groups(name,owner_id) VALUES('invalid',$1)",[randomUUID()],'23503');
  await rejects('UPDATE devices SET identity_value=NULL WHERE id=$1',[device],'23502');
  await rejects("UPDATE vehicle_device_assignments SET unassigned_at=assigned_at WHERE device_id=$1",[device],'23514');
  await rejects('UPDATE device_status SET current_position=ST_SetSRID(ST_MakePoint(10,20),4269)::geography WHERE device_id=$1',[device],'22023');
  await rejects("UPDATE locations SET position=ST_GeogFromText('SRID=4326;LINESTRING(10 20,11 21)') WHERE device_id=$1",[device],'22023');
  console.info('APPLICATION COMPATIBILITY PASS: real login, vehicle CRUD, 5 lists, latest/history, PostGIS roundtrip and constraint rejection');
});
