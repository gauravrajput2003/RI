import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pool } from './pool.js';

const migrationDirectories = [
  resolve(process.cwd(), 'database/migrations'),
  resolve(process.cwd(), '../../database/migrations'),
];
const dir = migrationDirectories.find(existsSync);
if (!dir) throw new Error('Could not find database migrations');

await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');

for (const name of (await readdir(dir)).filter(x => x.endsWith('.sql')).sort()) {
  if ((await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name])).rowCount) continue;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(await readFile(join(dir, name), 'utf8'));
    await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

await pool.end();
