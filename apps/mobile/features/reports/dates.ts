// The existing fleet dashboard defines calendar days in India time.
export const REPORT_TIME_ZONE='Asia/Kolkata';
export const presets=['Today','Yesterday','This Week','Last Week','This Month','Last Month'] as const;
export type ReportPreset=typeof presets[number];
export function dateKey(now=new Date()){return new Date(+now+330*60_000).toISOString().slice(0,10)}
const day=(key:string)=>new Date(`${key}T00:00:00Z`);
const key=(value:Date)=>value.toISOString().slice(0,10);
const add=(value:Date,n:number)=>{const next=new Date(value);next.setUTCDate(next.getUTCDate()+n);return next};
export function presetDates(preset:ReportPreset,now=new Date()){
 const today=day(dateKey(now));let from=today,to=today;
 if(preset==='Yesterday')from=to=add(today,-1);
 if(preset==='This Week')from=add(today,-((today.getUTCDay()+6)%7));
 if(preset==='Last Week'){from=add(today,-((today.getUTCDay()+6)%7)-7);to=add(from,6)}
 if(preset==='This Month')from=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1));
 if(preset==='Last Month'){from=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-1,1));to=add(new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1)),-1)}
 return {from:key(from),to:key(to)};
}
export function reportRange(from:string,to:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||key(day(from))!==from||key(day(to))!==to)throw new Error('Select valid dates.');
 if(from>to)throw new Error('From Date must not be after To Date.');
 if(to>dateKey())throw new Error('Select dates up to today.');
 const start=new Date(`${from}T00:00:00+05:30`),end=new Date(+new Date(`${to}T00:00:00+05:30`)+86400000);
 if(+end-+start>31*86400000)throw new Error('Select at most 31 days.');
 return {start:start.toISOString(),end:end.toISOString(),timeZone:REPORT_TIME_ZONE};
}
export const displayDate=(date:string)=>date.slice(0,10).split('-').reverse().join('/');
export const reportDuration=(seconds:number|null)=>seconds==null?'—':`${Math.floor(seconds/3600).toString().padStart(2,'0')}:${Math.floor(seconds%3600/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
export const reportNumber=(value:number|null,suffix='')=>value==null?'—':`${Number(value.toFixed(2))}${suffix}`;
export function reportTime(value:string|null){if(!value)return'—';const india=new Date(+new Date(value)+330*60_000);return `${displayDate(india.toISOString())} ${india.toISOString().slice(11,19)}`}
