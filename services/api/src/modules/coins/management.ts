import type {PoolClient} from 'pg';
import {query,transaction} from '../../db/pool.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';

// Integer hundredths preserve exact numeric(14,2) accounting in JavaScript.
const cents=(value:string|number)=>Math.round(Number(value)*100);
const decimal=(value:number)=>(value/100).toFixed(2);
export const spendableSql=(alias:string)=>`COALESCE((SELECT sum(b.remaining) FROM coin_batches b WHERE b.owner_id=${alias}.id AND b.expires_at>now()),0)`;
// Serialize money mutations and settings changes in the same order, including account edits.
export async function lockCoinLedger(client:PoolClient){const settings=(await client.query<{monthly_target:string;enforce_hard_cap:boolean}>('SELECT monthly_target,enforce_hard_cap FROM issuance_settings FOR UPDATE')).rows[0];if(!settings)throw new AppError(503,'COIN_SETTINGS_MISSING','Coin issuance settings are not configured');return settings}
async function consume(client:PoolClient,ownerId:string,amount:number){
 const batches=await client.query<{id:string;remaining:string}>(`SELECT id,remaining FROM coin_batches WHERE owner_id=$1 AND expires_at>now() AND remaining>0 ORDER BY granted_at,id FOR UPDATE`,[ownerId]);
 if(batches.rows.reduce((sum,b)=>sum+cents(b.remaining),0)<amount)throw new AppError(409,'INSUFFICIENT_COINS','Insufficient non-expired coin balance');
 let pending=amount;
 for(const batch of batches.rows){if(!pending)break;const used=Math.min(pending,cents(batch.remaining));await client.query('UPDATE coin_batches SET remaining=remaining-$2 WHERE id=$1',[batch.id,decimal(used)]);pending-=used}
}
async function syncBalance(client:PoolClient,id:string){await client.query(`UPDATE users u SET coins=${spendableSql('u')},updated_at=now() WHERE u.id=$1 AND u.role IN ('ADMIN','CLIENT')`,[id])}
export async function moveCoins(client:PoolClient,actorId:string,targetId:string,amount:number,type:'DISTRIBUTED'|'RECLAIMED'='DISTRIBUTED'){
 const units=cents(amount);if(!Number.isSafeInteger(units)||units<=0||units>99999999999999||Math.abs(amount*100-units)>0.001)throw new AppError(400,'INVALID_AMOUNT','Coins must be positive with at most two decimal places');
 const settings=await lockCoinLedger(client);
 const scope=await client.query<{id:string;role:string;active:boolean}>(`${userScopeCte} SELECT u.id,u.role,u.active FROM users u JOIN user_scope s ON s.id=u.id WHERE u.id IN ($1,$2) ORDER BY u.id FOR UPDATE OF u`,[actorId,targetId]);
 const actor=scope.rows.find(u=>u.id===actorId),target=scope.rows.find(u=>u.id===targetId);
 if(!actor?.active||!['SUPER_ADMIN','ADMIN'].includes(actor.role)||!target||actorId===targetId||!['ADMIN','CLIENT'].includes(target.role))throw new AppError(403,'COIN_SCOPE','Counterparty is outside your authorized downline');
 if(type==='DISTRIBUTED'&&!target.active)throw new AppError(409,'ACCOUNT_INACTIVE','Cannot grant coins to an inactive account');
 if(type==='DISTRIBUTED'&&actor.role==='SUPER_ADMIN'&&settings.enforce_hard_cap){
 const issued=await client.query<{total:string}>(`SELECT COALESCE(sum(amount),0) total FROM coin_transactions WHERE distributor_id=$1 AND transaction_type='DISTRIBUTED' AND created_at>=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`,[actorId]);
 if(cents(issued.rows[0].total)+units>cents(settings.monthly_target))throw new AppError(409,'ISSUANCE_LIMIT',`Monthly issuance limit of ${settings.monthly_target} coins would be exceeded`);
 }
 if(type==='RECLAIMED')await consume(client,targetId,units);else if(actor.role!=='SUPER_ADMIN')await consume(client,actorId,units);
 const log=await client.query<{id:string}>(`INSERT INTO coin_transactions(distributor_id,counterparty_id,created_by,amount,transaction_type) VALUES($1,$2,$1,$3,$4) RETURNING id`,[actorId,targetId,decimal(units),type]);
 const receiver=type==='DISTRIBUTED'?targetId:actor.role==='ADMIN'?actorId:null;
 if(receiver)await client.query(`INSERT INTO coin_batches(owner_id,amount,remaining,expires_at,source_transaction_id) VALUES($1,$2,$2,now()+interval '1 year',$3)`,[receiver,decimal(units),log.rows[0].id]);
 await syncBalance(client,actorId);await syncBalance(client,targetId);
 return log.rows[0];
}
export const grantCoins=(actorId:string,targetId:string,amount:number)=>transaction(client=>moveCoins(client,actorId,targetId,amount));
export async function recordSale(actorId:string,input:{counterpartyId:string;coinsGranted:number;amountInr:number;paymentReference?:string;note?:string}){
 return transaction(async client=>{
  await moveCoins(client,actorId,input.counterpartyId,input.coinsGranted);
  return (await client.query(`INSERT INTO coin_sales(distributor_id,counterparty_id,coins_granted,amount_inr,recorded_by,payment_reference,note) VALUES($1,$2,$3,$4,$1,$5,$6) RETURNING *`,[actorId,input.counterpartyId,input.coinsGranted,input.amountInr,input.paymentReference||null,input.note||null])).rows[0];
 });
}
export async function updateIssuance(actorId:string,monthlyTarget:number,enforceHardCap:boolean){return transaction(async client=>{await lockCoinLedger(client);return(await client.query('UPDATE issuance_settings SET monthly_target=$1,enforce_hard_cap=$2,updated_by=$3,updated_at=now() RETURNING *',[monthlyTarget,enforceHardCap,actorId])).rows[0]})}
export async function coinFlow(actorId:string,filter:{distributorId?:string;start:Date;end:Date;page:number;pageSize:number}){
 const actor=(await query<{role:string}>('SELECT role FROM users WHERE id=$1',[actorId])).rows[0];
 const distributor=actor.role==='SUPER_ADMIN'?filter.distributorId??null:actorId;
 const values=[actorId,distributor,filter.start,filter.end];
 const salesScope=`${userScopeCte} SELECT sale.*,COALESCE(d.name,d.username,d.email) distributor_name,COALESCE(c.name,c.username,c.email) counterparty_name FROM coin_sales sale JOIN user_scope ds ON ds.id=sale.distributor_id JOIN user_scope cs ON cs.id=sale.counterparty_id JOIN users d ON d.id=sale.distributor_id JOIN users c ON c.id=sale.counterparty_id WHERE ($2::uuid IS NULL OR sale.distributor_id=$2) AND sale.created_at>=$3 AND sale.created_at<$4`;
 const sales=await query(`SELECT *,count(*) OVER()::int total_count FROM (${salesScope}) visible ORDER BY created_at DESC,id LIMIT $5 OFFSET $6`,[...values,filter.pageSize,(filter.page-1)*filter.pageSize]);
 const revenue=await query<{revenue:string;coins:string}>(`SELECT COALESCE(sum(amount_inr),0) revenue,COALESCE(sum(coins_granted),0) coins FROM (${salesScope}) visible`,values);
 const accounts=await query(`${userScopeCte} SELECT u.id,u.owner_id,u.role,u.active,COALESCE(u.name,u.username,u.email) label,CASE WHEN u.role='SUPER_ADMIN' THEN NULL ELSE ${spendableSql('u')} END balance FROM users u JOIN user_scope s ON s.id=u.id ORDER BY u.role,u.name,u.id`,[actorId]);
 const settings=(await query('SELECT * FROM issuance_settings')).rows[0];
 const issued=(await query(`SELECT COALESCE(sum(amount),0) total FROM coin_transactions WHERE distributor_id=$1 AND transaction_type='DISTRIBUTED' AND created_at>=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`,[actorId])).rows[0];
 return {sales:sales.rows.map(row=>{const copy={...row};delete copy.total_count;return copy}),total:Number(sales.rows[0]?.total_count??0),revenue:revenue.rows[0].revenue,salesCoins:revenue.rows[0].coins,accounts:accounts.rows,issuance:actor.role==='SUPER_ADMIN'?{...settings,issued:issued.total,timeZone:'Asia/Kolkata'}:null};
}

export async function issuanceSummary(actorId:string){return (await query(`SELECT settings.*,COALESCE((SELECT sum(amount) FROM coin_transactions WHERE distributor_id=$1 AND transaction_type='DISTRIBUTED' AND created_at>=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'),0) issued FROM issuance_settings settings`,[actorId])).rows[0]}
