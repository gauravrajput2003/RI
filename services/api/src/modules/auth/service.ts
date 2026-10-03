import {sealPassword} from './password-recovery.js';
import bcrypt from 'bcrypt'; import crypto from 'node:crypto'; import jwt from 'jsonwebtoken'; import {query} from '../../db/pool.js'; import {env} from '../../config/env.js'; import {AppError} from '../../lib/errors.js'; import type {Role} from '@fleet/shared-types';
type User={id:string;email:string;password_hash:string;role:Role}; const hash=(x:string)=>crypto.createHash('sha256').update(x).digest('hex');
const issue=(u:User)=>({accessToken:jwt.sign({id:u.id,role:u.role},env.JWT_SECRET,{expiresIn:'15m'}),refreshToken:jwt.sign({id:u.id,role:u.role},env.JWT_REFRESH_SECRET,{expiresIn:'30d',jwtid:crypto.randomUUID()})});
export async function login(identifier:string,password:string){
  const value=identifier.trim().toLowerCase();
  const r=await query<User>('SELECT id,email,password_hash,role FROM users WHERE active=true AND (lower(username)=$1 OR lower(email)=$1)',[value]);
  const matches:User[]=[];
  for(const user of r.rows)if(await bcrypt.compare(password,user.password_hash))matches.push(user);
  if(matches.length!==1)throw new AppError(401,'INVALID_CREDENTIALS','Invalid username or password');
  const sealed=sealPassword(password);
  if(sealed&&['ADMIN','CLIENT'].includes(matches[0].role))await query('UPDATE users SET password_recovery_ciphertext=$2 WHERE id=$1 AND password_hash=$3',[matches[0].id,sealed,matches[0].password_hash]);
  const tokens=issue(matches[0]);
  await query('INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval \'30 days\')',[matches[0].id,hash(tokens.refreshToken)]);
  return tokens;
}
export async function refresh(token:string){let claims:{id:string;role:Role};try{claims=jwt.verify(token,env.JWT_REFRESH_SECRET) as typeof claims}catch{throw new AppError(401,'INVALID_REFRESH_TOKEN','Invalid refresh token')}const r=await query<User>('SELECT u.id,u.email,u.password_hash,u.role FROM users u JOIN refresh_tokens t ON t.user_id=u.id WHERE u.active=true AND t.token_hash=$1 AND t.revoked_at IS NULL AND t.expires_at>now()',[hash(token)]);if(!r.rows[0])throw new AppError(401,'INVALID_REFRESH_TOKEN','Invalid refresh token');await query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1',[hash(token)]);const tokens=issue(r.rows[0]);await query('INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval \'30 days\')',[claims.id,hash(tokens.refreshToken)]);return tokens}
export const logout=(token:string)=>query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1',[hash(token)]);
