import {useState} from 'react';
import type {LucideIcon} from 'lucide-react';
import type {FleetStatus} from '../../types';
import {STATUS_COLORS} from '../../utils/vehicleIcons.js';

export function FilterPill({status,label,count,icon:Icon,active,onClick}:{status:FleetStatus;label:string;count:number|undefined;icon:LucideIcon;active:boolean;onClick:()=>void}){
 const [imageFailed,setImageFailed]=useState(false);
 const colors=status==='RUNNING'?STATUS_COLORS.running:status==='IDLE'?STATUS_COLORS.idle:status==='STOPPED'?STATUS_COLORS.stopped:status==='UNREACHABLE'?STATUS_COLORS.unreachable:undefined;
 const imagePath=`/assets/vehicle-icons/status/${status.toLowerCase()}.png`;
 return <button type="button" data-status={status} className={`status-card card-${status.toLowerCase()} ${active?'active':''}`} aria-pressed={active} onClick={onClick}><span style={colors?{color:colors.main,backgroundColor:`${colors.main}18`}:undefined}>{imageFailed?<Icon/>:<img src={imagePath} alt="" aria-hidden="true" onError={()=>setImageFailed(true)}/>}</span><div><strong>{count??'â€”'}</strong><small>{label}</small></div></button>;
}
