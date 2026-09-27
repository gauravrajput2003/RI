import {useDeferredValue,useMemo,useState,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,errorMessage} from '../services/api/client';
import type {Envelope,Pagination} from '../types';
import {presetRange,selectedDay,toIso,type RangePreset} from '../lib/reportDates';
import {ClassicReportView} from '../features/shell/ClassicReportView';

export type ReportKind='distance'|'ac'|'packet'|'travel-summary'|'daily-trip-summary'|'status'|'idle'|'running'|'stoppage'|'overspeed'|'unreachable';
type VehicleOption={id:string;vehicle_number:string;alias:string|null};
type Row=Record<string,unknown>;
type ReportResponse=Envelope<Row[]>&{dates?:string[];pagination:Pagination};
type SortDirection='asc'|'desc';
interface Column{key:string;label:string;render:(row:Row,index:number)=>ReactNode;value?:(row:Row)=>unknown;className?:string}
const config:Record<ReportKind,{title:string;subtitle:string;endpoint:string}>={
 distance:{title:'Distance Report',subtitle:'Daily distance across your authorized fleet',endpoint:'/reports/distance'},
 ac:{title:'AC Report',subtitle:'Verified air-condition usage sessions',endpoint:'/reports/ac'},
 packet:{title:'Packet Report',subtitle:'Telemetry activity grouped into time intervals',endpoint:'/reports/packet'},
 'travel-summary':{title:'Travel Summary',subtitle:'Movement, idle and availability overview',endpoint:'/reports/travel-summary'},
 'daily-trip-summary':{title:'Daily Trip Summary',subtitle:'Complete vehicle activity for one calendar day',endpoint:'/reports/daily-trip-summary'},
 status:{title:'Status Report',subtitle:'Historical status sessions and transitions',endpoint:'/reports/status'},
 idle:{title:'Idle Report',subtitle:'Engine-on stationary sessions',endpoint:'/reports/idle'},
 running:{title:'Running Report',subtitle:'Recorded movement sessions and distance',endpoint:'/reports/running'},
 stoppage:{title:'Stoppage Report',subtitle:'Engine-off stoppages and gaps from prior stops',endpoint:'/reports/stoppage'},
 overspeed:{title:'Overspeed Report',subtitle:'Movement above each vehicle’s configured limit',endpoint:'/reports/overspeed'},
 unreachable:{title:'Unreachable Report',subtitle:'Telemetry gaps beyond the configured offline timeout',endpoint:'/reports/unreachable'},
};
const statusOptions=[['IGNITION_ON','Ignition On'],['IGNITION_OFF','Ignition Off'],['IDLE','Idle'],['OVERSPEED','Overspeed'],['UNREACHABLE','Unreachable'],['AC_ON','AC On']] as const;
const serverSortKeys=new Set(['sn','startTime','endTime','durationSeconds','vehicleNumber','km','running','idle','stop','unreachable','tripCount','idleCount','stopCount','unreachableCount','maxSpeed','avgSpeed','packetCount','rangeStart','firstPacket','lastPacket','kmFromLast','duFromLast','status']);
const dayValue=()=>{const date=new Date();return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`};
const seconds=(value:unknown)=>{if(value==null)return'--';const total=Math.max(0,Math.round(Number(value)||0)),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60;return[h,m,s].map(x=>String(x).padStart(2,'0')).join(':')};
const decimal=(value:unknown,suffix='')=>value==null?'--':`${Number(value).toFixed(2)}${suffix}`;
const stamp=(value:unknown)=>value?new Date(String(value)).toLocaleString():'--';
const coords=(value:unknown)=>{const point=value as {latitude?:number;longitude?:number}|null;return point?.latitude!=null&&point.longitude!=null?`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`:'--'};
const text=(value:unknown)=>value==null||value===''?'--':String(value);
const address=(value:unknown)=>value?String(value):'Address unavailable';
const sortable=(key:string,label:string,render:(row:Row,index:number)=>ReactNode,value?:(row:Row)=>unknown,className?:string):Column=>({key,label,render,value:value||((row)=>row[key]),className});

export function ReportPage({kind}:{kind:ReportKind}){
 const daily=kind==='daily-trip-summary',details=config[kind],initialPreset:Exclude<RangePreset,'custom'>=kind==='distance'?'last30':'today',initial=presetRange(initialPreset);
 const [vehicleId,setVehicleId]=useState(''),[preset,setPreset]=useState<RangePreset>(initialPreset),[start,setStart]=useState(initial.start),[end,setEnd]=useState(initial.end),[date,setDate]=useState(dayValue()),[interval,setInterval]=useState(1),[status,setStatus]=useState('IGNITION_ON'),[search,setSearch]=useState(''),[page,setPage]=useState(1),[sort,setSort]=useState<{key:string;direction:SortDirection}>({key:'startTime',direction:'desc'}),[validation,setValidation]=useState('');
 const [applied,setApplied]=useState(()=>({...daily?selectedDay(dayValue()):{start:toIso(initial.start),end:toIso(initial.end)},vehicleId:'',status:'IGNITION_ON',intervalHours:1}));
 const deferredSearch=useDeferredValue(search),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
 const vehicles=useQuery({queryKey:['report-options'],queryFn:async()=>(await api.get<Envelope<VehicleOption[]>>('/reports/options')).data.data});
 const params={...applied,timeZone,vehicleId:applied.vehicleId||undefined,status:kind==='status'?applied.status:undefined,intervalHours:kind==='packet'?applied.intervalHours:undefined,search:deferredSearch,page,pageSize:25,sort:serverSortKeys.has(sort.key)?sort.key:'startTime',order:sort.direction};
 const query=useQuery({queryKey:['report',kind,params],queryFn:async()=>(await api.get<ReportResponse>(details.endpoint,{params})).data});
 const rows=query.data?.data||[],total=query.data?.pagination?.total||0;
 function choosePreset(value:RangePreset){setPreset(value);if(value!=='custom'){const next=presetRange(value);setStart(next.start);setEnd(next.end)}}
 function applyFilters(){if(!daily&&(!start||!end||new Date(start)>=new Date(end))){setValidation('Choose a valid start and end time.');return}setValidation('');setPage(1);setApplied({...daily?selectedDay(date):{start:toIso(start),end:toIso(end)},vehicleId,status,intervalHours:interval})}
 const base:Column[]=[sortable('sn','SN',(_,index)=>(page-1)*25+index+1)];
 const sessionCore:Column[]=[sortable('startTime','Start Time',row=>stamp(row.startTime)),sortable('endTime','End Time',row=>stamp(row.endTime)),sortable('durationSeconds','Duration',row=>seconds(row.durationSeconds))];
 const startLocation=sortable('startLocation','Start Location',row=>coords(row.startLocation));
 const endLocation=sortable('endLocation','End Location',row=>coords(row.endLocation));
 const startAddress=sortable('startAddress','Start Address',row=><span className="address-cell">{address(row.startAddress)}</span>);
 const endAddress=sortable('endAddress','End Address',row=><span className="address-cell">{address(row.endAddress)}</span>);
 const summary:Column[]=[sortable('vehicleNumber','Vehicle',row=><span className="vehicle-report-cell"><strong>{text(row.vehicleNumber)}</strong>{Boolean(row.alias)&&<small>{text(row.alias)}</small>}</span>),sortable('km','Km',row=>decimal(row.km,' km')),sortable('running','Running',row=>seconds(row.running)),sortable('idle','Idle',row=>seconds(row.idle)),sortable('stop','Stop',row=>seconds(row.stop)),sortable('unreachable','Unreachable',row=>seconds(row.unreachable))];
 const columns=useMemo<Column[]>(()=>{
  if(kind==='distance')return[sortable('vehicleNumber','Vehicle',row=>text(row.vehicleNumber)),...(query.data?.dates||[]).map(day=>sortable(day,day,row=>Number((row.distances as Record<string,number>)[day]??0).toLocaleString(undefined,{maximumFractionDigits:2}),row=>(row.distances as Record<string,number>)[day]))];
  if(kind==='ac')return[...base,sortable('status','Status',()=><span className="session-badge ac">AC On</span>),...sessionCore,startLocation,endLocation,startAddress,endAddress];
  if(kind==='packet')return[...base,sortable('rangeStart','Range',row=><span className="range-cell">{stamp(row.rangeStart)}<i>to</i>{stamp(row.rangeEnd)}</span>),sortable('km','Km',row=>decimal(row.km,' km')),sortable('duration','Duration',row=>seconds(row.duration)),sortable('packetCount','Packet Count',row=>text(row.packetCount)),sortable('firstPacket','First Packet',row=>stamp(row.firstPacket)),sortable('firstLocation','First Location',row=>coords(row.firstLocation)),sortable('firstAddress','First Address',row=><span className="address-cell">{address(row.firstAddress)}</span>),sortable('lastPacket','Last Packet',row=>stamp(row.lastPacket)),sortable('lastLocation','Last Location',row=>coords(row.lastLocation)),sortable('lastAddress','Last Address',row=><span className="address-cell">{address(row.lastAddress)}</span>),sortable('maxSpeed','MAX Speed',row=>decimal(row.maxSpeed,' km/h')),sortable('avgSpeed','AVG Speed',row=>decimal(row.avgSpeed,' km/h'))];
  if(kind==='travel-summary')return[...base,summary[0],summary[1],summary[2],sortable('tripCount','Trip Count',row=>text(row.tripCount)),summary[3],sortable('idleCount','Idle Count',row=>text(row.idleCount)),summary[4],sortable('stopCount','Stop Count',row=>text(row.stopCount)),summary[5],sortable('unreachableCount','Unreached Count',row=>text(row.unreachableCount)),sortable('maxSpeed','MAX Speed',row=>decimal(row.maxSpeed,' km/h')),sortable('avgSpeed','AVG Speed',row=>decimal(row.avgSpeed,' km/h'))];
  if(kind==='daily-trip-summary')return[...base,...summary,startLocation,startAddress,endLocation,endAddress,sortable('maxSpeed','MAX Speed',row=>decimal(row.maxSpeed,' km/h')),sortable('avgSpeed','AVG Speed',row=>decimal(row.avgSpeed,' km/h'))];
  if(kind==='status')return[sortable('status','Status',row=>statusOptions.find(([value])=>value===row.status)?.[1]??text(row.status)),sessionCore[0],sessionCore[1],sortable('startLocation','Start Point',row=>coords(row.startLocation)),startAddress,endAddress,sortable('endLocation','End Point',row=>coords(row.endLocation)),sortable('km','Km',row=>decimal(row.km,' km')),sortable('durationSeconds','Time',row=>seconds(row.durationSeconds))];
  if(kind==='idle')return[...base,...sessionCore,sortable('location','Location',row=>coords(row.location)),sortable('address','Address',row=><span className="address-cell">{address(row.address)}</span>)];
  if(kind==='running')return[...base,...sessionCore,sortable('km','Km',row=>decimal(row.km,' km')),startLocation,startAddress,endAddress,endLocation,sortable('maxSpeed','MAX Speed',row=>decimal(row.maxSpeed,' km/h')),sortable('avgSpeed','AVG Speed',row=>decimal(row.avgSpeed,' km/h'))];
  if(kind==='stoppage')return[...base,...sessionCore,sortable('location','Location',row=>coords(row.location)),sortable('address','Address',row=><span className="address-cell">{address(row.address)}</span>),sortable('kmFromLast','Km From Last',row=>decimal(row.kmFromLast,' km')),sortable('duFromLast','Duration From Last',row=>seconds(row.duFromLast))];
  if(kind==='overspeed')return[...base,...sessionCore,sortable('km','Km',row=>decimal(row.km,' km')),startLocation,startAddress,endAddress,endLocation,sortable('maxSpeed','MAX Speed',row=>decimal(row.maxSpeed,' km/h')),sortable('avgSpeed','AVG Speed',row=>decimal(row.avgSpeed,' km/h'))];
  return[...base,...sessionCore,startLocation,startAddress,endAddress,endLocation];
 },[kind,query.data?.dates,page,applied.start,applied.end]);
 const sortedRows=useMemo(()=>{const column=columns.find(item=>item.key===sort.key);if(!column?.value)return rows;return[...rows].sort((a,b)=>{const left=column.value!(a),right=column.value!(b),result=typeof left==='number'&&typeof right==='number'?left-right:String(left??'').localeCompare(String(right??''));return sort.direction==='asc'?result:-result})},[rows,columns,sort]);
 function changeSort(column:Column){if(!column.value)return;setSort(current=>current.key===column.key?{key:column.key,direction:current.direction==='asc'?'desc':'asc'}:{key:column.key,direction:'asc'})}
 return <ClassicReportView kind={kind} title={details.title} columns={columns} rows={sortedRows} total={total} page={page} setPage={setPage} search={search} setSearch={value=>{setSearch(value);setPage(1)}} loading={query.isLoading} error={query.isError?errorMessage(query.error):undefined} retry={()=>{void query.refetch()}} sort={sort} onSort={changeSort} vehicles={vehicles.data??[]} vehicleId={vehicleId} setVehicleId={setVehicleId} status={status} setStatus={setStatus} preset={preset} choosePreset={choosePreset} start={start} end={end} setStart={value=>{setStart(value);setPreset('custom')}} setEnd={value=>{setEnd(value);setPreset('custom')}} date={date} setDate={setDate} interval={interval} setInterval={setInterval} validation={validation} apply={applyFilters}/>;
}
