import {useDeferredValue,useEffect,useMemo,useRef,useState} from 'react';
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
import {dateTime,speed} from '../lib/format';

const filters=[['ALL','All',Car],['OVERSPEED','Overspeed',Gauge],['RUNNING','Running',PlayCircle],['IDLE','Idle',Clock3],['STOPPED','Stopped',PauseCircle],['UNREACHABLE','Unreachable',WifiOff],['NEW','New',Sparkles],['INACTIVE','Inactive',Ban]] as const;
type FleetResponse=Envelope<FleetVehicle[]>&{counts:Record<FleetStatus,number>;pagination:{page:number;pageSize:number;total:number}};
type PanelMode='split'|'table'|'map';
type ColumnKey='sn'|'status'|'vehicle'|'client'|'speed'|'gps'|'since'|'todayKm'|'todayDuration'|'address';
type PreviewTelemetry=Pick<FleetVehicle,'latitude'|'longitude'|'speed'|'address'|'server_received_at'|'status_since_at'|'today_distance_km'|'today_running_seconds'|'today_stopped_seconds'|'today_avg_speed'|'today_max_speed'|'distance_from_last_stop_km'|'duration_from_last_stop_seconds'|'duration_at_last_stop_seconds'>;

const operationalColumns:ColumnKey[]=['sn','status','vehicle','speed','gps','since','todayKm','todayDuration','address'];
const previewTelemetry:PreviewTelemetry[]=[
 {latitude:28.8678,longitude:76.5943,speed:18,address:'Rohtak Jhajjar Rd, Sector-23, Rohtak, Haryana 124021, India',server_received_at:'2026-09-23T03:28:33.000Z',status_since_at:'2026-09-18T07:55:56.000Z',today_distance_km:2,today_running_seconds:2160,today_stopped_seconds:300,today_avg_speed:15,today_max_speed:31,distance_from_last_stop_km:1.2,duration_from_last_stop_seconds:540,duration_at_last_stop_seconds:180},
 {latitude:28.8958,longitude:76.5916,speed:12,address:'Church Road, Company Bagh, Rohtak, Haryana 124001, India',server_received_at:'2026-09-23T03:30:57.000Z',status_since_at:'2026-09-22T16:02:44.000Z',today_distance_km:2.4,today_running_seconds:1680,today_stopped_seconds:480,today_avg_speed:10,today_max_speed:24,distance_from_last_stop_km:.8,duration_from_last_stop_seconds:360,duration_at_last_stop_seconds:240},
];
const duration=(value:number|null)=>value==null?'Unavailable':`${Math.floor(value/3600).toString().padStart(2,'0')}:${Math.floor(value%3600/60).toString().padStart(2,'0')}`;
const km=(value:number|null)=>value==null?'Unavailable':`${Number(value).toFixed(1)} km`;

// Temporary dashboard preview data. Every real API field wins as soon as it is present.
export function withDashboardPreviewTelemetry(vehicles:FleetVehicle[]):FleetVehicle[]{
 return vehicles.map((vehicle,index)=>{
  const preview=previewTelemetry[index];
  if(!preview)return vehicle;
  return {
   ...vehicle,
   latitude:vehicle.latitude??preview.latitude,
   longitude:vehicle.longitude??preview.longitude,
   speed:vehicle.speed??preview.speed,
   address:vehicle.address||preview.address,
   server_received_at:vehicle.server_received_at??preview.server_received_at,
   status_since_at:vehicle.status_since_at??preview.status_since_at,
   today_distance_km:vehicle.today_distance_km??preview.today_distance_km,
   today_running_seconds:vehicle.today_running_seconds??preview.today_running_seconds,
   today_stopped_seconds:vehicle.today_stopped_seconds??preview.today_stopped_seconds,
   today_avg_speed:vehicle.today_avg_speed??preview.today_avg_speed,
   today_max_speed:vehicle.today_max_speed??preview.today_max_speed,
   distance_from_last_stop_km:vehicle.distance_from_last_stop_km??preview.distance_from_last_stop_km,
   duration_from_last_stop_seconds:vehicle.duration_from_last_stop_seconds??preview.duration_from_last_stop_seconds,
   duration_at_last_stop_seconds:vehicle.duration_at_last_stop_seconds??preview.duration_at_last_stop_seconds,
  };
 });
}

export function DashboardPage(){
 const role=claims()?.role;
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
 const query=useQuery({queryKey:['fleet',status,deferred,page,clientId],queryFn:async()=>{const {data}=await api.get<FleetResponse>('/dashboard/vehicles',{params:{status,search:deferred,page,pageSize:25,clientId:clientId||undefined}});return data}});
 useEffect(()=>{const token=getTokens()?.accessToken;if(!token)return;const base=(import.meta.env.VITE_SOCKET_URL||import.meta.env.VITE_API_URL||'http://localhost:3000').replace(/\/api\/v1\/?$/,'');const socket=io(base,{auth:{token},transports:['websocket']});socket.on('vehicle:location',(payload:Partial<FleetVehicle>&{vehicleId?:string})=>{client.setQueriesData<FleetResponse>({queryKey:['fleet']},old=>old?{...old,data:old.data.map(vehicle=>vehicle.id===(payload.vehicleId||payload.id)?{...vehicle,...payload}:vehicle)}:old)});return()=>{socket.disconnect()}},[client]);
 useEffect(()=>{if(!resizing)return;const move=(event:PointerEvent)=>{const bounds=workspaceRef.current?.getBoundingClientRect();if(!bounds)return;setSplitPercent(Math.max(30,Math.min(70,((event.clientX-bounds.left)/bounds.width)*100)))};const stop=()=>setResizing(false);window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop,{once:true});return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop)}},[resizing]);

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
  address:{key:'address',label:'Address',sortValue:row=>row.address,render:row=>row.address||'Unavailable'},
 }),[page]);
 const columns=(manager?[...operationalColumns.slice(0,3),'client' as ColumnKey,...operationalColumns.slice(3)]:operationalColumns).map(key=>allColumns[key]);

 return <section className={`page dashboard-page dashboard-mode-${panelMode} ${chosen?'has-selected':''}`}>
  <div className="status-grid">{filters.map(([key,label,Icon])=><FilterPill key={key} status={key} label={label} count={query.data?.counts?.[key]} icon={Icon} active={status===key} onClick={()=>setStatus(key)}/>)}</div>
  <div ref={workspaceRef} className={`dashboard-workspace mode-${panelMode}`} style={panelMode==='split'?{gridTemplateColumns:`minmax(420px,${splitPercent}fr) 8px minmax(420px,${100-splitPercent}fr)`}:undefined}>
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
   <label>Client<select value={clientDraft} onChange={event=>setClientDraft(event.target.value)}><option value="">Select Client</option>{clients.data?.map(owner=><option key={owner.id} value={owner.id}>{owner.name||owner.username||owner.email}</option>)}</select></label>
   <button className="button" type="button" onClick={()=>{setClientId(clientDraft);pageFilter.close()}}>Search</button>
  </PageFilterDrawer>}
 </section>;
}
