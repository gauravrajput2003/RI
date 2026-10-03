import {useDeferredValue,useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Eye,KeyRound,Lock,PenLine,Plus,Search,ShieldCheck,Trash2} from 'lucide-react';
import {api,errorMessage} from '../services/api/client';
import type {Client,Envelope} from '../types';
import {DataTable,type Column} from '../components/ui/DataTable';
import {StatePanel} from '../components/ui/StatePanel';
import {StatusBadge} from '../components/ui/StatusBadge';
import {AccountPreviewGate} from '../features/admins/AccountPreviewGate';
import {ClientModal} from '../features/clients/ClientModal';
import {ResetPasswordModal} from '../features/clients/ResetPasswordModal';
import {claims} from '../lib/auth';
import {dateTime} from '../lib/format';
import {PageFilterDrawer} from '../features/shell/PageFilterDrawer';
import {usePageFilterDrawer} from '../features/shell/pageFilterContext';
import {StatusFilterSelect} from '../features/shell/StatusFilterSelect';
import {downloadCsv,printTable} from '../lib/tableExport';

const inactiveTime=(seconds:number)=>seconds%86400===0?`${seconds/86400} Day${seconds===86400?'':'s'}`:seconds%3600===0?`${seconds/3600} Hour${seconds===3600?'':'s'}`:`${Math.round(seconds/60)} Minutes`;
const exportHeaders=['SN','Username','Admin','Vehicle','Name','Mobile','Email','Company','Website','Active','Inactive Time','Added','Updated','Address'];

export function ClientPage(){
  const [readOnly,setReadOnly]=useState(false),[previewTarget,setPreviewTarget]=useState<Client|null>(null),[previewPassword,setPreviewPassword]=useState<string|null|undefined>();
  const preview=(row:Client)=>{setPreviewPassword(undefined);if(claims()?.role==='SUPER_ADMIN')setPreviewTarget(row);else{setReadOnly(true);setSelected(row);setModalOpen(true)}};
  const [search,setSearch]=useState(''),[page,setPage]=useState(1),[statusDraft,setStatusDraft]=useState(''),[activeFilter,setActiveFilter]=useState(''),[modalOpen,setModalOpen]=useState(false),[selected,setSelected]=useState<Client|null>(null),[resetClient,setResetClient]=useState<Client|null>(null);
  const deferred=useDeferredValue(search),cache=useQueryClient(),pageFilter=usePageFilterDrawer();useEffect(()=>setPage(1),[deferred,activeFilter]);
  const query=useQuery({queryKey:['clients',deferred,page,activeFilter],queryFn:async()=>(await api.get<Envelope<Client[]>>('/clients',{params:{search:deferred,page,pageSize:25,active:activeFilter||undefined}})).data});
  const remove=useMutation({mutationFn:(id:string)=>api.delete(`/clients/${id}`),onSuccess:()=>cache.invalidateQueries({queryKey:['clients']})});
  const lock=useMutation({mutationFn:({id,locked}:{id:string;locked:boolean})=>api.patch(`/users/${id}/lock`,{locked}),onSuccess:()=>cache.invalidateQueries({queryKey:['clients']})});
  const edit=(client:Client)=>{setReadOnly(false);setSelected(client);setModalOpen(true)};
  const columns:Column<Client>[]=[
    {key:'sn',label:'SN',render:(_,index)=>(page-1)*25+index+1},
    {key:'username',label:'Username',render:row=><strong>{row.username||'Unavailable'}</strong>},
    {key:'admin',label:'Admin',render:row=>row.owner_name||row.owner_username||row.owner_email||'Unavailable'},
    {key:'vehicle',label:'Vehicle',render:row=>row.vehicle_count},
    {key:'name',label:'Name',render:row=>row.name||'Unavailable'},
    {key:'mobile',label:'Mobile',render:row=>row.mobile||'Unavailable'},
    {key:'email',label:'Email',render:row=>row.email},
    {key:'company',label:'Company',render:row=>row.company||'Unavailable'},
    {key:'website',label:'Website',render:row=>row.website||'Unavailable'},
    {key:'active',label:'Active',render:row=><StatusBadge status={row.active?'ACTIVE':'INACTIVE'}/>},
    {key:'inactive',label:'Inactive Time',render:row=>inactiveTime(row.inactive_timeout_seconds)},
    {key:'added',label:'Added',render:row=>dateTime(row.created_at)},
    {key:'updated',label:'Updated',render:row=>dateTime(row.updated_at)},
    {key:'address',label:'Address',render:row=>row.address||'Unavailable'},
    ...(claims()?.role==='SUPER_ADMIN'?[{key:'password',label:'Password',render:(row:Client)=><button type="button" className="table-action" onClick={()=>preview(row)} aria-label={`View password ${row.username||row.email}`}><Eye/>View password</button>}]:[]),
    {key:'preview',label:'Preview',render:row=><button type="button" className="table-action" onClick={()=>preview(row)} aria-label={`Preview ${row.username||row.email}`}><Eye/>Preview</button>},
    {key:'edit',label:'Edit',render:row=><button className="table-action" onClick={event=>{event.stopPropagation();edit(row)}} aria-label={`Edit ${row.username||row.email}`}><PenLine/>Edit</button>},
    {key:'reset',label:'Reset Password',render:row=><button className="table-action" onClick={event=>{event.stopPropagation();setResetClient(row)}}><KeyRound/>Reset</button>},
    {key:'lock',label:'Lock / Unlock',render:row=><button className="table-action" disabled={claims()?.role!=='SUPER_ADMIN'||lock.isPending} aria-label={`${row.active?'Lock':'Unlock'} ${row.username||row.email}`} onClick={()=>lock.mutate({id:row.id,locked:row.active})}><Lock/>{row.active?'Lock':'Unlock'}</button>},
    {key:'delete',label:'Delete',render:row=>row.active?<span className="neutral-value">Unavailable</span>:<button className="table-action danger" disabled={remove.isPending} onClick={event=>{event.stopPropagation();if(window.confirm(`Delete inactive client ${row.username||row.email}? This cannot be undone.`))remove.mutate(row.id)}}><Trash2/>Delete</button>}
  ];
  const rows=query.data?.data||[],total=query.data?.pagination?.total||0;
  const exportRows=rows.map((row,index)=>[(page-1)*25+index+1,row.username,row.owner_name||row.owner_username||row.owner_email,row.vehicle_count,row.name,row.mobile,row.email,row.company,row.website,row.active?'Active':'Inactive',inactiveTime(row.inactive_timeout_seconds),dateTime(row.created_at),dateTime(row.updated_at),row.address]);
  return <section className="page client-page"><div className="page-heading"><div><p className="eyebrow">Account hierarchy</p><h1>Client management</h1></div><button className="button" onClick={()=>{setReadOnly(false);setSelected(null);setModalOpen(true)}}><Plus/>Add client</button></div><div className="admin-panel client-panel"><div className="panel-toolbar"><label className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients" aria-label="Search clients"/></label><div className="toolbar-actions"><button className="secondary-button management-add-button" onClick={()=>{setReadOnly(false);setSelected(null);setModalOpen(true)}}><Plus/>Add client</button><button type="button" className="secondary-button export-button" disabled={!rows.length} title="Print visible rows or save as PDF" onClick={()=>printTable('RI Clients',exportHeaders,exportRows)}><img src="/assets/export/pdf.png" alt=""/>PDF</button><button type="button" className="secondary-button export-button" disabled={!rows.length} title="Download visible rows for Excel" onClick={()=>downloadCsv('ri-clients.csv',exportHeaders,exportRows)}><img src="/assets/export/xls.png" alt=""/>Excel</button></div></div>{lock.isError&&<div className="inline-error" role="alert">{errorMessage(lock.error)}</div>}{remove.isError&&<div className="inline-error" role="alert">{errorMessage(remove.error)}</div>}{query.isLoading?<StatePanel kind="loading" title="Loading clients"/>:query.isError?<StatePanel kind="error" title="Client list unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:!rows.length?<StatePanel kind="empty" title="No clients found" detail={deferred||activeFilter?'Try different filters.':'Add a client to an authorized admin.'}/>:<><DataTable columns={columns} rows={rows}/><div className="pagination"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/25))}</span><button disabled={page*25>=total} onClick={()=>setPage(value=>value+1)}>Next</button></div></>}<div className="security-footnote"><ShieldCheck/></div></div><PageFilterDrawer title="Status" ariaLabel="Client filters"><StatusFilterSelect value={statusDraft} onChange={setStatusDraft}/><button className="button" type="button" onClick={()=>{setActiveFilter(statusDraft);pageFilter.close()}}>Search</button></PageFilterDrawer><AccountPreviewGate account={previewTarget} kind="client" onClose={()=>setPreviewTarget(null)} onVerified={password=>{setPreviewPassword(password);setSelected(previewTarget);setPreviewTarget(null);setReadOnly(true);setModalOpen(true)}}/><ClientModal recoveredPassword={previewPassword} readOnly={readOnly} open={modalOpen} client={selected} onClose={()=>{setModalOpen(false);setSelected(null);setPreviewPassword(undefined)}}/><ResetPasswordModal client={resetClient} onClose={()=>setResetClient(null)}/></section>;
}
