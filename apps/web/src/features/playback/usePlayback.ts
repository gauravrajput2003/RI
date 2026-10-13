import {useEffect,useMemo,useRef,useState} from 'react';
import type {PlaybackPoint} from '../../types';
import {normalizePoints,routeFrame,routeStops} from './engine';

// Replay recorded route segments on a compressed animation timeline. GPS times,
// speeds and mileage remain the recorded values; interpolation is display only.
export function usePlayback(input:PlaybackPoint[]){
 const points=useMemo(()=>normalizePoints(input),[input]);
 const stops=useMemo(()=>routeStops(points),[points]);
 const [progress,setProgress]=useState(0),[playing,setPlaying]=useState(false),[rate,setRate]=useState(1);
 const progressRef=useRef(progress);progressRef.current=progress;
 useEffect(()=>{progressRef.current=0;setProgress(0);setPlaying(false)},[points]);
 useEffect(()=>{
  if(!playing||stops.length<2)return;
  let frame=0,last=performance.now();
  const tick=(now:number)=>{
   const next=Math.min(stops.length-1,progressRef.current+(now-last)*rate/1000);last=now;
   progressRef.current=next;setProgress(next);
   if(next>=stops.length-1){setPlaying(false);return}
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[playing,stops,rate]);
 const active=routeFrame(points,stops,progress);
 function seek(index:number){
  const next=stops.findIndex(stop=>stop>=index);
  const value=next<0?Math.max(0,stops.length-1):next;
  progressRef.current=value;setProgress(value);
 }
 return {points,index:active.index,position:active.position,canPlay:stops.length>1,setIndex:seek,playing,setPlaying,rate,setRate,
  toggle(){if(stops.length<2)return;if(!playing&&progressRef.current>=stops.length-1){progressRef.current=0;setProgress(0)}setPlaying(value=>!value)},
  reset(){setPlaying(false);progressRef.current=0;setProgress(0)}
 };
}
