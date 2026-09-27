import {query} from '../../db/pool.js';
import {userScopeCte} from '../authorization/scope.js';

export interface CoinDistributionQuery {
  adminId?:string;
  start:Date;
  end:Date;
  search:string;
  page:number;
  pageSize:number;
  sort:'username'|'counterParty'|'amount'|'type'|'transactionTime';
  order:'asc'|'desc';
}

const sortColumns={username:'distributor_label',counterParty:'counterparty_label',amount:'amount',type:'transaction_type',transactionTime:'created_at'} as const;

export async function coinAdminOptions(actorId:string){
  return query<{id:string;label:string}>(`${userScopeCte}
    SELECT u.id,COALESCE(NULLIF(TRIM(u.name),''),u.username,u.email) label
    FROM users u JOIN user_scope scope ON scope.id=u.id
    WHERE u.active=true AND u.role IN ('SUPER_ADMIN','ADMIN')
    ORDER BY label,u.id`,[actorId]);
}

export async function coinDistribution(actorId:string,input:CoinDistributionQuery){
  const direction=input.order==='asc'?'ASC':'DESC',sort=sortColumns[input.sort];
  const result=await query<Record<string,unknown>>(`${userScopeCte}, visible AS (
      SELECT t.id,t.amount,t.transaction_type,t.created_at,
        COALESCE(distributor.username,distributor.name,distributor.email) distributor_label,
        COALESCE(counterparty.username,counterparty.name,counterparty.email) counterparty_label
      FROM coin_transactions t
      JOIN user_scope distributor_scope ON distributor_scope.id=t.distributor_id
      JOIN user_scope counterparty_scope ON counterparty_scope.id=t.counterparty_id
      JOIN users distributor ON distributor.id=t.distributor_id
      JOIN users counterparty ON counterparty.id=t.counterparty_id
      WHERE ($2::uuid IS NULL OR t.distributor_id=$2)
        AND t.created_at>=$3 AND t.created_at<$4
        AND ($5='%%' OR COALESCE(distributor.username,distributor.name,distributor.email) ILIKE $5
          OR COALESCE(counterparty.username,counterparty.name,counterparty.email) ILIKE $5
          OR t.transaction_type ILIKE $5)
    )
    SELECT id,distributor_label AS username,counterparty_label AS "counterParty",amount,
      transaction_type AS type,created_at AS "transactionTime",count(*) OVER()::int total_count
    FROM visible ORDER BY ${sort} ${direction},id ${direction} LIMIT $6 OFFSET $7`,
    [actorId,input.adminId??null,input.start,input.end,`%${input.search}%`,input.pageSize,(input.page-1)*input.pageSize]);
  const total=Number(result.rows[0]?.total_count??0);
  return{rows:result.rows.map(row=>{const copy={...row};delete copy.total_count;return copy}),total};
}
