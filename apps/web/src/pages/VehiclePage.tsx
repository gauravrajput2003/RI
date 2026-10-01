import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {SearchableSelect} from '../components/ui/SearchableSelect';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Eye,Ban,Car,Clock3,Gauge,PauseCircle,PenLine,PlayCircle,Plus,Search,Sparkles,Terminal,Trash2,WifiOff,X} from 'lucide-react';
import {api,errorMessage} from '../services/api/client';
import type {Envelope,FleetStatus,ManagedVehicle,Owner} from '../types';
import {DataTable,type Column} from '../components/ui/DataTable';
import {StatePanel} from '../components/ui/StatePanel';
import {StatusBadge} from '../components/ui/StatusBadge';
import {VehicleModal} from '../features/vehicles/VehicleModal';
import {FilterPill} from '../features/dashboard/FilterPill';
import {PageFilterDrawer} from '../features/shell/PageFilterDrawer';
import {usePageFilterDrawer} from '../features/shell/pageFilterContext';
import {claims} from '../lib/auth';
import {dateTime,speed} from '../lib/format';
import {downloadCsv,printTable,type ExportValue} from '../lib/tableExport';

const cards:[FleetStatus,string,typeof Car][]=[['ALL','All',Car],['OVERSPEED','Overspeed',Gauge],['RUNNING','Running',PlayCircle],['IDLE','Idle',Clock3],['STOPPED','Stopped',PauseCircle],['UNREACHABLE','Unreachable',WifiOff],['NEW','New',Sparkles],['INACTIVE','Inactive',Ban]];
const dateFilters=[['added','Added'],['subscriptionStart','Subscription Start'],['subscriptionDue','Subscription Due'],['inactive','Inactive Date'],['modified','Modified Date']] as const;
type DateFilter=typeof dateFilters[number][0];
type Response=Envelope<ManagedVehicle[]>&{counts:Record<FleetStatus,number>};
const unavailable=(value:unknown)=>value===null||value===undefined||value===''?'Unavailable':String(value);
const yesNo=(value:boolean|undefined)=>value===undefined?'Unavailable':value?'Yes':'No';
const duration=(value:number|null|undefined)=>value==null?'Unavailable':`${Math.floor(Number(value)/3600).toString().padStart(2,'0')}:${Math.floor(Number(value)%3600/60).toString().padStart(2,'0')}`;
const km=(value:number|null|undefined)=>value==null?'Unavailable':Number(value).toFixed(2);
const years=Array.from({length:8},(_,index)=>String(new Date().getFullYear()-index));

export function VehiclePage(){
 const role=claims()?.role;
 const manager=role==='ADMIN'||role==='SUPER_ADMIN';
 const [status,setStatus]=useState<FleetStatus>('ALL');
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const [clientDraft,setClientDraft]=useState('');
 const [clientId,setClientId]=useState('');
 const [deviceType,setDeviceType]=useState('');
 const [dateFilter,setDateFilter]=useState<DateFilter|null>(null);
 const [year,setYear]=useState('');
 const [selected,setSelected]=useState<string|null>(null);
 const [modal,setModal]=useState(false),[readOnly,setReadOnly]=useState(false);
 const deferred=useDeferredValue(search);
 const cache=useQueryClient();
 const pageFilter=usePageFilterDrawer();
 const yearParams=useMemo(()=>{if(!dateFilter||!year)return{};const from=`${year}-01-01`,to=`${year}-12-31`;return dateFilter==='added'?{addedFrom:from,addedTo:to}:dateFilter==='modified'?{modifiedFrom:from,modifiedTo:to}:dateFilter==='subscriptionStart'?{subscriptionStartFrom:from,subscriptionStartTo:to}:dateFilter==='subscriptionDue'?{subscriptionDueFrom:from,subscriptionDueTo:to}:{inactiveFrom:from,inactiveTo:to}},[dateFilter,year]);
 useEffect(()=>{setPage(1);setSelected(null)},[status,deferred,clientId,deviceType,dateFilter,year]);
 const clients=useQuery({queryKey:['vehicle-client-options'],enabled:manager,queryFn:async()=>(await api.get<Envelope<(Owner&{owner_id?:string})[]>>('/client-options')).data.data});
 const query=useQuery({queryKey:['managed-vehicles',status,deferred,page,clientId,deviceType,dateFilter,year,role],queryFn:async()=>(await api.get<Response>('/fleet-vehicles',{params:{status,search:deferred,page,pageSize:25,clientId:manager&&clientId?clientId:undefined,deviceType:manager&&deviceType?deviceType:undefined,...(manager?yearParams:{})}})).data});
 const rows=query.data?.data||[];
 const chosen=manager?rows.find(row=>row.id===selected)||null:null;
 const remove=useMutation({mutationFn:(id:string)=>api.delete(`/fleet-vehicles/${id}`),onSuccess:async()=>{setSelected(null);await cache.invalidateQueries({queryKey:['managed-vehicles']})}});

 const clientColumns:Column<ManagedVehicle>[]=[
  {key:'sn',label:'SN',render:(_,index)=>(page-1)*25+index+1},
  {key:'number',label:'Vehicle Number',sortValue:row=>row.vehicle_number,render:row=><strong>{row.vehicle_number}</strong>},
  {key:'type',label:'Vehicle Type',sortValue:row=>row.vehicle_type,render:row=>row.vehicle_type||'Unavailable'},
  {key:'status',label:'Status',sortValue:row=>row.fleet_status,render:row=><StatusBadge status={row.fleet_status}/>},
  {key:'speed',label:'Speed',sortValue:row=>row.speed,render:row=>speed(row.speed)},
  {key:'gps',label:'Last GPS',sortValue:row=>row.tracker_timestamp||row.server_received_at,render:row=>dateTime(row.tracker_timestamp||row.server_received_at)},
  {key:'since',label:'Since',sortValue:row=>row.status_since_at,render:row=>dateTime(row.status_since_at)},
  {key:'todayKm',label:'TodayKm',sortValue:row=>row.today_distance_km,render:row=>km(row.today_distance_km)},
  {key:'todayDu',label:'TodayDu',sortValue:row=>row.today_running_seconds,render:row=>duration(row.today_running_seconds)},
  {key:'overspeed',label:'Overspeed',sortValue:row=>row.overspeed_limit,render:row=>row.overspeed_limit==null?'Unavailable':`${row.overspeed_limit} Km/h`},
 ];
 const adminColumns:Column<ManagedVehicle>[]=[
  {key:'select',label:'',render:row=><input type="checkbox" aria-label={`Select ${row.vehicle_number}`} checked={selected===row.id} onChange={()=>setSelected(current=>current===row.id?null:row.id)} onClick={event=>event.stopPropagation()}/>},
  ...clientColumns.slice(0,4),
  {key:'client',label:'Client',sortValue:row=>row.client_name||row.client_username||row.client_email,render:row=>row.client_name||row.client_username||row.client_email||'Unavailable'},
  {key:'imei',label:'IMEI',sortValue:row=>row.imei,render:row=>row.imei||'Unavailable'},
  {key:'device',label:'Device Type',sortValue:row=>row.device_model||row.protocol,render:row=>row.device_model||row.protocol||'Unavailable'},
  {key:'sim',label:'SIM',sortValue:row=>row.sim_number,render:row=>row.sim_number||'Unavailable'},
  {key:'simType',label:'SIM Type',sortValue:row=>row.sim_type||row.sim_operator,render:row=>row.sim_type||row.sim_operator||'Unavailable'},
  ...clientColumns.slice(4),
  {key:'mileage',label:'Mileage',sortValue:row=>row.mileage,render:row=>unavailable(row.mileage)},
  {key:'odometer',label:'Odometer',sortValue:row=>row.odometer,render:row=>unavailable(row.odometer)},
  {key:'alias',label:'Alias',sortValue:row=>row.alias,render:row=>row.alias||'Unavailable'},
  {key:'active',label:'Active',sortValue:row=>row.active?1:0,render:row=>yesNo(row.active)},
  {key:'subscriptionStart',label:'Subscription Start',sortValue:row=>row.billing_start,render:row=>dateTime(row.billing_start)},
  {key:'subscriptionDue',label:'Subscription Due',sortValue:row=>row.billing_due,render:row=>dateTime(row.billing_due)},
  {key:'autoRenewal',label:'AutoRenewal',sortValue:row=>row.auto_renewal?1:0,render:row=>yesNo(row.auto_renewal)},
  {key:'wire',label:'Wire',sortValue:row=>row.ignition_wiring,render:row=>row.ignition_wiring?.replaceAll('_',' ')||'Unavailable'},
  {key:'added',label:'Added',sortValue:row=>row.created_at,render:row=>dateTime(row.created_at)},
  {key:'updated',label:'Updated',sortValue:row=>row.updated_at,render:row=>dateTime(row.updated_at)},
  {key:'coin',label:'Coin',sortValue:row=>Number(row.coins),render:row=>unavailable(row.coins)},
  {key:'coinExpiry',label:'Coin Expiry',sortValue:row=>row.billing_due,render:row=>dateTime(row.billing_due)},
  {key:'delete',label:'Delete',render:row=><button type="button" className="vehicle-row-action danger" disabled={remove.isPending} aria-label={`Delete ${row.vehicle_number}`} onClick={event=>{event.stopPropagation();if(window.confirm(`Deactivate ${row.vehicle_number}?`))remove.mutate(row.id)}}><Trash2/></button>},
  {key:'command',label:'Command',render:row=><button type="button" className="vehicle-row-action" disabled title={`Commands are not enabled for ${row.vehicle_number}`}><Terminal/></button>},
  {key:'remark',label:'Remark',sortValue:row=>row.remark,render:row=>row.remark||'Unavailable'},
  {key:'variance',label:'KmVariance(%)',render:()=> 'Unavailable'},
  {key:'address',label:'Address',sortValue:row=>row.address,render:row=><span className="vehicle-address-cell">{row.address||'Unavailable'}</span>},
 ];
 if(manager)adminColumns.push({key:'preview',label:'Preview',render:row=><button type="button" className="table-action" onClick={event=>{event.stopPropagation();setSelected(row.id);setReadOnly(true);setModal(true)}} aria-label={`Preview ${row.vehicle_number}`}><Eye/>Preview</button>});
 const columns=manager?adminColumns:clientColumns;
 const exportColumns=columns.filter(column=>column.key!=='select'&&column.key!=='delete'&&column.key!=='command');
 const exportRows:ExportValue[][]=rows.map((row,index)=>exportColumns.map(column=>{
  const values:Record<string,ExportValue>={sn:(page-1)*25+index+1,number:row.vehicle_number,type:row.vehicle_type,status:row.fleet_status,client:row.client_name||row.client_username||row.client_email,imei:row.imei,device:row.device_model||row.protocol,sim:row.sim_number,simType:row.sim_type||row.sim_operator,speed:row.speed,gps:row.tracker_timestamp||row.server_received_at,since:row.status_since_at,todayKm:row.today_distance_km,todayDu:row.today_running_seconds,overspeed:row.overspeed_limit,mileage:row.mileage,odometer:row.odometer,alias:row.alias,active:row.active,subscriptionStart:row.billing_start,subscriptionDue:row.billing_due,autoRenewal:row.auto_renewal,wire:row.ignition_wiring,added:row.created_at,updated:row.updated_at,coin:row.coins,coinExpiry:row.billing_due,remark:row.remark,variance:null,address:row.address};return values[column.key]}));
 const total=query.data?.pagination?.total||0;
 const resetFilters=()=>{setDateFilter(null);setYear('');setDeviceType('');setStatus('ALL');setClientDraft('');setClientId('')};
 return <section className={`page vehicle-page ${manager?'manager-view':'client-view'}`}>
  <div className="page-heading"><div><p className="eyebrow">Fleet configuration</p><h1>Vehicle management</h1></div>{manager&&<div className="heading-actions">{chosen&&<button className="secondary-button" onClick={()=>{setReadOnly(false);setModal(true)}}><PenLine/>Edit vehicle</button>}<button className="button" onClick={()=>{setSelected(null);setReadOnly(false);setModal(true)}}><Plus/>Add vehicle</button></div>}</div>
  <div className="status-grid">{cards.map(([key,label,Icon])=><FilterPill key={key} status={key} label={label} count={query.data?.counts?.[key]} icon={Icon} active={status===key} onClick={()=>setStatus(key)}/>)}</div>
  {manager&&<div className="vehicle-filter-strip">{dateFilters.map(([key,label])=><button type="button" key={key} className={dateFilter===key?'active':''} onClick={()=>setDateFilter(current=>current===key?null:key)}>{label}</button>)}<SearchableSelect aria-label="Device Type filter" placeholder="Device Type" value={deviceType} onChange={setDeviceType} isClearable options={[{value:'GT06',label:'GT06'},{value:'W15',label:'W15'}]}/><SearchableSelect aria-label="Vehicle Status filter" value={status} onChange={value=>setStatus(value as FleetStatus)} options={cards.map(([key,label])=>({value:key,label:key==='ALL'?'Vehicle Status':label}))}/><SearchableSelect aria-label="Select Year" placeholder="Select Year" value={year} isDisabled={!dateFilter} onChange={setYear} isClearable options={years.map(value=>({value,label:value}))}/><button type="button" className="clear" aria-label="Clear vehicle filters" onClick={resetFilters}><X/></button></div>}
  <div className="admin-panel vehicle-panel"><div className="panel-toolbar vehicle-toolbar"><label className="search-box"><Search/><input aria-label="Search vehicles" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search vehicle, alias, or IMEI"/></label><div className="toolbar-actions"><button className="secondary-button export-button" disabled={!rows.length} onClick={()=>printTable('Vehicle inventory',exportColumns.map(column=>column.label),exportRows)}><img src="/assets/export/pdf.png" alt=""/>PDF</button><button className="secondary-button export-button" disabled={!rows.length} onClick={()=>downloadCsv('vehicle-inventory.csv',exportColumns.map(column=>column.label),exportRows)}><img src="/assets/export/xls.png" alt=""/>Excel</button>{manager&&<button className="secondary-button vehicle-add-button" onClick={()=>{setSelected(null);setReadOnly(false);setModal(true)}}><Plus/>Add Vehicle</button>}</div></div>
   {remove.isError&&<div className="inline-error" role="alert">{errorMessage(remove.error)}</div>}
   {query.isLoading?<StatePanel kind="loading" title="Loading vehicles"/>:query.isError?<StatePanel kind="error" title="Vehicle list unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:!rows.length?<StatePanel kind="empty" title="No vehicles found" detail="Adjust the search or vehicle filters."/>:<><DataTable columns={columns} rows={rows} selected={selected} onSelect={manager?row=>setSelected(current=>current===row.id?null:row.id):undefined}/><div className="pagination"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/25))}</span><button disabled={page*25>=total} onClick={()=>setPage(value=>value+1)}>Next</button></div></>}
  </div>
  {manager?<PageFilterDrawer title="Client" ariaLabel="Vehicle filters"><label>Client<SearchableSelect aria-label="Client" placeholder="Select Client" value={clientDraft} onChange={setClientDraft} isClearable options={(clients.data??[]).map(owner=>({value:owner.id,label:owner.name||owner.username||owner.email}))}/></label><button className="button" type="button" onClick={()=>{setClientId(clientDraft);pageFilter.close()}}>Search</button></PageFilterDrawer>:<PageFilterDrawer title="Vehicle Status" ariaLabel="Vehicle filters"><label>Status<SearchableSelect aria-label="Status" value={status} onChange={value=>setStatus(value as FleetStatus)} options={cards.map(([key,label])=>({value:key,label}))}/></label><button className="button" type="button" onClick={pageFilter.close}>Search</button></PageFilterDrawer>}
  {manager&&<VehicleModal readOnly={readOnly} open={modal} vehicle={chosen} onClose={()=>setModal(false)}/>}
 </section>;
}
