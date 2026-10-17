import type {MobileReportRow} from '@fleet/shared-types';
import {pointDate,localDateKey,validPosition,type HistoryPoint} from './calculations.js';
export interface MobilePoint extends HistoryPoint {device_id:string;segment_distance_km:number|null;has_distance_pair:boolean}
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
/** Daily observed-history summaries, not inferred ignition trips. Never extend the last fix. */
export function mobileDailyRows(points:MobilePoint[],timeZone:string,movement:number,offline:number,noSignal:number):MobileReportRow[]{
 const days=new Map<string,MobilePoint[]>();
 for(const p of points){const day=localDateKey(pointDate(p),timeZone);const group=days.get(day)??[];group.push(p);days.set(day,group)}
 return [...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,raw])=>{
  const ordered=[...raw].sort((a,b)=>+pointDate(a)-+pointDate(b)||String(a.server_received_at).localeCompare(String(b.server_received_at))||a.id.localeCompare(b.id));
  const gps=ordered.filter(p=>validPosition(p)&&Math.abs(p.latitude!)<=90&&Math.abs(p.longitude!)<=180&&(p.latitude!==0||p.longitude!==0));
  const gpsIds=new Set(gps.map(p=>p.id));
  const speeds=gps.map(p=>p.speed).filter(finite),pairs=gps.filter(p=>p.has_distance_pair);
  let running=0,idle=0,stopped=0,unreachable=0,observed=0,unknownMotion=false,unknownIgnition=false,halts=0;
  const devices=new Map<string,MobilePoint[]>();
  for(const p of ordered){const group=devices.get(p.device_id)??[];group.push(p);devices.set(p.device_id,group)}
  for(const devicePoints of devices.values()){
   let previousState:string|null=null;
   for(let i=0;i<devicePoints.length-1;i++){
    const p=devicePoints[i],elapsed=(+pointDate(devicePoints[i+1])-+pointDate(p))/1000;if(elapsed<=0)continue;
    observed+=elapsed;const known=Math.min(elapsed,offline,noSignal);unreachable+=Math.max(0,elapsed-noSignal);
    // The offline timeout and no-signal timeout are distinct configured definitions.
    const speedKnown=gpsIds.has(p.id)&&finite(p.speed);
    const state=speedKnown&&p.speed!>movement?'running':speedKnown&&p.ignition===true?'idle':speedKnown&&p.ignition===false?'stopped':'unknown';
    if(state==='running')running+=known;
    else if(state==='idle')idle+=known;
    else if(state==='stopped'){stopped+=known;if(previousState!=='stopped')halts++}
    else {if(!speedKnown)unknownMotion=true;unknownIgnition=true}
    if(elapsed>Math.min(offline,noSignal)){unknownMotion=true;unknownIgnition=true}
    previousState=elapsed>Math.min(offline,noSignal)?null:state;
   }
  }
  const first=gps[0]??null,last=gps.at(-1)??null;
  const coords=(p:MobilePoint|null)=>p?{latitude:p.latitude!,longitude:p.longitude!}:null;
  const address=(p:MobilePoint|null)=>typeof p?.metadata?.address==='string'&&p.metadata.address.trim()?p.metadata.address.trim():null;
  const row:MobileReportRow={id:date,date,pointCount:ordered.length,gpsPointCount:gps.length,
   km:pairs.length?pairs.reduce((sum,p)=>sum+Number(p.segment_distance_km??0),0):null,
   avgSpeed:speeds.length?speeds.reduce((sum,n)=>sum+n,0)/speeds.length:null,maxSpeed:speeds.length?Math.max(...speeds):null,
   durationSeconds:observed>0&&devices.size===1?observed:null,
   runningSeconds:observed>0&&!unknownMotion&&devices.size===1?running:null,
   idleSeconds:observed>0&&!unknownIgnition&&devices.size===1?idle:null,
   stoppedSeconds:observed>0&&!unknownIgnition&&devices.size===1?stopped:null,
   unreachableSeconds:observed>0&&devices.size===1?unreachable:null,
   halts:observed>0&&!unknownIgnition&&devices.size===1?halts:null,
   startTime:first?pointDate(first).toISOString():null,endTime:last?pointDate(last).toISOString():null,
   startLocation:coords(first),endLocation:coords(last),startAddress:address(first),endAddress:address(last),partial:false};
  row.partial=[row.km,row.avgSpeed,row.durationSeconds,row.runningSeconds,row.idleSeconds,row.stoppedSeconds,row.halts,row.startAddress,row.endAddress].some(value=>value==null);
  return row;
 });
}
