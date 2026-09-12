import { Pool, type QueryResultRow } from 'pg'; import { env } from '../config/env.js';
export const pool=new Pool({connectionString:env.DATABASE_URL,max:20,connectionTimeoutMillis:3000,query_timeout:10000,application_name:'fleet-api'});
export const query=<T extends QueryResultRow>(text:string,values?:unknown[])=>pool.query<T>(text,values);
