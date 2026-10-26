import {useQuery} from '@tanstack/react-query';
import {api} from '../../services/api/client';
import {requireOnline} from '../../services/api/mobile';
import {useAuthStore} from '../../store/authStore';
import {config} from '../../constants/config';
import type {RelayAction,VehicleRelay,RelayCommand} from '../../../../packages/shared-types/src/relay';
export function useVehicleRelay(id:string){
 const session=useAuthStore(state=>state.sessionKey);
 // Mounted only while the relay dialog is open. Poll quickly enough to catch
 // trackers that wake briefly; do not enqueue a command for their next wake-up.
 return useQuery<VehicleRelay>({queryKey:['vehicle-relay',session,id],enabled:Boolean(session&&id)&&!config.demoMode,retry:1,staleTime:0,refetchInterval:1000,
  queryFn:async({signal})=>{requireOnline();return (await api.get<{data:VehicleRelay}>(`/vehicles/${encodeURIComponent(id)}/relay`,{signal})).data.data;}});
}
export async function sendRelayRequest(id:string,action:RelayAction,idempotencyKey:string,probe?:{profile:string;connectionId:string}){
 requireOnline();const session=useAuthStore.getState().sessionKey;
 if(!session)throw new Error('Sign in again to control this vehicle.');
 // There is no client-side TCP command or optimistic relay-state mutation.
 const response=await api.post<{data:RelayCommand}>(`/vehicles/${encodeURIComponent(id)}/relay/commands`,{action,idempotencyKey,confirmed:true,...(probe?{probeProfile:probe.profile,probeConnectionId:probe.connectionId}:{})});
 if(session!==useAuthStore.getState().sessionKey)throw new Error('Your session changed. Reload the vehicle relay information.');
 return response.data.data;
}
