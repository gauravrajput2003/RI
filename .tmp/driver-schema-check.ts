import {readdir} from 'node:fs/promises';
import {env} from '../services/api/src/config/env.js';
import {pool} from '../services/api/src/db/pool.js';
try{
 const table=(await pool.query("SELECT to_regclass('schema_migrations')::text AS name")).rows[0].name;
 if(!table){console.log(JSON.stringify({migrationRegistry:false}));}
 else{
  const applied=new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map(row=>row.name));
  const names=(await readdir(new URL('../database/migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort();
  console.log(JSON.stringify({localDatabase:['localhost','127.0.0.1','::1','[::1]'].includes(new URL(env.DATABASE_URL).hostname),pending:names.filter(name=>!applied.has(name)),driversTable:(await pool.query("SELECT to_regclass('drivers')::text AS name")).rows[0].name}));
 }
}finally{await pool.end();}
