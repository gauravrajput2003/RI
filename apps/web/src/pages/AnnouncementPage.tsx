import {usePermissions} from '../lib/permissions';
import {PERMISSIONS} from '../../../../packages/shared-types/src/permissions';
import {useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Plus,Trash2} from 'lucide-react';
import {api,errorMessage} from '../services/api/client';
import type {Envelope} from '../types';
import {DataTable,type Column} from '../components/ui/DataTable';

import {StatePanel} from '../components/ui/StatePanel';
import {downloadCsv,printTable} from '../lib/tableExport';
import {dateTime} from '../lib/format';
import '../features/alerts/alerts.css';
import {AnnouncementEditor,type AnnouncementRow} from '../features/alerts/AnnouncementEditor';

const useDebounced=(value:string)=>{const[result,setResult]=useState(value);useEffect(()=>{const timer=setTimeout(()=>setResult(value),300);return()=>clearTimeout(timer)},[value]);return result};
const plainText=(html:string)=>html.replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
const Status=({active}:{active:boolean})=><span className={`alert-status ${active?'active':'inactive'}`}>{active?'Active':'Inactive'}</span>;
const Pager=({page,total,onChange}:{page:number;total:number;onChange:(page:number)=>void})=><div className="pagination"><span>Showing {total?Math.min((page-1)*25+1,total):0} to {Math.min(page*25,total)} of {total} entries</span><button disabled={page===1} onClick={()=>onChange(page-1)}>Previous</button><button disabled={page*25>=total} onClick={()=>onChange(page+1)}>Next</button></div>;

export function AnnouncementsPage(){
 const {hasPermission}=usePermissions();
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[editing,setEditing]=useState<AnnouncementRow|null|undefined>(),deferred=useDebounced(search),cache=useQueryClient();
 useEffect(()=>setPage(1),[deferred]);
 const query=useQuery({queryKey:['announcements',deferred,page],queryFn:async()=>(await api.get<Envelope<AnnouncementRow[]>>('/announcements',{params:{search:deferred,page,pageSize:25}})).data});
 const remove=useMutation({mutationFn:(id:string)=>api.delete(`/announcements/${id}`),onSuccess:()=>void cache.invalidateQueries({queryKey:['announcements']})});
 const rows=query.data?.data??[],total=query.data?.pagination?.total??0;
 const columns:Column<AnnouncementRow>[]=[
  {key:'select',label:'',render:()=>null},
  {key:'sn',label:'SN',render:(_,index)=>(page-1)*25+index+1},
  {key:'for',label:'Announcement For',render:row=>row.targetLabel,sortValue:row=>row.targetLabel},
  {key:'admins',label:'Admins',render:row=>row.admins.join(', ')||'—',sortValue:row=>row.admins.join(', ')},
  {key:'clients',label:'Clients',render:row=>row.clients.join(', ')||'—',sortValue:row=>row.clients.join(', ')},
  {key:'title',label:'Message Title',render:row=><strong>{row.title}</strong>,sortValue:row=>row.title},
  {key:'body',label:'Message Body',render:row=><span className="announcement-body-cell">{row.messageType==='IMAGE'?(row.imageUrl?<img className="announcement-list-image" src={row.imageUrl} alt={row.title} onError={event=>{event.currentTarget.replaceWith(document.createTextNode('Image unavailable'))}}/>:'Image unavailable'):plainText(row.bodyHtml)}</span>,sortValue:row=>row.messageType==='IMAGE'?'IMAGE':plainText(row.bodyHtml)},
  {key:'start',label:'Start Date',render:row=>dateTime(row.startsAt),sortValue:row=>row.startsAt},
  {key:'end',label:'End Date',render:row=>dateTime(row.endsAt),sortValue:row=>row.endsAt},
  {key:'status',label:'Status',render:row=><Status active={row.active}/>,sortValue:row=>row.active?1:0},
  {key:'createdBy',label:'Created By',render:row=>row.createdBy,sortValue:row=>row.createdBy},
  {key:'added',label:'Added',render:row=>dateTime(row.createdAt),sortValue:row=>row.createdAt},
  {key:'updated',label:'Updated',render:row=>dateTime(row.updatedAt),sortValue:row=>row.updatedAt},
  {key:'delete',label:'Delete',render:row=><button disabled={!hasPermission(PERMISSIONS.announcementDelete)} className="delete-announcement" aria-label={`Delete ${row.title}`} onClick={event=>{event.stopPropagation();if(confirm(`Delete announcement “${row.title}”?`))remove.mutate(row.id)}}><Trash2/></button>}
 ];
 const headers=['SN','Announcement For','Admins','Clients','Message Title','Message Body','Start Date','End Date','Status','Created By','Added','Updated'];
 const exports=rows.map((row,index)=>[(page-1)*25+index+1,row.targetLabel,row.admins.join(', '),row.clients.join(', '),row.title,row.messageType==='IMAGE'?'IMAGE':plainText(row.bodyHtml),dateTime(row.startsAt),dateTime(row.endsAt),row.active?'Active':'Inactive',row.createdBy,dateTime(row.createdAt),dateTime(row.updatedAt)]);
 return <section className="page alerts-page legacy-table-page announcement-page"><div className="admin-panel"><div className="panel-toolbar"><label className="legacy-search-label">Search: <input aria-label="Search announcements" value={search} onChange={event=>setSearch(event.target.value)}/></label><div className="toolbar-actions"><button disabled={!hasPermission(PERMISSIONS.announcementAdd)} className="secondary-button legacy-add-button" onClick={()=>setEditing(null)}><Plus/>Add</button><button className="secondary-button export-button" onClick={()=>printTable('Announcements',headers,exports)}><img src="/assets/export/pdf.png" alt=""/>PDF</button><button className="secondary-button export-button" onClick={()=>downloadCsv('announcements.csv',headers,exports)}><img src="/assets/export/xls.png" alt=""/>Excel</button></div></div>{query.isError?<StatePanel kind="error" title="Announcements unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:<DataTable rows={rows} columns={columns} emptyMessage={query.isLoading?'Loading announcements…':'No data available in table'} onSelect={hasPermission(PERMISSIONS.announcementEdit)?setEditing:undefined}/>}<Pager page={page} total={total} onChange={setPage}/></div>{editing!==undefined&&hasPermission(editing?PERMISSIONS.announcementEdit:PERMISSIONS.announcementAdd)&&<AnnouncementEditor value={editing} onClose={()=>setEditing(undefined)}/>}</section>
}
