import {useQuery} from '@tanstack/react-query';
import {api} from '../../services/api/client';
import {requireOnline} from '../../services/api/mobile';
import {useAuthStore} from '../../store/authStore';
import {config} from '../../constants/config';
import type {ParkingInput,ParkingMode} from '../../../../packages/shared-types/src/parking';
export function useParking(id:string){
 const session=useAuthStore(state=>state.sessionKey);
 return useQuery({queryKey:['parking',session,id],enabled:Boolean(session&&id)&&!config.demoMode,staleTime:0,retry:1,refetchInterval:10000,
  queryFn:async({signal})=>{requireOnline();return (await api.get<{data:ParkingMode}>(`/vehicles/${encodeURIComponent(id)}/parking`,{signal})).data.data;}});
}
export async function changeParking(id:string,input:ParkingInput){
 requireOnline();const session=useAuthStore.getState().sessionKey;if(!session)throw new Error('Sign in again to manage Parking Mode.');
 const response=(await api.put<{data:ParkingMode}>(`/vehicles/${encodeURIComponent(id)}/parking`,{...input,confirmed:true})).data.data;
 if(session!==useAuthStore.getState().sessionKey)throw new Error('Your session changed. Reload Parking Mode.');return response;
}
