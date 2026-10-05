import {usePermissions} from '../lib/permissions';
import {PERMISSIONS} from '../../../../packages/shared-types/src/permissions';
import {PermissionAction} from '../features/permissions/PermissionAction';
import {useEffect,useState} from 'react';
import {SearchableSelect} from '../components/ui/SearchableSelect';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Plus,Trash2} from 'lucide-react';
import {api,errorMessage} from '../services/api/client';
import type {Envelope} from '../types';
import {DataTable,type Column} from '../components/ui/DataTable';
import {Modal} from '../components/ui/Modal';
import {StatePanel} from '../components/ui/StatePanel';
import {downloadCsv,printTable} from '../lib/tableExport';
import {dateTime} from '../lib/format';
import '../features/alerts/alerts.css';

type EventOption={type:string;label:string;source:string};type Option={id:string;label:string};
type AlertRow={id:string;name:string;mappingType:string;mappingValue:string|null;mappingLabel:string;active:boolean;createdAt:string;updatedAt:string;createdBy:string;events:string[]};
type NotificationRow={id:string;eventType:string;message:string;vehicleId:string;vehicle:string;clientId:string;client:string;occurredAt:string;latitude:number|null;longitude:number|null;address:string|null};
const useDebounced=(value:string)=>{const[result,setResult]=useState(value);useEffect(()=>{const timer=setTimeout(()=>setResult(value),300);return()=>clearTimeout(timer)},[value]);return result};
const Pager=({page,total,pageSize=25,onChange}:{page:number;total:number;pageSize?:number;onChange:(page:number)=>void})=><div className="pagination"><span>Showing {total?Math.min((page-1)*pageSize+1,total):0} to {Math.min(page*pageSize,total)} of {total} entries</span><button disabled={page===1} onClick={()=>onChange(page-1)}>Previous</button><button disabled={page*pageSize>=total} onClick={()=>onChange(page+1)}>Next</button></div>;
function EventSelector({options=[],selected,onChange,loading}:{options?:EventOption[];selected:string[];onChange:(events:string[])=>void;loading:boolean}){
 const [choice,setChoice]=useState('');
 const available=options.filter(option=>!selected.includes(option.type));
 const add=()=>{if(choice&&!selected.includes(choice)){onChange([...selected,choice]);setChoice('')}};
 return <div className="legacy-event-picker"><div className="legacy-event-controls"><div className="legacy-event-dropdown"><SearchableSelect aria-label="Select Event" value={choice} onChange={setChoice} placeholder="Select Event" options={available.map(option=>({value:option.type,label:option.label}))} isLoading={loading}/></div><button type="button" className="legacy-add-event" disabled={!choice} onClick={add}>Add Event</button></div><div className="selected-events">{selected.map(type=>{const option=options.find(item=>item.type===type);return <span key={type}>{option?.label??type.replaceAll('_',' ')}<button type="button" aria-label={`Remove ${option?.label??type}`} onClick={()=>onChange(selected.filter(item=>item!==type))}>×</button></span>})}</div></div>
}function AlertEditor({value,onClose}:{value:AlertRow|null;onClose:()=>void}){const cache=useQueryClient(),[name,setName]=useState(value?.name??''),[mappingType,setMappingType]=useState(value?.mappingType??''),[mappingValue,setMappingValue]=useState(value?.mappingValue??''),[events,setEvents]=useState<string[]>(value?.events??[]),[active,setActive]=useState(value?.active??true),[issue,setIssue]=useState('');const eventQuery=useQuery({queryKey:['alert-events'],queryFn:async()=>(await api.get<Envelope<EventOption[]>>('/alerts/events')).data.data});const optionQuery=useQuery({queryKey:['alert-options',mappingType],enabled:mappingType==='CLIENT'||mappingType==='VEHICLE',queryFn:async()=>(await api.get<Envelope<Option[]>>('/alerts/mapping-options',{params:{type:mappingType}})).data.data});const save=useMutation({mutationFn:()=>value?api.patch(`/alerts/${value.id}`,{name,mappingType,mappingValue:mappingType==='ALL_VEHICLES'?null:mappingValue,events,active}):api.post('/alerts',{name,mappingType,mappingValue:mappingType==='ALL_VEHICLES'?null:mappingValue,events,active}),onSuccess:()=>{void cache.invalidateQueries({queryKey:['alerts']});onClose()},onError:error=>setIssue(errorMessage(error))});return <Modal open title={value?'Edit Alert':'Add Alert'} onClose={onClose} className="legacy-alert-modal"><form className="alert-form legacy-alert-form" onSubmit={event=>{event.preventDefault();setIssue('');save.mutate()}}><div className="alert-form-grid"><label>Alert Name<input required maxLength={120} placeholder="Alert Name" value={name} onChange={e=>setName(e.target.value)}/></label><label>Alert Mapping Type<SearchableSelect required aria-label="Alert Mapping Type" placeholder="Mapping Type" value={mappingType} onChange={value=>{setMappingType(value);setMappingValue('')}} options={[{value:'ALL_VEHICLES',label:'All vehicles'},{value:'CLIENT',label:'Client'},{value:'VEHICLE',label:'Vehicle'}]}/></label><label>Alert Mapping Value<SearchableSelect required={mappingType!=='ALL_VEHICLES'} aria-label="Alert Mapping Value" placeholder={mappingType==='ALL_VEHICLES'?'All vehicles':'Mapping Value'} isDisabled={mappingType==='ALL_VEHICLES'} isLoading={optionQuery.isLoading} value={mappingValue} onChange={setMappingValue} options={(optionQuery.data??[]).map(option=>({value:option.id,label:option.label}))}/></label></div><EventSelector options={eventQuery.data} selected={events} onChange={setEvents} loading={eventQuery.isLoading}/>{value&&<label className="check-row"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>Active</label>}{issue&&<div className="inline-error" role="alert">{issue}</div>}<footer className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Close</button><button className="button" disabled={save.isPending||!name.trim()||!mappingType||!events.length}>{save.isPending?'Saving…':'Save'}</button></footer></form></Modal>}

export function ConfigureAlertsPage(){
 const {hasPermission}=usePermissions();
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[editing,setEditing]=useState<AlertRow|null|undefined>(),debounced=useDebounced(search),cache=useQueryClient();
 useEffect(()=>setPage(1),[debounced]);
 const query=useQuery({queryKey:['alerts',debounced,page],queryFn:async()=>(await api.get<Envelope<AlertRow[]>>('/alerts',{params:{search:debounced,page,pageSize:25}})).data});
 const remove=useMutation({mutationFn:(id:string)=>api.delete(`/alerts/${id}`),onSuccess:()=>void cache.invalidateQueries({queryKey:['alerts']})});
 const rows=query.data?.data??[];
 const columns:Column<AlertRow>[]=[
  {key:'actions',label:'',render:row=><div className="row-actions"><PermissionAction permission={PERMISSIONS.alertEdit}><button onClick={()=>setEditing(row)}>Edit</button></PermissionAction><button disabled={!hasPermission(PERMISSIONS.alertDelete)} aria-label={`Archive ${row.name}`} onClick={()=>{if(confirm(`Archive alert “${row.name}”?`))remove.mutate(row.id)}}><Trash2/></button></div>},
  {key:'name',label:'Name',render:row=>row.name,sortValue:row=>row.name},
  {key:'mapping',label:'Mapping Type',render:row=>row.mappingType.replaceAll('_',' '),sortValue:row=>row.mappingType},
  {key:'value',label:'Mapped Value',render:row=>row.mappingLabel,sortValue:row=>row.mappingLabel},
  {key:'created',label:'Created_At',render:row=>dateTime(row.createdAt),sortValue:row=>row.createdAt},
  {key:'updated',label:'Last_Update',render:row=>dateTime(row.updatedAt),sortValue:row=>row.updatedAt}
 ];
 return <section className="page alerts-page legacy-table-page alert-config-page"><div className="legacy-section-label">Alert Config</div><div className="admin-panel"><div className="panel-toolbar"><label className="legacy-search-label">Search: <input aria-label="Search alerts" value={search} onChange={event=>setSearch(event.target.value)}/></label><button disabled={!hasPermission(PERMISSIONS.alertAdd)} type="button" className="legacy-plus" aria-label="Add Alert" onClick={()=>setEditing(null)}><Plus/></button></div>{query.isError?<StatePanel kind="error" title="Alerts unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:<DataTable rows={rows} columns={columns} emptyMessage={query.isLoading?'Loading alerts…':'No data available in table'}/>}<Pager page={page} total={query.data?.pagination?.total??0} onChange={setPage}/></div>{editing!==undefined&&hasPermission(editing?PERMISSIONS.alertEdit:PERMISSIONS.alertAdd)&&<AlertEditor value={editing} onClose={()=>setEditing(undefined)}/>}</section>
}

export function NotificationsPage(){
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),debounced=useDebounced(search);
 useEffect(()=>setPage(1),[debounced]);
 const query=useQuery({queryKey:['notifications',debounced,page],queryFn:async()=>(await api.get<Envelope<NotificationRow[]>>('/notifications',{params:{search:debounced,page,pageSize:25}})).data});
 const rows=query.data?.data??[];
 const columns:Column<NotificationRow>[]=[
  {key:'vehicle',label:'Vehicle',render:row=>row.vehicle,sortValue:row=>row.vehicle},
  {key:'type',label:'Type',render:row=>row.eventType.replaceAll('_',' '),sortValue:row=>row.eventType},
  {key:'location',label:'Location',render:row=>row.latitude==null?'Unavailable':`${row.latitude.toFixed(5)}, ${row.longitude?.toFixed(5)}`,sortValue:row=>row.latitude},
  {key:'message',label:'Message',render:row=>row.message,sortValue:row=>row.message},
  {key:'address',label:'Address',render:row=>row.address??'Unavailable',sortValue:row=>row.address},
  {key:'time',label:'Time',render:row=>dateTime(row.occurredAt),sortValue:row=>row.occurredAt}
 ];
 const headers=['Vehicle','Type','Location','Message','Address','Time'];
 const exportRows=rows.map(row=>[row.vehicle,row.eventType.replaceAll('_',' '),row.latitude==null?'Unavailable':`${row.latitude.toFixed(5)}, ${row.longitude?.toFixed(5)}`,row.message,row.address??'Unavailable',dateTime(row.occurredAt)]);
 return <section className="page alerts-page legacy-table-page notifications-table-page"><div className="admin-panel"><div className="panel-toolbar"><label className="legacy-search-label">Search: <input aria-label="Search notifications" value={search} onChange={event=>setSearch(event.target.value)}/></label><div className="toolbar-actions"><button className="secondary-button export-button" onClick={()=>printTable('Notification history',headers,exportRows)}><img src="/assets/export/pdf.png" alt=""/>PDF</button><button className="secondary-button export-button" onClick={()=>downloadCsv('notification-history.csv',headers,exportRows)}><img src="/assets/export/xls.png" alt=""/>Excel</button></div></div>{query.isError?<StatePanel kind="error" title="Notifications unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:<DataTable rows={rows} columns={columns} emptyMessage={query.isLoading?'Loading notifications…':'No data available in table'}/>}<Pager page={page} total={query.data?.pagination?.total??0} onChange={setPage}/></div></section>
}

export {AnnouncementsPage as LegacyAnnouncementsPage} from './AnnouncementPage';
