import type {PlaybackPoint} from '../../types';
export function pointTime(point:PlaybackPoint){return new Date(point.tracker_timestamp||point.server_received_at).getTime()}
export function playbackIndex(points:PlaybackPoint[],time:number){let low=0,high=points.length-1,result=0;while(low<=high){const middle=(low+high)>>1;if(pointTime(points[middle])<=time){result=middle;low=middle+1}else high=middle-1}return result}
export function normalizePoints(points:PlaybackPoint[]){return [...points].filter(p=>Number.isFinite(pointTime(p))).sort((a,b)=>pointTime(a)-pointTime(b)||a.id.localeCompare(b.id))}
