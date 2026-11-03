import {sealPassword} from './password-recovery.js';
import bcrypt from 'bcrypt'; import crypto from 'node:crypto'; import jwt from 'jsonwebtoken'; import {query,transaction} from '../../db/pool.js'; import {env} from '../../config/env.js'; import {AppError} from '../../lib/errors.js'; import type {Role} from '@fleet/shared-types';
type User={id:string;email:string;password_hash:string;role:Role;max_login_devices:number}; const hash=(x:string)=>crypto.createHash('sha256').update(x).digest('hex');
const issue=(u:User,sid:string)=>({accessToken:jwt.sign({id:u.id,role:u.role,sid},env.JWT_SECRET,{expiresIn:'15m'}),refreshToken:jwt.sign({id:u.id,role:u.role,sid},env.JWT_REFRESH_SECRET,{expiresIn:'30d',jwtid:crypto.randomUUID()})});
export async function login(identifier:string,password:string,deviceId:string=crypto.randomUUID()){
  const value=identifier.trim().toLowerCase();
  const r=await query<User>('SELECT id,email,password_hash,role,max_login_devices FROM users WHERE active=true AND (lower(username)=$1 OR lower(email)=$1)',[value]);
  const matches:User[]=[];
  for(const user of r.rows)if(await bcrypt.compare(password,user.password_hash))matches.push(user);
  if(matches.length!==1)throw new AppError(401,'INVALID_CREDENTIALS','Invalid username or password');
  const sealed=sealPassword(password);
  if(sealed&&['ADMIN','CLIENT'].includes(matches[0].role))await query('UPDATE users SET password_recovery_ciphertext=$2 WHERE id=$1 AND password_hash=$3',[matches[0].id,sealed,matches[0].password_hash]);
  return transaction(async db=>{
 const user=(await db.query<User>('SELECT * FROM users WHERE id=$1 AND active=true FOR UPDATE',[matches[0].id])).rows[0];
 if(!user||user.password_hash!==matches[0].password_hash)throw new AppError(401,'INVALID_CREDENTIALS','Invalid username or password');
 const same=(await db.query<{session_id:string}>("SELECT session_id FROM refresh_tokens WHERE user_id=$1 AND device_id=$2 AND revoked_at IS NULL AND expires_at>now() LIMIT 1",[user.id,deviceId])).rows[0];
 const count=(await db.query<{count:string}>("SELECT count(DISTINCT session_id) FROM refresh_tokens WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now()",[user.id])).rows[0];
 if(user.role==='CLIENT'&&!same&&Number(count.count)>=user.max_login_devices)throw new AppError(409,'DEVICE_LIMIT_REACHED',`This account allows ${user.max_login_devices} devices. Log out on another device or contact your administrator.`);
 const sid=same?.session_id??crypto.randomUUID();
 await db.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND session_id=$2 AND revoked_at IS NULL',[user.id,sid]);
 const tokens=issue(user,sid);
 await db.query("INSERT INTO refresh_tokens(user_id,token_hash,expires_at,session_id,device_id) VALUES($1,$2,now()+interval '30 days',$3,$4)",[user.id,hash(tokens.refreshToken),sid,deviceId]);return tokens;
 });
}
export async function refresh(token:string){
 try{jwt.verify(token,env.JWT_REFRESH_SECRET)}catch{throw new AppError(401,'INVALID_REFRESH_TOKEN','Invalid refresh token')}
 return transaction(async db=>{
 const row=(await db.query<User&{session_id:string;device_id:string|null}>("SELECT u.*,t.session_id,t.device_id FROM users u JOIN refresh_tokens t ON t.user_id=u.id WHERE u.active=true AND t.token_hash=$1 AND t.revoked_at IS NULL AND t.expires_at>now() FOR UPDATE OF u,t",[hash(token)])).rows[0];
 if(!row)throw new AppError(401,'INVALID_REFRESH_TOKEN','Invalid refresh token');
 await db.query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1',[hash(token)]);
 const tokens=issue(row,row.session_id);
 await db.query("INSERT INTO refresh_tokens(user_id,token_hash,expires_at,session_id,device_id) VALUES($1,$2,now()+interval '30 days',$3,$4)",[row.id,hash(tokens.refreshToken),row.session_id,row.device_id]);return tokens;
 });
}
export const logout=(token:string)=>query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=(SELECT user_id FROM refresh_tokens WHERE token_hash=$1) AND session_id=(SELECT session_id FROM refresh_tokens WHERE token_hash=$1) AND revoked_at IS NULL',[hash(token)]);
export async function activeSession(userId:string,sid:string){return Boolean((await query('SELECT 1 FROM refresh_tokens WHERE user_id=$1 AND session_id=$2 AND revoked_at IS NULL AND expires_at>now()',[userId,sid])).rows.length)}
