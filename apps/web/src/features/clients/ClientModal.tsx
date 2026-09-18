import {useEffect,useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Check,LoaderCircle} from 'lucide-react';
import {api,errorMessage} from '../../services/api/client';
import type {Client,Envelope,Owner} from '../../types';
import {Modal} from '../../components/ui/Modal';
import {Button} from '../../components/ui/Button';

const empty={ownerId:'',username:'',password:'',name:'',mobile:'',email:'',company:'',website:'',address:'',inactiveTimeoutSeconds:'43200',active:true};
const timeoutOptions=[['3600','1 Hour'],['21600','6 Hours'],['43200','12 Hours'],['86400','24 Hours'],['172800','48 Hours']];

export function ClientModal({open,client,onClose}:{open:boolean;client:Client|null;onClose:()=>void}){
  const [form,setForm]=useState(empty),[success,setSuccess]=useState('');const cache=useQueryClient();
  useEffect(()=>{if(open)setForm(client?{ownerId:client.owner_id,username:client.username||'',password:'',name:client.name||'',mobile:client.mobile||'',email:client.email,company:client.company||'',website:client.website||'',address:client.address||'',inactiveTimeoutSeconds:String(client.inactive_timeout_seconds),active:client.active}:empty)},[open,client]);
  const owners=useQuery({queryKey:['client-owner-options'],enabled:open&&!client,queryFn:async()=>(await api.get<Envelope<Owner[]>>('/client-owners')).data.data});
  const mutation=useMutation({mutationFn:async()=>client?api.patch(`/clients/${client.id}`,{username:form.username,name:form.name||null,mobile:form.mobile||null,email:form.email,company:form.company||null,website:form.website||null,address:form.address||null,inactiveTimeoutSeconds:Number(form.inactiveTimeoutSeconds),active:form.active}):api.post('/clients',{...form,inactiveTimeoutSeconds:Number(form.inactiveTimeoutSeconds)}),onSuccess:async()=>{await cache.invalidateQueries({queryKey:['clients']});setSuccess(client?'Client updated successfully.':'Client created successfully.');setTimeout(()=>{setSuccess('');onClose()},600)}});
  function field<K extends keyof typeof empty>(key:K,value:(typeof empty)[K]){setForm(current=>({...current,[key]:value}));mutation.reset();setSuccess('')}
  function submit(event:FormEvent){event.preventDefault();mutation.mutate()}
  return <Modal open={open} title={client?'Edit client':'Add client'} onClose={onClose}><form className="admin-form client-form" onSubmit={submit}>
    {!client&&<label>Owner<select required aria-label="Owner" value={form.ownerId} onChange={e=>field('ownerId',e.target.value)}><option value="">Select authorized admin</option>{owners.data?.map(owner=><option key={owner.id} value={owner.id}>{owner.name||owner.username||owner.email}</option>)}</select></label>}
    <label>Username<input required minLength={3} pattern="[A-Za-z0-9._-]+" value={form.username} onChange={e=>field('username',e.target.value)} placeholder="Username"/></label>
    {!client&&<label>Password<input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e=>field('password',e.target.value)} placeholder="Minimum 8 characters"/></label>}
    <label>Name<input value={form.name} onChange={e=>field('name',e.target.value)} placeholder="Full name"/></label>
    <label>Mobile<input value={form.mobile} onChange={e=>field('mobile',e.target.value)} pattern="\+?[0-9 ()-]{7,20}" placeholder="Mobile number"/></label>
    <label>Email<input required type="email" value={form.email} onChange={e=>field('email',e.target.value)} placeholder="name@company.com"/></label>
    <label>Company<input value={form.company} onChange={e=>field('company',e.target.value)} placeholder="Company"/></label>
    <label>Website<input type="url" value={form.website} onChange={e=>field('website',e.target.value)} placeholder="https://example.com"/></label>
    <label className="wide">Address<input value={form.address} onChange={e=>field('address',e.target.value)} placeholder="Business address"/></label>
    <label>Inactive time<select required value={form.inactiveTimeoutSeconds} onChange={e=>field('inactiveTimeoutSeconds',e.target.value)}>{timeoutOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="checkbox"><input type="checkbox" checked={form.active} onChange={e=>field('active',e.target.checked)}/>Active</label>
    {!client&&owners.isLoading&&<div className="form-success wide">Loading authorized admins…</div>}
    {!client&&owners.isError&&<div className="form-error wide" role="alert">Could not load authorized admins. {errorMessage(owners.error)}</div>}
    {mutation.isError&&<div className="form-error wide" role="alert">{errorMessage(mutation.error)}</div>}{success&&<div className="form-success wide"><Check/>{success}</div>}
    <footer className="wide"><button type="button" className="secondary-button" onClick={onClose}>Close</button><Button disabled={mutation.isPending}>{mutation.isPending?<><LoaderCircle className="spin"/>Saving…</>:<>{client?'Save changes':'Save client'}</>}</Button></footer>
  </form></Modal>;
}
