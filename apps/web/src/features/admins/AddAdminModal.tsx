import {useEffect,useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {LoaderCircle} from 'lucide-react';
import {api,errorMessage} from '../../services/api/client';
import type {Admin,Envelope,Owner} from '../../types';
import {Modal} from '../../components/ui/Modal';
import {Button} from '../../components/ui/Button';
import {SearchableSelect} from '../../components/ui/SearchableSelect';

const initial={ownerId:'',username:'',password:'',name:'',mobile:'',email:'',company:'',website:'',address:'',coins:'0',active:true};
type AdminForm=typeof initial;

export function AddAdminModal({open,admin=null,onClose,onSaved}:{open:boolean;admin?:Admin|null;onClose:()=>void;onSaved?:(message:string)=>void}){
  const [form,setForm]=useState<AdminForm>(initial);
  const cache=useQueryClient();
  useEffect(()=>{
    if(open)setForm(admin?{
      ownerId:admin.owner_id||'',username:admin.username||'',password:'',name:admin.name||'',
      mobile:admin.mobile||'',email:admin.email,company:admin.company||'',website:admin.website||'',
      address:admin.address||'',coins:String(admin.coins),active:admin.active
    }:initial);
  },[open,admin]);
  const owners=useQuery({queryKey:['owner-options'],enabled:open,queryFn:async()=>(await api.get<Envelope<Owner[]>>('/admin-owners')).data.data});
  const mutation=useMutation({
    mutationFn:async()=>{
      const {password,ownerId,...details}=form;
      const payload={...details,coins:Number(form.coins)};
      if(admin)await api.patch('/admins/'+admin.id,{...payload,...(ownerId!==admin.owner_id?{ownerId}:{}),...(password?{password}:{})});
      else await api.post('/admins',{...payload,ownerId,password});
    },
    onSuccess:async()=>{
      await cache.invalidateQueries({queryKey:['admins']});
      onSaved?.(admin?'Admin updated successfully.':'Admin created successfully.');
      onClose();
    }
  });
  function field<K extends keyof AdminForm>(key:K,value:AdminForm[K]){setForm(current=>({...current,[key]:value}));mutation.reset()}
  function submit(event:FormEvent){event.preventDefault();mutation.mutate()}
  const currentOwnerMissing=admin?.owner_id&&!owners.data?.some(owner=>owner.id===admin.owner_id);
  return <Modal open={open} title={admin?'Edit admin':'Add admin'} onClose={onClose}>
    <form className="admin-form" onSubmit={submit}>
      <label>Owner<SearchableSelect required aria-label="Owner" placeholder="Select authorized owner" isLoading={owners.isLoading} value={form.ownerId} onChange={value=>field('ownerId',value)} options={[...(currentOwnerMissing?[{value:admin.owner_id!,label:admin.owner_name||admin.owner_email||'Current owner'}]:[]),...(owners.data??[]).map(owner=>({value:owner.id,label:owner.name||owner.username||owner.email}))]}/></label>
      <label>Username<input required minLength={3} maxLength={80} pattern="[A-Za-z0-9._-]+" value={form.username} onChange={e=>field('username',e.target.value)} placeholder="Username"/></label>
      <label>{admin?'New password (optional)':'Password'}<input required={!admin} minLength={8} maxLength={128} type="password" autoComplete="new-password" value={form.password} onChange={e=>field('password',e.target.value)} placeholder={admin?'Leave blank to keep current password':'Minimum 8 characters'}/></label>
      <label>Name<input required maxLength={120} value={form.name} onChange={e=>field('name',e.target.value)} placeholder="Full name"/></label>
      <label>Mobile<input value={form.mobile} onChange={e=>field('mobile',e.target.value)} pattern="\+?[0-9 ()-]{7,20}" placeholder="Mobile number"/></label>
      <label>Email<input required type="email" value={form.email} onChange={e=>field('email',e.target.value)} placeholder="name@company.com"/></label>
      <label>Company<input maxLength={160} value={form.company} onChange={e=>field('company',e.target.value)} placeholder="Company"/></label>
      <label>Website<input type="url" value={form.website} onChange={e=>field('website',e.target.value)} placeholder="https://example.com"/></label>
      <label className="wide">Address<input maxLength={500} value={form.address} onChange={e=>field('address',e.target.value)} placeholder="Business address"/></label>
      <label>Coins<input required type="number" min="0" step="0.01" value={form.coins} onChange={e=>field('coins',e.target.value)}/></label>
      <label className="checkbox"><input type="checkbox" checked={form.active} onChange={e=>field('active',e.target.checked)}/>Active</label>
      {owners.isError&&<div className="form-error wide" role="alert">Could not load authorized owners. {errorMessage(owners.error)}</div>}
      {mutation.isError&&<div className="form-error wide" role="alert">{errorMessage(mutation.error)}</div>}
      <footer className="wide"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><Button disabled={mutation.isPending||(!admin&&owners.isError)}>{mutation.isPending?<><LoaderCircle className="spin"/>Saving…</>:<>{admin?'Save changes':'Save admin'}</>}</Button></footer>
    </form>
  </Modal>;
}
