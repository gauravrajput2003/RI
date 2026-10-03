import {CoinManagementPanel} from '../features/admins/CoinManagementPanel';
import {useDeferredValue,useEffect,useState} from 'react';
import {SearchableSelect} from '../components/ui/SearchableSelect';
import {useQuery} from '@tanstack/react-query';
import {api,errorMessage} from '../services/api/client';
import type {Envelope,Pagination} from '../types';
import {DataTable,type Column} from '../components/ui/DataTable';
import {StatePanel} from '../components/ui/StatePanel';
import {PageFilterDrawer} from '../features/shell/PageFilterDrawer';
import {usePageFilterDrawer} from '../features/shell/pageFilterContext';
import {dateTime} from '../lib/format';
import {downloadCsv,printTable} from '../lib/tableExport';

interface CoinTransaction {id:string;username:string;counterParty:string;amount:string|number;type:'DISTRIBUTED'|'RECLAIMED';transactionTime:string}
interface AdminOption {id:string;label:string}
type Response=Envelope<CoinTransaction[]>&{pagination:Pagination};
const inputDate=(date:Date)=>{const offset=date.getTimezoneOffset()*60000;return new Date(+date-offset).toISOString().slice(0,16)};
const todayRange=()=>{const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);return{start:inputDate(start),end:inputDate(end)}};

export function CoinDistributionPage(){
 const initial=todayRange(),pageFilter=usePageFilterDrawer();
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[adminId,setAdminId]=useState(''),[start,setStart]=useState(initial.start),[end,setEnd]=useState(initial.end),[validation,setValidation]=useState('');
 const [applied,setApplied]=useState({adminId:'',start:new Date(initial.start).toISOString(),end:new Date(initial.end).toISOString()}),deferred=useDeferredValue(search);
 useEffect(()=>setPage(1),[deferred,applied]);
 const admins=useQuery({queryKey:['coin-admin-options'],queryFn:async()=>(await api.get<Envelope<AdminOption[]>>('/reports/coin-admins')).data.data});
 const query=useQuery({queryKey:['coin-distribution',deferred,page,applied],queryFn:async()=>(await api.get<Response>('/reports/coin-distribution',{params:{search:deferred,page,pageSize:25,adminId:applied.adminId||undefined,start:applied.start,end:applied.end,sort:'transactionTime',order:'desc'}})).data});
 const rows=query.data?.data??[],total=query.data?.pagination?.total??0;
 const columns:Column<CoinTransaction>[]=[
  {key:'sn',label:'SN',render:(_,index)=>(page-1)*25+index+1},
  {key:'username',label:'Username',render:row=>row.username,sortValue:row=>row.username},
  {key:'counterParty',label:'Counter Party',render:row=>row.counterParty,sortValue:row=>row.counterParty},
  {key:'amount',label:'Amount',render:row=>Number(row.amount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}),sortValue:row=>Number(row.amount)},
  {key:'type',label:'Type',render:row=><span className={`coin-type ${row.type.toLowerCase()}`}>{row.type==='DISTRIBUTED'?'Distributed':'Reclaimed'}</span>,sortValue:row=>row.type},
  {key:'transactionTime',label:'Transaction Time',render:row=>dateTime(row.transactionTime),sortValue:row=>row.transactionTime},
 ];
 const headers=['SN','Username','Counter Party','Amount','Type','Transaction Time'],exports=rows.map((row,index)=>[(page-1)*25+index+1,row.username,row.counterParty,Number(row.amount).toFixed(2),row.type,dateTime(row.transactionTime)]);
 function apply(){if(!start||!end||new Date(start)>=new Date(end)){setValidation('Choose a valid start and end time.');return}setValidation('');setApplied({adminId,start:new Date(start).toISOString(),end:new Date(end).toISOString()});pageFilter.close()}
 return <section className="page coin-distribution-page"><div className="admin-panel"><CoinManagementPanel filters={applied}/><div className="panel-toolbar"><label className="search-box"><span>Search:</span><input aria-label="Search coin distribution" value={search} onChange={event=>setSearch(event.target.value)}/></label><div className="toolbar-actions"><button className="secondary-button export-button" disabled={!rows.length} onClick={()=>printTable('Coin Distribution',headers,exports)}><img src="/assets/export/pdf.png" alt=""/>PDF</button><button className="secondary-button export-button" disabled={!rows.length} onClick={()=>downloadCsv('coin-distribution.csv',headers,exports)}><img src="/assets/export/xls.png" alt=""/>Excel</button></div></div>{query.isLoading?<StatePanel kind="loading" title="Loading coin distribution"/>:query.isError?<StatePanel kind="error" title="Coin distribution unavailable" detail={errorMessage(query.error)} onRetry={()=>query.refetch()}/>:<DataTable columns={columns} rows={rows} emptyMessage="No data available in table"/>}<div className="pagination coin-pagination"><span>Showing {rows.length?(page-1)*25+1:0} to {Math.min(page*25,total)} of {total} entries</span><div><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/25))}</span><button disabled={page*25>=total} onClick={()=>setPage(value=>value+1)}>Next</button></div></div></div><PageFilterDrawer title="" ariaLabel="Coin distribution filters"><label>Admin<SearchableSelect aria-label="Admin" placeholder="Select Admin" value={adminId} onChange={setAdminId} isClearable options={(admins.data??[]).map(admin=>({value:admin.id,label:admin.label}))}/></label><fieldset className="coin-date-range"><legend>Date Range</legend><label>From<input aria-label="Date range start" type="datetime-local" value={start} max={end} onChange={event=>setStart(event.target.value)}/></label><label>To<input aria-label="Date range end" type="datetime-local" value={end} min={start} onChange={event=>setEnd(event.target.value)}/></label></fieldset>{validation&&<div className="form-error" role="alert">{validation}</div>}<button className="button" type="button" onClick={apply}>Search</button></PageFilterDrawer></section>
}

