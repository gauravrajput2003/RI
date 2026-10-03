import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import bcrypt from 'bcrypt';
import {env} from '../../config/env.js';
import {transaction} from '../../db/pool.js';
import {AppError} from '../../lib/errors.js';
import {userScopeCte} from '../authorization/scope.js';

export function sealPassword(password:string):string|null{
  if(!env.ACCOUNT_PASSWORD_ENCRYPTION_KEY)return null;
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(env.ACCOUNT_PASSWORD_ENCRYPTION_KEY,'hex'),nonce);
  const encrypted=Buffer.concat([cipher.update(password,'utf8'),cipher.final()]);
  return ['v1',nonce.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.');
}
export function openPassword(sealed:string):string{
  if(!env.ACCOUNT_PASSWORD_ENCRYPTION_KEY)throw new AppError(503,'RECOVERY_UNAVAILABLE','Password recovery is not configured');
  try{
    const [version,nonce,tag,value]=sealed.split('.');if(version!=='v1')throw new Error('Invalid version');
    const decipher=createDecipheriv('aes-256-gcm',Buffer.from(env.ACCOUNT_PASSWORD_ENCRYPTION_KEY,'hex'),Buffer.from(nonce,'base64'));
    decipher.setAuthTag(Buffer.from(tag,'base64'));
    return Buffer.concat([decipher.update(Buffer.from(value,'base64')),decipher.final()]).toString('utf8');
  }catch{throw new AppError(503,'RECOVERY_UNAVAILABLE','Stored password cannot be decrypted with the configured key')}
}

export async function recoverPassword(actorId:string,targetId:string,superAdminPassword:string,action:'REVEAL'|'RESET'){
  return transaction(async client=>{
    const actor=await client.query<{password_hash:string}>("SELECT password_hash FROM users WHERE id=$1 AND role='SUPER_ADMIN' AND active=true FOR SHARE",[actorId]);
    if(!actor.rows[0])throw new AppError(403,'FORBIDDEN','Only the super-admin can view passwords');
    if(!await bcrypt.compare(superAdminPassword,actor.rows[0].password_hash))throw new AppError(403,'INVALID_CONFIRMATION','Super-admin password is incorrect');
    const target=await client.query<{password_recovery_ciphertext:string|null;password_hash:string}>(`${userScopeCte} SELECT u.password_recovery_ciphertext,u.password_hash FROM users u JOIN user_scope s ON s.id=u.id WHERE u.id=$2 AND u.role IN ('ADMIN','CLIENT') FOR UPDATE OF u`,[actorId,targetId]);
    if(!target.rows[0])throw new AppError(404,'ACCOUNT_NOT_FOUND','Account not found');
    let password:string|null=null;
    if(action==='RESET'){
      if(!env.ACCOUNT_PASSWORD_ENCRYPTION_KEY)throw new AppError(503,'RECOVERY_UNAVAILABLE','Password recovery is not configured');
      password=randomBytes(18).toString('base64url');
      await client.query('UPDATE users SET password_hash=$2,password_recovery_ciphertext=$3,updated_at=now() WHERE id=$1',[targetId,await bcrypt.hash(password,12),sealPassword(password)]);
      await client.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL',[targetId]);
    }else if(target.rows[0].password_recovery_ciphertext){password=openPassword(target.rows[0].password_recovery_ciphertext);if(!await bcrypt.compare(password,target.rows[0].password_hash))password=null}
    await client.query('INSERT INTO password_access_audit(actor_id,target_id,action) VALUES($1,$2,$3)',[actorId,targetId,action]);
    return {password,recoverable:password!==null};
  });
}
