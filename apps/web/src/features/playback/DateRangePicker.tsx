import {useMemo,useState} from 'react';
import {SearchableSelect} from '../../components/ui/SearchableSelect';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';

type Preset='today'|'yesterday'|'7days'|'custom';
type Parts={date:string;hour:string;minute:string};

const pad=(value:number)=>String(value).padStart(2,'0');
const localValue=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const splitValue=(value:string):Parts=>{const [date,time='00:00']=value.split('T');const [hour='00',minute='00']=time.split(':');return{date,hour,minute}};
const joinValue=(parts:Parts)=>`${parts.date}T${parts.hour}:${parts.minute}`;
const monthStart=(date:string)=>{const value=new Date(`${date}T12:00:00`);return new Date(value.getFullYear(),value.getMonth(),1)};
const shiftMonth=(date:Date,offset:number)=>new Date(date.getFullYear(),date.getMonth()+offset,1);
const isoDate=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const presetValues=(preset:Exclude<Preset,'custom'>)=>{const start=new Date(),end=new Date();start.setHours(0,0,0,0);end.setHours(0,0,0,0);end.setDate(end.getDate()+1);if(preset==='yesterday'){end.setTime(start.getTime());start.setDate(start.getDate()-1)}if(preset==='7days')start.setDate(start.getDate()-6);return{start:localValue(start),end:localValue(end)}};
const hours=Array.from({length:24},(_,index)=>pad(index));
const minutes=Array.from({length:60},(_,index)=>pad(index));
const weekdays=['Su','Mo','Tu','We','Th','Fr','Sa'];

function readable(start:string,end:string){
 const format=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
 return `${format.format(new Date(start))} – ${format.format(new Date(end))}`;
}

export function DateRangePicker({start,end,onApply}:{start:string;end:string;onApply:(start:string,end:string)=>void}){
 const initialStart=splitValue(start),initialEnd=splitValue(end);
 const [open,setOpen]=useState(false),[preset,setPreset]=useState<Preset>('custom'),[startParts,setStartParts]=useState(initialStart),[endParts,setEndParts]=useState(initialEnd),[month,setMonth]=useState(()=>monthStart(initialStart.date)),[selectingEnd,setSelectingEnd]=useState(false);
 const display=useMemo(()=>readable(start,end),[start,end]);
 function show(){const nextStart=splitValue(start),nextEnd=splitValue(end);setStartParts(nextStart);setEndParts(nextEnd);setMonth(monthStart(nextStart.date));setSelectingEnd(false);setOpen(true)}
 function usePreset(value:Preset){setPreset(value);if(value==='custom')return;const next=presetValues(value);const nextStart=splitValue(next.start),nextEnd=splitValue(next.end);setStartParts(nextStart);setEndParts(nextEnd);setMonth(monthStart(nextStart.date));setSelectingEnd(false)}
 function chooseDate(date:string){setPreset('custom');if(!selectingEnd||date<startParts.date){setStartParts(current=>({...current,date}));if(date>=endParts.date)setEndParts(current=>({...current,date}));setSelectingEnd(true);return}setEndParts(current=>({...current,date}));setSelectingEnd(false)}
 function calendar(value:Date){const count=new Date(value.getFullYear(),value.getMonth()+1,0).getDate(),offset=value.getDay(),days=Array.from({length:count},(_,index)=>new Date(value.getFullYear(),value.getMonth(),index+1));return <section className="calendar-month" aria-label={value.toLocaleDateString(undefined,{month:'long',year:'numeric'})}><strong>{value.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong><div className="calendar-grid">{weekdays.map(day=><span className="weekday" key={day}>{day}</span>)}{Array.from({length:offset},(_,index)=><span key={`blank-${index}`}/>)}{days.map(day=>{const date=isoDate(day),selected=date===startParts.date||date===endParts.date,inRange=date>startParts.date&&date<endParts.date;return <button type="button" key={date} aria-label={day.toLocaleDateString(undefined,{dateStyle:'long'})} className={`${selected?'selected ':''}${inRange?'in-range':''}`.trim()} onClick={()=>chooseDate(date)}>{day.getDate()}</button>})}</div></section>}
 return <div className="date-range-field"><span>Date range</span><button type="button" className="date-range-trigger" aria-label="Choose playback date range" aria-haspopup="dialog" aria-expanded={open} onClick={()=>open?setOpen(false):show()}><CalendarDays/>{display}</button>{open&&<section className="date-picker-popover" role="dialog" aria-label="Choose playback date range"><header><div><span>Playback period</span><strong>Select dates and time</strong></div><div><button type="button" aria-label="Previous month" onClick={()=>setMonth(value=>shiftMonth(value,-1))}><ChevronLeft/></button><button type="button" aria-label="Next month" onClick={()=>setMonth(value=>shiftMonth(value,1))}><ChevronRight/></button></div></header><div className="date-picker-presets">{([['today','Today'],['yesterday','Yesterday'],['7days','Last 7 Days'],['custom','Custom Range']] as [Preset,string][]).map(([value,label])=><button type="button" key={value} className={preset===value?'active':''} onClick={()=>usePreset(value)}>{label}</button>)}</div><div className="calendar-pair">{calendar(month)}{calendar(shiftMonth(month,1))}</div><div className="date-time-row"><label>Start time<span><SearchableSelect aria-label="Start hour" value={startParts.hour} onChange={value=>setStartParts(current=>({...current,hour:value}))} options={hours.map(value=>({value,label:value}))}/>:<SearchableSelect aria-label="Start minute" value={startParts.minute} onChange={value=>setStartParts(current=>({...current,minute:value}))} options={minutes.map(value=>({value,label:value}))}/></span></label><label>End time<span><SearchableSelect aria-label="End hour" value={endParts.hour} onChange={value=>setEndParts(current=>({...current,hour:value}))} options={hours.map(value=>({value,label:value}))}/>:<SearchableSelect aria-label="End minute" value={endParts.minute} onChange={value=>setEndParts(current=>({...current,minute:value}))} options={minutes.map(value=>({value,label:value}))}/></span></label></div><footer><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>Cancel</button><button type="button" className="button" onClick={()=>{onApply(joinValue(startParts),joinValue(endParts));setOpen(false)}}>Apply</button></footer></section>}</div>;
}
