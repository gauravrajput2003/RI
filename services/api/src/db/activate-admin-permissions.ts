import {readFile} from 'node:fs/promises';
import {pool} from './pool.js';
import {env} from '../config/env.js';

// Scoped repair for an existing local development database. Leave unrelated pending migrations alone.
const name='018_admin_permissions.sql';
const target=new URL(env.DATABASE_URL);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.pathname!=='/fleet'){
 await pool.end();throw new Error('Permission activation requires the verified local fleet database');
}
const client=await pool.connect();
try{
 await client.query('BEGIN');
 await client.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
 const applied=(await client.query('SELECT name FROM schema_migrations')).rows.map(row=>row.name);
 if(!applied.includes('016_coin_management.sql'))throw new Error('Required baseline migrations are missing');
 if(!applied.includes(name)){
  await client.query(await readFile(new URL('../../../../database/migrations/018_admin_permissions.sql',import.meta.url),'utf8'));
  await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
 }
 await client.query('SELECT permissions_version FROM users LIMIT 1');
 await client.query('COMMIT');
 console.log(JSON.stringify({database:'fleet',migration:name,status:'applied',unrelatedMigrations:'unchanged'}));
}catch(error){await client.query('ROLLBACK');throw error}
finally{client.release();await pool.end()}
