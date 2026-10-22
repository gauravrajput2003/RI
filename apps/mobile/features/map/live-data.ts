import {useEffect,useRef} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import type {LiveMapData} from '../../../../packages/shared-types/src/live-map';
import {api} from '../../services/api/client';
import {useAuthStore} from '../../store/authStore';
import {useRuntimeStore} from '../../store/runtimeStore';
import {dateKey} from '../reports/dates';
import {config} from '../../constants/config';
export function useLiveMapData(id:string,observation?:string,focused=true){
 const session=useAuthStore(state=>state.sessionKey),online=useRuntimeStore(state=>state.online),cache=useQueryClient(),last=useRef(0);
 const key=['live-map-data',session,id,dateKey()] as const;
 const query=useQuery({queryKey:key,queryFn:async({signal})=>{
  if(config.demoMode)throw new Error('Live Map metrics require a real backend session.');
  return(await api.get<{data:LiveMapData}>(`/vehicles/${encodeURIComponent(id)}/live-map`,{signal,timeout:30_000})).data.data;
 },enabled:Boolean(id&&focused),staleTime:5000,retry:1,refetchOnWindowFocus:false});
 // Reuse the existing selected-vehicle refresh/socket lifecycle, without another polling loop.
 useEffect(()=>{if(!id||!focused||online===false||Date.now()-last.current<5000)return;last.current=Date.now();void cache.invalidateQueries({queryKey:['live-map-data',session,id]});},[cache,id,session,observation,focused,online]);
 return query;
}
