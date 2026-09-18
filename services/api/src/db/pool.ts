import { Pool, type PoolClient, type QueryResultRow } from 'pg'; import { env } from '../config/env.js';
export const pool=new Pool({connectionString:env.DATABASE_URL,max:20,connectionTimeoutMillis:3000,query_timeout:10000,application_name:'fleet-api'});
export const query=<T extends QueryResultRow>(text:string,values?:unknown[])=>pool.query<T>(text,values);
export async function transaction<T>(work:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}}
