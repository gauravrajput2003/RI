import {readFile} from 'node:fs/promises';
import {pool} from './pool.js';
import {env} from '../config/env.js';
const name='019_mobile_actions.sql',target=new URL(env.DATABASE_URL);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.pathname!=='/fleet'){
  await pool.end();throw new Error('Mobile activation requires the verified local fleet database');
}
const client=await pool.connect();
try{
  await client.query('BEGIN');
  await client.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
  const applied=(await client.query('SELECT name FROM schema_migrations')).rows.map(row=>row.name);
  if(!applied.includes('018_admin_permissions.sql'))throw new Error('Required permission baseline is missing');
  if(!applied.includes(name)){
    await client.query(await readFile(new URL('../../../../database/migrations/019_mobile_actions.sql',import.meta.url),'utf8'));
    await client.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({database:'fleet',migration:name,status:'applied',unrelatedMigrations:'unchanged'}));
}catch(error){await client.query('ROLLBACK');throw error}
finally{client.release();await pool.end()}
