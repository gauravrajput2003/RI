import {useEffect,useRef,useState} from 'react';
import {Copy,Check,Eye,LoaderCircle} from 'lucide-react';
import {api,errorMessage} from '../../services/api/client';
import {claims} from '../../lib/auth';
import type {Envelope} from '../../types';

export function PasswordRecoveryPanel({id,kind,initialPassword,onVerified}:{id:string;kind:'admin'|'client';initialPassword?:string|null;onVerified?:(password:string|null)=>void}){
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false}},[]);
 const [password,setPassword]=useState<string|null|undefined>(initialPassword),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 async function request(action:'REVEAL'|'RESET'){
  setBusy(true);setError('');setCopied(false);
  try{const {data}=await api.post<Envelope<{password:string|null}>>(`/users/${id}/password-recovery`,{superAdminPassword:confirmation,action});if(!active.current)return;setPassword(data.data.password);setConfirmation('');onVerified?.(data.data.password)}
  catch(cause){if(active.current){setPassword(undefined);setError(errorMessage(cause))}}finally{if(active.current)setBusy(false)}
 }
 async function copy(){try{await navigator.clipboard.writeText(password!);setCopied(true);setError('')}catch{setError('Could not access the clipboard. Select the password and copy it manually.')}}
 if(claims()?.role!=='SUPER_ADMIN')return null;
 return <section className="wide password-recovery" aria-label="Password recovery">
  {password&&<div className="password-recovery-result"><label>Account password<input type="text" autoComplete="off" readOnly value={password}/></label><button type="button" className="secondary-button" onClick={()=>void copy()} aria-label="Copy password">{copied?<Check/>:<Copy/>}{copied?'Copied':'Copy password'}</button></div>}
  {password===null&&<p>This older account has no recoverable password yet. It will be available after its next login, or you can generate a replacement below.</p>}
  {!password&&<><p>Confirm your super-admin password to {password===null?'reset':'preview'} this {kind} account’s password.</p><label>Super-admin password<input type="password" autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><div className="password-recovery-actions"><button type="button" className="secondary-button" disabled={busy||!confirmation} onClick={()=>void request('REVEAL')}>{busy?<LoaderCircle className="spin"/>:<Eye/>}Verify and preview</button>{password===null&&<button type="button" className="secondary-button" disabled={busy||!confirmation} onClick={()=>void request('RESET')}>Generate and reset password</button>}</div></>}
  {copied&&<span role="status">Password copied.</span>}{error&&<div className="form-error" role="alert">{error}</div>}
 </section>;
}
