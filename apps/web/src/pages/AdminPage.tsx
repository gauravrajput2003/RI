import {useDeferredValue,useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Plus,Search,ShieldCheck} from 'lucide-react';
import {api,errorMessage} from '../services/api/client';
import type {Admin,Envelope} from '../types';
import {DataTable,type Column} from '../components/ui/DataTable';
import {StatePanel} from '../components/ui/StatePanel';
import {StatusBadge} from '../components/ui/StatusBadge';
import {AddAdminModal} from '../features/admins/AddAdminModal';
import {dateTime} from '../lib/format';
import {downloadCsv,printTable} from '../lib/tableExport';

const headers=['SN','Username','Vehicle','Sim','Name','Mobile','Email','Company','Active','Owner','Added','Updated','Coins'];

export function AdminPage(){
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[modal,setModal]=useState(false),deferred=useDeferredValue(search),cache=useQueryClient();
 useEffect(()=>setPage(1),[deferred]);
 const query=useQuery({queryKey:['admins',deferred,page],queryFn:async()=>(await api.get<Envelope<Admin[]>>('/admins',{params:{search:deferred,page,pageSize:25}})).data});
 const toggle=useMutation({mutationFn:({id,active}:{id:string;active:boolean})=>api.patch(`/admins/${id}`,{active}),onSuccess:()=>cache.invalidateQueries({queryKey:['admins']})});
 const columns:Column<Admin>[]=[
  {key:'sn',label:'SN',render:(_,index)=>(page-1)*25+index+1},
  {key:'username',label:'Username',render:row=><strong>{row.username||'Unavailable'}</strong>},
  {key:'vehicles',label:'Vehicle',render:row=>row.vehicle_count},
  {key:'devices',label:'Sim',render:row=>row.device_count},
  {key:'name',label:'Name',render:row=>row.name||'Unavailable'},
  {key:'mobile',label:'Mobile',render:row=>row.mobile||'Unavailable'},
  {key:'email',label:'Email',render:row=>row.email},
  {key:'company',label:'Company',render:row=>row.company||'Unavailable'},
  {key:'active',label:'Active',render:row=><button className="status-toggle" onClick={event=>{event.stopPropagation();toggle.mutate({id:row.id,active:!row.active})}}><StatusBadge status={row.active?'RUNNING':'INACTIVE'}/></button>},
  {key:'owner',label:'Owner',render:row=>row.owner_name||row.owner_email||'Unavailable'},
  {key:'added',label:'Added',render:row=>dateTime(row.created_at)},
  {key:'updated',label:'Updated',render:row=>dateTime(row.updated_at)},
  {key:'coins',label:'Coins',render:row=>Number(row.coins).toLocaleString()},
 ];
 const rows=query.data?.data||[],total=query.data?.pagination?.total||0,exportRows=rows.map((row,index)=>[(page-1)*25+index+1,row.username,row.vehicle_count,row.device_count,row.name,row.mobile,row.email,row.company,row.active?'Active':'Inactive',row.owner_name||row.owner_email,dateTime(row.created_at),dateTime(row.updated_at),Number(row.coins)]);
 return <section className="page admin-page"><div className="admin-panel"><div className="panel-toolbar"><label className="search-box"><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search admins" aria-label="Search admins"/></label><div className="toolbar-actions"><button type="button" className="secondary-button admin-add-button" onClick={()=>setModal(true)}><Plus/>Add admin</button><button type="button" className="secondary-button export-button" disabled={!rows.length} title="Print visible rows or save as PDF" onClick={()=>printTable('RI Admins',headers,exportRows)}><img src="/assets/export/pdf.png" alt=""/>PDF</button><button type="button" className="secondary-button export-button" disabled={!rows.length} title="Download visible rows for Excel" onClick={()=>downloadCsv('ri-admins.csv',headers,exportRows)}><img src="/assets/export/xls.png" alt=""/>Excel</button></div></div>{query.isLoading?<StatePanel kind="loading" title="Loading admins"/>:query.isError?<StatePanel kind="error" title="Admin list unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:!rows.length?<StatePanel kind="empty" title="No admins found" detail="Create an admin or adjust your search."/>:<><DataTable columns={columns} rows={rows}/><div className="pagination"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/25))}</span><button disabled={page*25>=total} onClick={()=>setPage(value=>value+1)}>Next</button></div></>}<div className="security-footnote"><ShieldCheck/>Admin visibility and ownership are enforced by the API hierarchy.</div></div><AddAdminModal open={modal} onClose={()=>setModal(false)}/></section>;
}
