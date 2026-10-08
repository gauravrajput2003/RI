import {AddressAttribution} from '../features/dashboard/AddressAttribution';
import {useDeferredValue,useEffect,useMemo,useRef,useState} from 'react';
import {SearchableSelect} from '../components/ui/SearchableSelect';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Ban,Car,Clock3,Gauge,Minimize2,PauseCircle,PlayCircle,Search,Settings,Sparkles,WifiOff,X} from 'lucide-react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faMaximize} from '@fortawesome/free-solid-svg-icons';
import {io} from 'socket.io-client';
import {api,errorMessage} from '../services/api/client';
import {claims,getTokens} from '../lib/auth';
import type {Envelope,FleetStatus,FleetVehicle,Owner} from '../types';
import {DataTable,type Column} from '../components/ui/DataTable';
import {StatePanel} from '../components/ui/StatePanel';
import {FleetMap} from '../features/map/MapSurface';
import {SelectedVehicleSummary} from '../features/dashboard/SelectedVehicleSummary';
import {FilterPill} from '../features/dashboard/FilterPill';
import {VehiclePopup} from '../features/dashboard/VehiclePopup';
import {VehicleIcon} from '../features/vehicles/VehicleIcon';
import {PageFilterDrawer} from '../features/shell/PageFilterDrawer';
import {usePageFilterDrawer} from '../features/shell/pageFilterContext';
import {useCompactLayout} from '../lib/useCompactLayout';
import {dateTime,speed} from '../lib/format';

const filters=[['ALL','All',Car],['OVERSPEED','Overspeed',Gauge],['RUNNING','Running',PlayCircle],['IDLE','Idle',Clock3],['STOPPED','Stopped',PauseCircle],['UNREACHABLE','Unreachable',WifiOff],['NEW','New',Sparkles],['INACTIVE','Inactive',Ban]] as const;
type FleetResponse=Envelope<FleetVehicle[]>&{counts:Record<FleetStatus,number>;pagination:{page:number;pageSize:number;total:number}};
type PanelMode='split'|'table'|'map';
type ColumnKey='sn'|'status'|'vehicle'|'client'|'speed'|'gps'|'since'|'todayKm'|'todayDuration'|'address';
const operationalColumns:ColumnKey[]=['sn','status','vehicle','speed','gps','since','todayKm','todayDuration','address'];
const duration=(value:number|null)=>value==null?'Unavailable':`${Math.floor(value/3600).toString().padStart(2,'0')}:${Math.floor(value%3600/60).toString().padStart(2,'0')}`;
const km=(value:number|null)=>value==null?'Unavailable':`${Number(value).toFixed(1)} km`;

// Live dashboards must never substitute invented coordinates or addresses.
export function withDashboardPreviewTelemetry(vehicles:FleetVehicle[]):FleetVehicle[]{return vehicles;}

export function DashboardPage(){
 const compact=useCompactLayout();
 const role=claims()?.role;
 const issuance=useQuery({queryKey:['monthly-issuance'],enabled:role==='SUPER_ADMIN',queryFn:async()=>(await api.get<Envelope<{monthly_target:string;issued:string;enforce_hard_cap:boolean}>>('/issuance-settings')).data.data,refetchInterval:30000});
 const manager=role==='ADMIN'||role==='SUPER_ADMIN';
 const [status,setStatus]=useState<FleetStatus>('ALL');
 const [search,setSearch]=useState('');
 const [page,setPage]=useState(1);
 const [selected,setSelected]=useState<string|null>(null);
 const [hovered,setHovered]=useState<string|null>(null);
 const [panelMode,setPanelMode]=useState<PanelMode>('split');
 const [mapSettings,setMapSettings]=useState(false);
 const [mapType,setMapType]=useState<'street'|'satellite'>('street');
 const [clientDraft,setClientDraft]=useState('');
 const [clientId,setClientId]=useState('');
 const [splitPercent,setSplitPercent]=useState(48);
 const [resizing,setResizing]=useState(false);
 const workspaceRef=useRef<HTMLDivElement>(null);
 const deferred=useDeferredValue(search);
 const client=useQueryClient();
 const pageFilter=usePageFilterDrawer();

 useEffect(()=>setPage(1),[status,deferred,clientId]);
 const clients=useQuery({queryKey:['dashboard-client-options'],enabled:manager,queryFn:async()=>(await api.get<Envelope<(Owner&{owner_id?:string})[]>>('/client-options')).data.data});
 const query=useQuery({queryKey:['fleet',status,deferred,page,clientId],refetchInterval:15000,queryFn:async()=>{const {data}=await api.get<FleetResponse>('/dashboard/vehicles',{params:{status,search:deferred,page,pageSize:25,clientId:clientId||undefined}});return data}});
 useEffect(()=>{const token=getTokens()?.accessToken;if(!token)return;const base=(import.meta.env.VITE_SOCKET_URL||import.meta.env.VITE_API_URL||'http://localhost:3000').replace(/\/api\/v1\/?$/,'');const socket=io(base,{auth:{token},transports:['websocket']});socket.on('vehicle:location',(payload:Partial<FleetVehicle>&{vehicleId?:string})=>{client.setQueriesData<FleetResponse>({queryKey:['fleet']},old=>old?{...old,data:old.data.map(vehicle=>vehicle.id===(payload.vehicleId||payload.id)?{...vehicle,...payload,...(!payload.address&&((payload.latitude!=null&&payload.latitude!==vehicle.latitude)||(payload.longitude!=null&&payload.longitude!==vehicle.longitude))?{address:null,address_attribution:null}:{})}:vehicle)}:old)});return()=>{socket.disconnect()}},[client]);
 useEffect(()=>{if(!resizing)return;const move=(event:PointerEvent)=>{const bounds=workspaceRef.current?.getBoundingClientRect();if(!bounds)return;setSplitPercent(Math.max(30,Math.min(70,((event.clientX-bounds.left)/bounds.width)*100)))};const stop=()=>setResizing(false);window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop,{once:true});return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop)}},[resizing]);

 const effectiveMode=compact?(panelMode==='map'?'map':'table'):panelMode;
 const apiRows=query.data?.data;
 const rows=useMemo(()=>withDashboardPreviewTelemetry(apiRows||[]),[apiRows]);
 const chosen=rows.find(vehicle=>vehicle.id===selected)||null;
 const preview=rows.find(vehicle=>vehicle.id===hovered)||chosen;
 const allColumns=useMemo<Record<ColumnKey,Column<FleetVehicle>>>(()=>({
  sn:{key:'sn',label:'SN',render:(_,index)=>(page-1)*25+index+1},
  status:{key:'status',label:'Status',sortValue:row=>row.fleet_status,render:row=><VehicleIcon type={row.vehicle_type} state={row.fleet_status} size="lg"/>},
  vehicle:{key:'vehicle',label:'Vehicle',sortValue:row=>row.vehicle_number,render:row=><div className="vehicle-identity"><strong>{row.vehicle_number}</strong><span>{row.alias||row.device_id||row.vehicle_type||'Unlabelled vehicle'}</span></div>},
  client:{key:'client',label:'Client',sortValue:row=>row.client_name||row.client_username||row.owner_email,render:row=>row.client_name||row.client_username||row.owner_email},
  speed:{key:'speed',label:'Speed',sortValue:row=>row.speed,render:row=>speed(row.speed)},
  gps:{key:'gps',label:'GPS',sortValue:row=>row.server_received_at,render:row=>dateTime(row.server_received_at)},
  since:{key:'since',label:'Since',sortValue:row=>row.status_since_at,render:row=>dateTime(row.status_since_at)},
  todayKm:{key:'todayKm',label:'TodayKm',sortValue:row=>row.today_distance_km,render:row=>km(row.today_distance_km)},
  todayDuration:{key:'todayDuration',label:'TodayDu',sortValue:row=>row.today_running_seconds,render:row=>duration(row.today_running_seconds)},
  address:{key:'address',label:'Address',sortValue:row=>row.address,render:row=><span>{row.address||'Unavailable'}<AddressAttribution value={row.address_attribution}/></span>},
 }),[page]);
 const columns=(manager?[...operationalColumns.slice(0,3),'client' as ColumnKey,...operationalColumns.slice(3)]:operationalColumns).map(key=>allColumns[key]);

 return <section className={`page dashboard-page dashboard-mode-${effectiveMode} ${chosen?'has-selected':''}`}>
 {role==='SUPER_ADMIN'&&issuance.data&&<div className="dashboard-issuance" role="status">Monthly issuance: <strong>{Number(issuance.data.issued).toLocaleString()} / {Number(issuance.data.monthly_target).toLocaleString()} coins</strong><span>{issuance.data.enforce_hard_cap?'Monthly cap enabled':'Reporting target'}</span></div>}
  <div className="status-grid">{filters.map(([key,label,Icon])=><FilterPill key={key} status={key} label={label} count={query.data?.counts?.[key]} icon={Icon} active={status===key} onClick={()=>setStatus(key)}/>)}</div>
  {compact&&<div className="dashboard-panel-switch" role="group" aria-label="Fleet view"><button type="button" aria-pressed={effectiveMode==='table'} onClick={()=>setPanelMode('table')}>Vehicle list</button><button type="button" aria-pressed={effectiveMode==='map'} onClick={()=>setPanelMode('map')}>Map</button></div>}
  <div ref={workspaceRef} className={`dashboard-workspace mode-${effectiveMode}`} style={effectiveMode==='split'?{gridTemplateColumns:`minmax(0,${splitPercent}fr) 8px minmax(0,${100-splitPercent}fr)`}:undefined}>
   <section className="fleet-panel">
    <div className="panel-toolbar">
     <label className="search-box"><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search vehicle or alias" aria-label="Search vehicles"/>{search&&<button onClick={()=>setSearch('')} aria-label="Clear search"><X/></button>}</label>
     <div className="panel-tools">
      <button type="button" className="panel-tool" aria-label={panelMode==='table'?'Exit table fullscreen':'Table fullscreen'} title={panelMode==='table'?'Exit Table Fullscreen':'Table Fullscreen'} aria-pressed={panelMode==='table'} onClick={()=>setPanelMode(value=>value==='table'?'split':'table')}>{panelMode==='table'?<Minimize2/>:<FontAwesomeIcon icon={faMaximize}/>}</button>
     </div>
    </div>
    {query.isLoading?<StatePanel kind="loading" title="Loading authorized fleet"/>:query.isError?<StatePanel kind="error" title="Fleet data unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:!rows.length?<StatePanel kind="empty" title="No vehicles found" detail="Try another status or search term."/>:<><DataTable columns={columns} rows={rows} selected={selected} onSelect={row=>setSelected(row.id)}/><div className="pagination dashboard-pagination"><span>Showing {(page-1)*25+1} to {Math.min(page*25,query.data?.pagination.total||0)} of {query.data?.pagination.total||0} entries</span><div><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><button disabled={page*25>=(query.data?.pagination.total||0)} onClick={()=>setPage(value=>value+1)}>Next</button></div></div></>}
   </section>
   <button type="button" className="dashboard-resizer" role="separator" aria-label="Resize table and map" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={Math.round(splitPercent)} onPointerDown={()=>setResizing(true)} onKeyDown={event=>{if(event.key==='ArrowLeft')setSplitPercent(value=>Math.max(30,value-2));if(event.key==='ArrowRight')setSplitPercent(value=>Math.min(70,value+2))}}/>
   <section className="map-panel">
    <FleetMap vehicles={rows} selectedId={selected} onSelect={setSelected} onHover={setHovered} mapType={mapType}/>
    <div className="dashboard-map-tools"><button type="button" aria-label={panelMode==='map'?'Exit map fullscreen':'Map fullscreen'} title={panelMode==='map'?'Exit Map Fullscreen':'Map Fullscreen'} aria-pressed={panelMode==='map'} onClick={()=>setPanelMode(value=>value==='map'?'split':'map')}>{panelMode==='map'?<Minimize2/>:<FontAwesomeIcon icon={faMaximize}/>}</button><button type="button" aria-label="Map settings" title="Map settings" aria-expanded={mapSettings} onClick={()=>setMapSettings(value=>!value)}><Settings/></button>{mapSettings&&<div className="dashboard-layer-menu"><label><input type="checkbox" role="switch" aria-label="Satellite" checked={mapType==='satellite'} onChange={event=>setMapType(event.target.checked?'satellite':'street')}/><span>Satellite</span></label></div>}</div>
    {preview&&<VehiclePopup vehicle={preview} onClose={()=>hovered?setHovered(null):setSelected(null)}/>}
   </section>
  </div>
  {chosen&&<SelectedVehicleSummary vehicle={chosen} onClose={()=>setSelected(null)}/>}
  {manager&&<PageFilterDrawer title="Client" ariaLabel="Dashboard filters">
   <label>Client<SearchableSelect aria-label="Client" placeholder="Select Client" value={clientDraft} onChange={setClientDraft} isClearable options={(clients.data??[]).map(owner=>({value:owner.id,label:owner.name||owner.username||owner.email}))}/></label>
   <button className="button" type="button" onClick={()=>{setClientId(clientDraft);pageFilter.close()}}>Search</button>
  </PageFilterDrawer>}
 </section>;
}
