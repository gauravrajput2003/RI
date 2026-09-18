import {useDeferredValue,useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {FileDown,KeyRound,Lock,PenLine,Plus,Search,ShieldCheck,Trash2,Upload} from 'lucide-react';
import {api,errorMessage} from '../services/api/client';
import type {Client,Envelope} from '../types';
import {DataTable,type Column} from '../components/ui/DataTable';
import {StatePanel} from '../components/ui/StatePanel';
import {StatusBadge} from '../components/ui/StatusBadge';
import {ClientModal} from '../features/clients/ClientModal';
import {ResetPasswordModal} from '../features/clients/ResetPasswordModal';
import {dateTime} from '../lib/format';

const inactiveTime=(seconds:number)=>seconds%86400===0?`${seconds/86400} Day${seconds===86400?'':'s'}`:seconds%3600===0?`${seconds/3600} Hour${seconds===3600?'':'s'}`:`${Math.round(seconds/60)} Minutes`;

export function ClientPage(){
  const [search,setSearch]=useState(''),[page,setPage]=useState(1),[modalOpen,setModalOpen]=useState(false),[selected,setSelected]=useState<Client|null>(null),[resetClient,setResetClient]=useState<Client|null>(null);
  const deferred=useDeferredValue(search),cache=useQueryClient();useEffect(()=>setPage(1),[deferred]);
  const query=useQuery({queryKey:['clients',deferred,page],queryFn:async()=>(await api.get<Envelope<Client[]>>('/clients',{params:{search:deferred,page,pageSize:25}})).data});
  const remove=useMutation({mutationFn:(id:string)=>api.delete(`/clients/${id}`),onSuccess:()=>cache.invalidateQueries({queryKey:['clients']})});
  const edit=(client:Client)=>{setSelected(client);setModalOpen(true)};
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
    {key:'edit',label:'Edit',render:row=><button className="table-action" onClick={event=>{event.stopPropagation();edit(row)}} aria-label={`Edit ${row.username||row.email}`}><PenLine/>Edit</button>},
    {key:'reset',label:'Reset Password',render:row=><button className="table-action" onClick={event=>{event.stopPropagation();setResetClient(row)}}><KeyRound/>Reset</button>},
    {key:'lock',label:'Lock',render:()=><button className="table-action" disabled title="Account locking is not supported by the authentication model"><Lock/>Unavailable</button>},
    {key:'delete',label:'Delete',render:row=>row.active?<span className="neutral-value">Unavailable</span>:<button className="table-action danger" disabled={remove.isPending} onClick={event=>{event.stopPropagation();if(window.confirm(`Delete inactive client ${row.username||row.email}? This cannot be undone.`))remove.mutate(row.id)}}><Trash2/>Delete</button>}
  ];
  const total=query.data?.pagination?.total||0;
  return <section className="page client-page"><div className="page-heading"><div><p className="eyebrow">Account hierarchy</p><h1>Client management</h1></div><button className="button" onClick={()=>{setSelected(null);setModalOpen(true)}}><Plus/>Add client</button></div><div className="admin-panel client-panel"><div className="panel-toolbar"><label className="search-box"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients" aria-label="Search clients"/></label><div className="toolbar-actions"><button className="secondary-button" disabled title="Export endpoint not yet enabled"><FileDown/>PDF</button><button className="secondary-button" disabled title="Export endpoint not yet enabled"><FileDown/>Excel</button><button className="secondary-button" disabled title="Client upload requirements are not yet defined"><Upload/>Upload client</button><button className="secondary-button" onClick={()=>{setSelected(null);setModalOpen(true)}}><Plus/>Add client</button><span>{total} clients</span></div></div>{remove.isError&&<div className="inline-error" role="alert">{errorMessage(remove.error)}</div>}{query.isLoading?<StatePanel kind="loading" title="Loading clients"/>:query.isError?<StatePanel kind="error" title="Client list unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:!query.data?.data.length?<StatePanel kind="empty" title="No clients found" detail={deferred?'Try a different search.':'Add a client to an authorized admin.'}/>:<><DataTable columns={columns} rows={query.data.data}/><div className="pagination"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/25))}</span><button disabled={page*25>=total} onClick={()=>setPage(value=>value+1)}>Next</button></div></>}<div className="security-footnote"><ShieldCheck/>Client visibility, owner assignment, password reset, and deletion rules are enforced by the API.</div></div><ClientModal open={modalOpen} client={selected} onClose={()=>{setModalOpen(false);setSelected(null)}}/><ResetPasswordModal client={resetClient} onClose={()=>setResetClient(null)}/></section>;
}
