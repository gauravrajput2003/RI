import {useState,type FormEvent} from 'react';
import {Navigate,useNavigate} from 'react-router-dom';
import {ArrowRight,Eye,EyeOff,LockKeyhole,UserRound} from 'lucide-react';
import mobileLogo from '../../../mobile/assets/loginlogo.png';
import {api,errorMessage} from '../services/api/client';
import {getTokens,setTokens} from '../lib/auth';
import type {Envelope,Tokens} from '../types';
import {Button} from '../components/ui/Button';
import './login.css';

export function LoginPage(){
  const navigate=useNavigate();
  const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  if(getTokens())return <Navigate to="/dashboard" replace/>;
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{const {data}=await api.post<Envelope<Tokens>>('/auth/login',{identifier:identifier.trim(),password});setTokens(data.data);navigate('/dashboard',{replace:true})}catch(cause){setError(errorMessage(cause))}finally{setBusy(false)}}
  return <main className="target-login-page">
    <div className="target-login-shade"/>
    <form className="target-login-card" onSubmit={submit}>
      <img className="target-login-logo" src={mobileLogo} alt="RI logo"/>
      <div className="target-login-fields">
        <label htmlFor="login-username">Username</label>
        <div className="target-login-input"><UserRound/><input id="login-username" type="text" autoComplete="username" value={identifier} onChange={event=>setIdentifier(event.target.value)} placeholder="Username" required/></div>
        <label htmlFor="login-password">Password</label>
        <div className="target-login-input"><LockKeyhole/><input id="login-password" type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Password" minLength={8} required/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff/>:<Eye/>}</button></div>
      </div>
      {error&&<div className="form-error" role="alert">{error}</div>}
      <Button disabled={busy} className="target-login-button">{busy?'Signing in…':<>Login <ArrowRight/></>}</Button>
      <p className="target-login-note"><LockKeyhole/>Secure access to your authorized fleet</p>
    </form>
  </main>
}
