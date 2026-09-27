import {useRef,useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {Camera,Copy,Mail,Phone} from 'lucide-react';
import {api,errorMessage} from '../services/api/client';
import type {AccountSummary,Envelope,Role} from '../types';

const allowed=['image/jpeg','image/png','image/webp'];
const maxBytes=2*1024*1024;
const roleLabels:Record<Role,string>={SUPER_ADMIN:'Super admin',ADMIN:'Admin',CLIENT:'Client',USER:'User'};

function imageData(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read image'));reader.readAsDataURL(file)})}

export function SidebarProfile({account,userId,role}:{account:AccountSummary|undefined;userId:string|undefined;role?:Role}){
 const input=useRef<HTMLInputElement>(null),cache=useQueryClient(),[issue,setIssue]=useState('');
 const upload=useMutation({mutationFn:async(file:File)=>{if(!allowed.includes(file.type))throw new Error('Choose a JPEG, PNG, or WebP image');if(file.size>maxBytes)throw new Error('Profile photo must be 2 MB or smaller');const dataUri=await imageData(file);return(await api.post<Envelope<{avatarUrl:string}>>('/account-avatar',{dataUri})).data.data},onSuccess:data=>{cache.setQueryData<AccountSummary>(['account-summary',userId],current=>current?{...current,avatarUrl:data.avatarUrl}:current);setIssue('')},onError:error=>setIssue(error instanceof Error&&!('response' in error)?error.message:errorMessage(error))});
 const name=account?.name?.trim()||account?.username||account?.email||'Loading profile…';
 const initials=name.split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join('')||'RI';
 const copy=(value:string)=>{void navigator.clipboard?.writeText(value)};
 return <section className="profile" aria-label="Your profile">
  <div className="profile-card">
   <span className="profile-eyebrow">My profile</span>
   <div className="profile-heading">
    <button type="button" className="avatar-edit" aria-label="Edit profile photo" title="Edit profile photo" disabled={upload.isPending} onClick={()=>input.current?.click()}>
     {account?.avatarUrl?<img src={account.avatarUrl} alt="Your profile"/>:<span>{initials}</span>}
     <Camera className="avatar-camera"/>
    </button>
    <div className="profile-identity"><strong title={name}>{name}</strong>{role&&<span className="profile-role">{roleLabels[role]}</span>}</div>
   </div>
   <div className="profile-contact">
    <div className={`profile-contact-row ${account?.mobile?'':'profile-contact-empty'}`}><Phone aria-hidden="true"/><span title={account?.mobile||''}>{account?.mobile||'No mobile number'}</span>{account?.mobile&&<button type="button" aria-label="Copy phone number" title="Copy phone number" onClick={()=>copy(account.mobile!)}><Copy/></button>}</div>
    <div className={`profile-contact-row ${account?.email?'':'profile-contact-empty'}`}><Mail aria-hidden="true"/><span title={account?.email||''}>{account?.email||'No email address'}</span>{account?.email&&<button type="button" aria-label="Copy email address" title="Copy email address" onClick={()=>copy(account.email)}><Copy/></button>}</div>
   </div>
  </div>
  {issue&&<small className="profile-upload-error" role="alert">{issue}</small>}
  <input ref={input} className="profile-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file){setIssue('');upload.mutate(file)}}}/>
 </section>
}
