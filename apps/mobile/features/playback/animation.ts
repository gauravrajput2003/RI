import type {Location} from '../../types/models';
import {haversineDistance,routeTime} from './route';

// This clock controls visual replay only. GPS times, recorded speeds and route
// statistics continue to use the original fixes. Long gaps jump to the next fix.
export function animationTimeline(points:Location[]){
 const durations=points.map((point,index)=>index?Math.max(1,routeTime(point)-routeTime(points[index-1])):0);
 const stationary=(index:number)=>index>0&&(points[index].speed??0)<=1&&(points[index-1].speed??0)<=1&&haversineDistance(points[index-1].latitude!,points[index-1].longitude!,points[index].latitude!,points[index].longitude!)<.01;
 for(let index=1;index<points.length;){
  if(stationary(index)){
   let end=index,total=0;while(end<points.length&&stationary(end)){total+=durations[end];end++;}
   // Compress the whole stop once, not every individual stationary packet.
   const scale=Math.min(1,2000/total);for(let cursor=index;cursor<end;cursor++)durations[cursor]*=scale;
   index=end;
  }else{durations[index]=Math.min(durations[index],durations[index]>120000?2000:30000);index++;}
 }
 let elapsed=0;return durations.map(duration=>elapsed+=duration);
}
export function animationFrame(points:Location[],timeline:number[],elapsed:number){
 let low=0,high=timeline.length-1,index=0;
 while(low<=high){const middle=(low+high)>>1;if(timeline[middle]<=elapsed){index=middle;low=middle+1;}else high=middle-1;}
 const from=points[index],to=points[index+1];
 if(!from)return null;
 let latitude=from.latitude!,longitude=from.longitude!,heading=from.course??0;
 if(to){
  const gap=routeTime(to)-routeTime(from),distance=haversineDistance(latitude,longitude,to.latitude!,to.longitude!);
  const fraction=Math.max(0,Math.min(1,(elapsed-timeline[index])/Math.max(1,timeline[index+1]-timeline[index])));
  // Interpolate adjacent plausible GPS fixes, never draw a journey through a
  // long missing-data interval or an impossible location jump.
  if(gap>0&&gap<=120000&&distance<=gap/1000*(200/3600)){
   latitude+=(to.latitude!-latitude)*fraction;
   const delta=((to.longitude!-longitude+540)%360)-180;
   longitude=((longitude+delta*fraction+540)%360)-180;
   if(distance>.001){const rad=Math.PI/180,a=from.latitude!*rad,b=to.latitude!*rad,d=delta*rad;
    heading=(Math.atan2(Math.sin(d)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d))*180/Math.PI+360)%360;
   }
  }
 }
 return {index,latitude,longitude,heading};
}
