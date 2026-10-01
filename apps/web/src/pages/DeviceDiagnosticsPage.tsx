import {useDeferredValue,useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,errorMessage} from '../services/api/client';
import {claims} from '../lib/auth';
import type {AccountSummary,Envelope} from '../types';
import {DataTable,type Column} from '../components/ui/DataTable';
import {StatePanel} from '../components/ui/StatePanel';
import {dateTime} from '../lib/format';

type Device={id:string;imei:string;sim_number:string|null;vehicle_number:string|null;client_name:string|null;client_username:string|null;client_email:string|null;admin_name:string|null;admin_username:string|null;admin_email:string|null;last_seen_at:string|null;packet_health:string;seconds_since_last_packet:number|null;expected_packet_interval_seconds:number};
export function DeviceDiagnosticsPage({health=false}:{health?:boolean}){
  const role=claims()?.role,[search,setSearch]=useState(''),[page,setPage]=useState(1),deferred=useDeferredValue(search);
  const account=useQuery({queryKey:['account-summary',claims()?.id],enabled:health&&role==='ADMIN',queryFn:async()=>(await api.get<Envelope<AccountSummary>>('/account-summary')).data.data,refetchInterval:10000});
  const allowed=role==='SUPER_ADMIN'||(health&&role==='ADMIN'&&account.data?.can_view_packet_health===true);
  useEffect(()=>setPage(1),[deferred]);
  const query=useQuery({queryKey:['device-diagnostics',health,deferred,page],enabled:allowed,queryFn:async()=>(await api.get<Envelope<Device[]>>(`/web/${health?'packet-health':'device-lookup'}`,{params:{search:deferred,page,pageSize:25}})).data,refetchInterval:health?10000:false});
  if(health&&role==='ADMIN'&&account.isLoading)return <StatePanel kind="loading" title="Checking packet-health access"/>;
  if(!allowed)return <StatePanel kind="empty" title="Access unavailable" detail="This screen requires permission from the super-admin."/>;
  const value=(text:string|null)=>text||'Unassigned';
  const columns:Column<Device>[]=[
    {key:'imei',label:'GPS IMEI',render:row=>row.imei},
    {key:'sim',label:'SIM / Mobile Number',render:row=>value(row.sim_number)},
    {key:'vehicle',label:'Current Vehicle',render:row=>value(row.vehicle_number)},
    {key:'client',label:'Owning Client',render:row=>value(row.client_name||row.client_username||row.client_email)},
    {key:'admin',label:'Owning Admin',render:row=>value(row.admin_name||row.admin_username||row.admin_email)},
  ];
  if(health)columns.push(
    {key:'lastPacket',label:'Last Packet',render:row=>dateTime(row.last_seen_at)},
    {key:'age',label:'Seconds Since Packet',render:row=>row.seconds_since_last_packet==null?'Never received':Math.floor(row.seconds_since_last_packet)},
    {key:'cadence',label:'Expected Interval (seconds)',render:row=>row.expected_packet_interval_seconds},
    {key:'health',label:'Packet Health',render:row=>row.packet_health},
  );
  const rows=query.data?.data??[],total=query.data?.pagination?.total??0;
  return <section className="page"><h1>{health?'Packet Health':'GPS / SIM Lookup'}</h1>{health&&<p>Device transmission diagnostics. Refreshes every 10 seconds.</p>}<div className="admin-panel"><div className="panel-toolbar"><label className="search-box"><input aria-label="Search devices" placeholder="Vehicle number, IMEI, or SIM/mobile number" value={search} onChange={event=>setSearch(event.target.value)}/></label></div>{query.isLoading?<StatePanel kind="loading" title="Loading devices"/>:query.isError?<StatePanel kind="error" title="Device information unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:<DataTable columns={columns} rows={rows}/>}<div className="pagination"><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/25))}</span><button disabled={page*25>=total} onClick={()=>setPage(page+1)}>Next</button></div></div></section>;
}
