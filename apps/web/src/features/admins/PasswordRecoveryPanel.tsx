import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {Copy,Check,LoaderCircle} from 'lucide-react';
import {api,errorMessage} from '../../services/api/client';
import {claims} from '../../lib/auth';

function generatePassword(){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return Array.from(crypto.getRandomValues(new Uint8Array(20)),value=>alphabet[value&63]).join('');
}

export function PasswordRecoveryPanel({id,kind}:{id:string;kind:'admin'|'client'}){
  const [password,setPassword]=useState(''),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState('');
  const reset=useMutation({gcTime:0,mutationFn:async()=>{
    setPassword('');setCopied(false);setCopyError('');
    const next=generatePassword();
    if(kind==='admin')await api.patch(`/admins/${id}`,{password:next});
    else await api.post(`/clients/${id}/reset-password`,{password:next,confirmPassword:next});
    setPassword(next);
  }});
  async function copy(){
    try{await navigator.clipboard.writeText(password);setCopied(true);setCopyError('')}
    catch{setCopied(false);setCopyError('Could not access the clipboard. Select the password and copy it manually.')}
  }
  if(claims()?.role!=='SUPER_ADMIN')return null;
  return <section className="wide password-recovery" aria-label="Password recovery">
    <p>{password?'New password saved. Copy it for the account owner before closing this preview.':'Forgotten password? Generate a new password for this account. This replaces its current password.'}</p>
    <button type="button" className="secondary-button" disabled={reset.isPending} onClick={()=>reset.mutate()}>{reset.isPending?<><LoaderCircle className="spin"/>Resetting password…</>:'Generate and reset password'}</button>
    {password&&<div className="password-recovery-result"><label>New password<input type="text" autoComplete="off" readOnly value={password}/></label><button type="button" className="secondary-button" onClick={()=>void copy()} aria-label="Copy password">{copied?<Check/>:<Copy/>}{copied?'Copied':'Copy password'}</button></div>}
    {copied&&<span role="status">Password copied.</span>}
    {reset.isError&&<div className="form-error" role="alert">{errorMessage(reset.error)}</div>}
    {copyError&&<div className="form-error" role="alert">{copyError}</div>}
  </section>;
}
