import type {PlaybackPoint} from '../../types';
export function pointTime(point:PlaybackPoint){return new Date(point.tracker_timestamp||point.server_received_at).getTime()}
export function playbackIndex(points:PlaybackPoint[],time:number){let low=0,high=points.length-1,result=0;while(low<=high){const middle=(low+high)>>1;if(pointTime(points[middle])<=time){result=middle;low=middle+1}else high=middle-1}return result}
export function normalizePoints(points:PlaybackPoint[]){return [...points].filter(p=>Number.isFinite(pointTime(p))&&p.gps_valid&&p.latitude!=null&&p.longitude!=null&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180&&!(p.latitude===0&&p.longitude===0)).sort((a,b)=>pointTime(a)-pointTime(b)||a.id.localeCompare(b.id))}

export function routeStops(points:PlaybackPoint[]):number[]{
 const stops:number[]=[];
 points.forEach((point,index)=>{
  const previous=points[stops.at(-1)??-1];
  if(!previous||previous.latitude!==point.latitude||previous.longitude!==point.longitude)stops.push(index);
 });
 return stops;
}
export function routeFrame(points:PlaybackPoint[],stops:number[],progress:number){
 if(!stops.length)return {index:0,position:undefined};
 const leg=Math.max(0,Math.min(stops.length-1,Math.floor(progress)));
 const index=stops[leg],from=points[index],to=points[stops[Math.min(leg+1,stops.length-1)]];
 const fraction=Math.max(0,Math.min(1,progress-leg));
 return {index,position:{latitude:from.latitude!+(to.latitude!-from.latitude!)*fraction,longitude:from.longitude!+(to.longitude!-from.longitude!)*fraction}};
}
