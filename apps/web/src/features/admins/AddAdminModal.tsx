import {useEffect,useState,type FormEvent} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {Eye,EyeOff,LoaderCircle} from 'lucide-react';
import {api,errorMessage} from '../../services/api/client';
import type {Admin} from '../../types';
import {Modal} from '../../components/ui/Modal';
import {Button} from '../../components/ui/Button';
import {claims} from '../../lib/auth';
import {PasswordRecoveryPanel} from './PasswordRecoveryPanel';
import {usePermissions} from '../../lib/permissions';
import {PERMISSIONS} from '../../../../../packages/shared-types/src/permissions';

const initial={username:'',password:'',name:'',mobile:'',email:'',company:'',website:'',address:'',coins:'0',active:true,canViewPacketHealth:false};
type AdminForm=typeof initial;

export function AddAdminModal({open,admin=null,onClose,onSaved,readOnly=false,recoveredPassword}:{recoveredPassword?:string|null;readOnly?:boolean;open:boolean;admin?:Admin|null;onClose:()=>void;onSaved?:(message:string)=>void}){
  const {hasPermission}=usePermissions();
  const [form,setForm]=useState<AdminForm>(initial),[showPassword,setShowPassword]=useState(false);
  const cache=useQueryClient();
  useEffect(()=>{
    setShowPassword(false);
    if(open)setForm(admin?{
      username:admin.username||'',password:'',name:admin.name||'',
      mobile:admin.mobile||'',email:admin.email,company:admin.company||'',website:admin.website||'',
      address:admin.address||'',coins:String(admin.coins),active:admin.active,canViewPacketHealth:admin.can_view_packet_health??false
    }:initial);
  },[open,admin]);
  const mutation=useMutation({
    mutationFn:async()=>{
      if(readOnly)return;
      const {password,canViewPacketHealth,coins,...details}=form;
      const payload={...details,...(hasPermission(PERMISSIONS.coinDistributionAdd)?{coins:Number(coins)}:{}),...(admin&&claims()?.role==='SUPER_ADMIN'?{canViewPacketHealth}:{})};
      if(admin)await api.patch('/admins/'+admin.id,{...payload,...(password?{password}:{})});
      else await api.post('/admins',{...payload,password});
    },
    onSuccess:async()=>{
      await cache.invalidateQueries({queryKey:['admins']});
      onSaved?.(admin?'Admin updated successfully.':'Admin created successfully.');
      onClose();
    }
  });
  function field<K extends keyof AdminForm>(key:K,value:AdminForm[K]){setForm(current=>({...current,[key]:value}));mutation.reset()}
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!readOnly&&event.currentTarget.checkValidity()&&(admin&&!form.password||form.password.length>=8&&form.password.length<=128))mutation.mutate()}
  return <Modal open={open} title={readOnly?'Preview admin':admin?'Edit admin':'Add admin'} onClose={onClose}>
    <form className="admin-form" onSubmit={submit}><fieldset disabled={readOnly} style={{display:'contents'}} aria-label="Admin details">
      {admin&&<label>Owner<input readOnly value={admin.owner_name||admin.owner_email||'Current owner'}/></label>}
      <label>Username<input required minLength={3} maxLength={80} pattern="[A-Za-z0-9._-]+" value={form.username} onChange={e=>field('username',e.target.value)} placeholder="Username"/></label>
      {!readOnly&&<label>Password<div className="admin-password-input"><input required={!admin} minLength={8} maxLength={128} type={showPassword?'text':'password'} autoComplete="new-password" value={form.password} onChange={e=>field('password',e.target.value)} placeholder={admin?'Leave blank to keep current password':'Minimum 8 characters'}/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>}
      <label>Name<input required maxLength={120} value={form.name} onChange={e=>field('name',e.target.value)} placeholder="Full name"/></label>
      <label>Mobile<input value={form.mobile} onChange={e=>field('mobile',e.target.value)} pattern="\+?[0-9 ()-]{7,20}" placeholder="Mobile number"/></label>
      <label>Email<input required type="email" value={form.email} onChange={e=>field('email',e.target.value)} placeholder="name@company.com"/></label>
      <label>Company<input maxLength={160} value={form.company} onChange={e=>field('company',e.target.value)} placeholder="Company"/></label>
      <label>Website<input type="url" value={form.website} onChange={e=>field('website',e.target.value)} placeholder="https://example.com"/></label>
      <label className="wide">Address<input maxLength={500} value={form.address} onChange={e=>field('address',e.target.value)} placeholder="Business address"/></label>
      <label>Coins<input disabled={!hasPermission(PERMISSIONS.coinDistributionAdd)} required type="number" min="0" step="0.01" value={form.coins} onChange={e=>field('coins',e.target.value)}/></label>
      <label className="checkbox"><input type="checkbox" checked={form.active} onChange={e=>field('active',e.target.checked)}/>Active</label>
      {(claims()?.role==='SUPER_ADMIN'||readOnly)&&admin&&<label className="checkbox"><input type="checkbox" checked={form.canViewPacketHealth} onChange={e=>field('canViewPacketHealth',e.target.checked)}/>Can view packet health</label>}
      </fieldset>{readOnly&&admin&&<PasswordRecoveryPanel key={admin.id} id={admin.id} kind="admin" initialPassword={recoveredPassword}/>}
      {mutation.isError&&<div className="form-error wide" role="alert">{errorMessage(mutation.error)}</div>}
      <footer className="wide"><button type="button" className="secondary-button" onClick={onClose}>{readOnly?'Close':'Cancel'}</button>{!readOnly&&<Button disabled={mutation.isPending}>{mutation.isPending?<><LoaderCircle className="spin"/>Saving…</>:<>{admin?'Save changes':'Save admin'}</>}</Button>}</footer>
    </form>
  </Modal>;
}
