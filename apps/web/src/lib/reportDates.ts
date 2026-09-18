export type RangePreset='today'|'yesterday'|'last7'|'last30'|'thisMonth'|'lastMonth'|'custom';
const localInput=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
const startOfDay=(date:Date)=>{const value=new Date(date);value.setHours(0,0,0,0);return value};
export function presetRange(preset:Exclude<RangePreset,'custom'>,now=new Date()){let start=startOfDay(now),end=new Date(start);end.setDate(end.getDate()+1);if(preset==='yesterday'){end=start;start=new Date(start);start.setDate(start.getDate()-1)}if(preset==='last7')start.setDate(start.getDate()-6);if(preset==='last30')start.setDate(start.getDate()-29);if(preset==='thisMonth')start=new Date(now.getFullYear(),now.getMonth(),1);if(preset==='lastMonth'){start=new Date(now.getFullYear(),now.getMonth()-1,1);end=new Date(now.getFullYear(),now.getMonth(),1)}return{start:localInput(start),end:localInput(end)}}
export function selectedDay(value:string){const [year,month,day]=value.split('-').map(Number),start=new Date(year,month-1,day),end=new Date(year,month-1,day+1);return{start:start.toISOString(),end:end.toISOString()}}
export const toIso=(value:string)=>new Date(value).toISOString();
