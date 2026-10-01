import {useDeferredValue,useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Eye,Trash2,PenLine,Plus,Search,ShieldCheck} from 'lucide-react';
import {api,errorMessage} from '../services/api/client';
import type {Admin,Envelope} from '../types';
import {DataTable,type Column} from '../components/ui/DataTable';
import {StatePanel} from '../components/ui/StatePanel';
import {StatusBadge} from '../components/ui/StatusBadge';
import {AddAdminModal} from '../features/admins/AddAdminModal';
import {claims} from '../lib/auth';
import {dateTime} from '../lib/format';
import {downloadCsv,printTable} from '../lib/tableExport';

const headers=['SN','Username','Vehicle','Sim','Name','Mobile','Email','Company','Active','Owner','Added','Updated','Coins'];

export function AdminPage(){
 const [readOnly,setReadOnly]=useState(false);
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[modal,setModal]=useState(false),[selected,setSelected]=useState<Admin|null>(null),[message,setMessage]=useState(''),deferred=useDeferredValue(search),cache=useQueryClient();
 useEffect(()=>setPage(1),[deferred]);
 const query=useQuery({queryKey:['admins',deferred,page],queryFn:async()=>(await api.get<Envelope<Admin[]>>('/admins',{params:{search:deferred,page,pageSize:25}})).data});
 const toggle=useMutation({mutationFn:({id,active}:{id:string;active:boolean})=>api.patch(claims()?.role==='SUPER_ADMIN'?`/users/${id}/lock`:`/admins/${id}`,claims()?.role==='SUPER_ADMIN'?{locked:!active}:{active}),onSuccess:()=>cache.invalidateQueries({queryKey:['admins']})});
 const columns:Column<Admin>[]=[
  {key:'sn',label:'SN',render:(_,index)=>(page-1)*25+index+1},
  {key:'username',label:'Username',render:row=><strong>{row.username||'Unavailable'}</strong>},
  {key:'vehicles',label:'Vehicle',render:row=>row.vehicle_count},
  {key:'devices',label:'Sim',render:row=>row.device_count},
  {key:'name',label:'Name',render:row=>row.name||'Unavailable'},
  {key:'mobile',label:'Mobile',render:row=>row.mobile||'Unavailable'},
  {key:'email',label:'Email',render:row=>row.email},
  {key:'company',label:'Company',render:row=>row.company||'Unavailable'},
  {key:'active',label:'Active',render:row=><button className="status-toggle" aria-label={`${row.active?'Lock':'Unlock'} ${row.username||row.email}`} onClick={event=>{event.stopPropagation();toggle.mutate({id:row.id,active:!row.active})}}><StatusBadge status={row.active?'RUNNING':'INACTIVE'}/></button>},
  {key:'owner',label:'Owner',render:row=>row.owner_name||row.owner_email||'Unavailable'},
  {key:'added',label:'Added',render:row=>dateTime(row.created_at)},
  {key:'updated',label:'Updated',render:row=>dateTime(row.updated_at)},
  {key:'coins',label:'Coins',render:row=>Number(row.coins).toLocaleString()},
  {key:'preview',label:'Preview',render:row=><button type="button" className="table-action" onClick={()=>{setReadOnly(true);setSelected(row);setModal(true)}} aria-label={`Preview ${row.username||row.email}`}><Eye/>Preview</button>},
  {key:'delete',label:'Deactivate',render:row=><button type="button" className="table-action" disabled={toggle.isPending||!row.active} onClick={()=>toggle.mutate({id:row.id,active:false})} aria-label={`Deactivate ${row.username||row.email}`}><Trash2/>Deactivate</button>},
  {key:'edit',label:'Edit',render:row=><button type="button" className="table-action" onClick={event=>{event.stopPropagation();setReadOnly(false);setSelected(row);setMessage('');setModal(true)}} aria-label={`Edit ${row.username||row.email}`}><PenLine/>Edit</button>},
 ];
 const rows=query.data?.data||[],total=query.data?.pagination?.total||0,exportRows=rows.map((row,index)=>[(page-1)*25+index+1,row.username,row.vehicle_count,row.device_count,row.name,row.mobile,row.email,row.company,row.active?'Active':'Inactive',row.owner_name||row.owner_email,dateTime(row.created_at),dateTime(row.updated_at),Number(row.coins)]);
 return <section className="page admin-page"><div className="admin-panel"><div className="panel-toolbar"><label className="search-box"><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search admins" aria-label="Search admins"/></label><div className="toolbar-actions"><button type="button" className="secondary-button management-add-button" onClick={()=>{setReadOnly(false);setSelected(null);setMessage('');setModal(true)}}><Plus/>Add admin</button><button type="button" className="secondary-button export-button" disabled={!rows.length} title="Print visible rows or save as PDF" onClick={()=>printTable('RI Admins',headers,exportRows)}><img src="/assets/export/pdf.png" alt=""/>PDF</button><button type="button" className="secondary-button export-button" disabled={!rows.length} title="Download visible rows for Excel" onClick={()=>downloadCsv('ri-admins.csv',headers,exportRows)}><img src="/assets/export/xls.png" alt=""/>Excel</button></div></div>{message&&<div className="form-success" role="status">{message}</div>}{toggle.isError&&<div className="inline-error" role="alert">{errorMessage(toggle.error)}</div>}{query.isLoading?<StatePanel kind="loading" title="Loading admins"/>:query.isError?<StatePanel kind="error" title="Admin list unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:!rows.length?<StatePanel kind="empty" title="No admins found" detail="Create an admin or adjust your search."/>:<><DataTable columns={columns} rows={rows}/><div className="pagination"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/25))}</span><button disabled={page*25>=total} onClick={()=>setPage(value=>value+1)}>Next</button></div></>}<div className="security-footnote"><ShieldCheck/>Admin visibility and ownership are enforced by the API hierarchy.</div></div><AddAdminModal readOnly={readOnly} open={modal} admin={selected} onClose={()=>{setModal(false);setSelected(null)}} onSaved={setMessage}/></section>;
}
