import {useState} from 'react';
import type {LucideIcon} from 'lucide-react';
import type {FleetStatus} from '../../types';

export function FilterPill({status,label,count,icon:Icon,active,onClick}:{status:FleetStatus;label:string;count:number|undefined;icon:LucideIcon;active:boolean;onClick:()=>void}){
 const [imageFailed,setImageFailed]=useState(false);
 const imagePath=`/assets/vehicle-icons/status/${status.toLowerCase()}.png`;
 return <button type="button" data-status={status} className={`status-card card-${status.toLowerCase()} ${active?'active':''}`} aria-pressed={active} onClick={onClick}><span>{imageFailed?<Icon/>:<img src={imagePath} alt="" aria-hidden="true" onError={()=>setImageFailed(true)}/>}</span><div><strong>{count??'—'}</strong><small>{label}</small></div></button>;
}
