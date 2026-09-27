import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const sourceFile = resolve(root, '.env');
const destinationFile = resolve(root, '.env.render');
if (!existsSync(sourceFile) || !existsSync(destinationFile)) {
  throw new Error('Expected .env and .env.render in the repository root');
}

const sourceUrl = dotenv.parse(readFileSync(sourceFile)).DATABASE_URL;
const destinationUrl = dotenv.parse(readFileSync(destinationFile)).DATABASE_URL;
if (!sourceUrl || !destinationUrl || sourceUrl === destinationUrl) {
  throw new Error('Source and destination database URLs must be present and different');
}
const encryptedDestination = new URL(destinationUrl);
if (!encryptedDestination.hostname.endsWith('.render.com')) {
  throw new Error('Destination must be a Render Postgres database');
}
encryptedDestination.searchParams.set('sslmode', 'verify-full');

const source = new Client({ connectionString: sourceUrl, connectionTimeoutMillis: 10000 });
const destination = new Client({ connectionString: encryptedDestination.toString(), connectionTimeoutMillis: 10000 });
const excluded = new Set(['schema_migrations', 'refresh_tokens', 'spatial_ref_sys']);
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const qualified = name => `public.${quote(name)}`;

async function tables(client) {
  const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  return rows.map(row => row.tablename).filter(name => !excluded.has(name));
}

async function dependencyOrder(client, names) {
  const known = new Set(names);
  const dependencies = new Map(names.map(name => [name, new Set()]));
  const { rows } = await client.query(`
    SELECT child.relname AS child, parent.relname AS parent
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_namespace cn ON cn.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_namespace pn ON pn.oid = parent.relnamespace
    WHERE c.contype = 'f' AND cn.nspname = 'public' AND pn.nspname = 'public'
  `);
  for (const { child, parent } of rows) {
    if (child !== parent && known.has(child) && known.has(parent)) dependencies.get(child).add(parent);
  }
  const ordered = [];
  while (dependencies.size) {
    const ready = [...dependencies].filter(([, parents]) => [...parents].every(parent => !dependencies.has(parent)));
    if (!ready.length) throw new Error('Foreign-key cycle prevents ordered copy');
    for (const [name] of ready) {
      ordered.push(name);
      dependencies.delete(name);
    }
  }
  return ordered;
}

function orderUsers(rows) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const ordered = [];
  const visited = new Set();
  const visiting = new Set();
  function visit(row) {
    if (visited.has(row.id)) return;
    if (visiting.has(row.id)) throw new Error('User ownership contains a cycle');
    visiting.add(row.id);
    if (row.owner_id && byId.has(row.owner_id)) visit(byId.get(row.owner_id));
    visiting.delete(row.id);
    visited.add(row.id);
    ordered.push(row);
  }
  rows.forEach(visit);
  return ordered;
}

try {
  await source.connect();
  await destination.connect();
  const sourceTables = await tables(source);
  const destinationTables = await tables(destination);
  const missing = sourceTables.filter(name => !destinationTables.includes(name));
  if (missing.length) throw new Error(`Destination migrations missing tables: ${missing.join(', ')}`);
  const order = await dependencyOrder(destination, sourceTables);
  const counts = new Map();
  for (const name of order) {
    const sourceCount = Number((await source.query(`SELECT count(*) AS count FROM ${qualified(name)}`)).rows[0].count);
    const destinationCount = Number((await destination.query(`SELECT count(*) AS count FROM ${qualified(name)}`)).rows[0].count);
    if (destinationCount !== 0) throw new Error(`Destination ${name} is not empty; copy aborted`);
    counts.set(name, sourceCount);
  }
  console.log('Tables to copy:', [...counts].filter(([, count]) => count).map(([name, count]) => `${name}=${count}`).join(', '));
  console.log('Excluded session tokens and migration records.');
  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Pass --apply to copy.');
  } else {
    await destination.query('BEGIN');
    try {
      for (const name of order) {
        if (!counts.get(name)) continue;
        const result = await source.query(`SELECT * FROM ${qualified(name)}`);
        const rows = name === 'users' ? orderUsers(result.rows) : result.rows;
        const columns = result.fields.map(field => field.name);
        const sql = `INSERT INTO ${qualified(name)} (${columns.map(quote).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`;
        for (const row of rows) await destination.query(sql, columns.map(column => row[column]));
      }
      for (const [name, expected] of counts) {
        const actual = Number((await destination.query(`SELECT count(*) AS count FROM ${qualified(name)}`)).rows[0].count);
        if (actual !== expected) throw new Error(`Row count mismatch in ${name}: expected ${expected}, found ${actual}`);
      }
      await destination.query('COMMIT');
      console.log('Data copy committed and row counts verified.');
    } catch (error) {
      await destination.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await Promise.allSettled([source.end(), destination.end()]);
}
