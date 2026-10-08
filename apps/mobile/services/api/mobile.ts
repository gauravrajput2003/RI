import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { config } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
import { useRuntimeStore } from '../../store/runtimeStore';
import type { MobileAccount } from '../../features/account/capabilities';
export const useAccount = () => {
  const session = useAuthStore(state => state.sessionKey);
  return useQuery({ queryKey: ['mobile-account', session], enabled: Boolean(session) && !config.demoMode,
    queryFn: async ({ signal }) => (await api.get<{data: MobileAccount}>('/mobile/session', { signal })).data.data,
    staleTime: 30_000, refetchInterval: 60_000 });
};
export function requireOnline() {
  if (useRuntimeStore.getState().online === false) throw new Error('You are offline. Connect to the internet and try again.');
  if (config.demoMode) throw new Error('This action requires a live account.');
}
export interface SupportContact {name:string;phone:string|null;email:string|null;logoUrl:string|null}
export function useSupportContact(){
  const session=useAuthStore(state=>state.sessionKey);
  return useQuery({queryKey:['support-contact',session],enabled:Boolean(session)&&!config.demoMode,
    queryFn:async({signal})=>(await api.get<{data:SupportContact|null}>('/mobile/support-contact',{signal})).data.data,
    staleTime:30_000});
}
export const mobileMessage = (error: unknown) => {
  const data = (error as {response?:{data?:{error?:{message?:string};message?:string}}})?.response?.data;
  return data?.error?.message || data?.message || (error instanceof Error ? error.message : 'Unable to complete this action.');
};
export interface EditableVehicle { id:string; vehicle_number:string; vehicle_type:string|null; mileage:number|string|null; odometer:number|string|null; gps_location:string|null; alias:string|null; remark:string|null; overspeed_limit:number|null }
export async function getEditableVehicle(id:string) { return (await api.get<{data:EditableVehicle}>(`/mobile/vehicles/${encodeURIComponent(id)}`)).data.data; }
export async function createVehicleShare(id:string,minutes:number) {
  requireOnline();
  const {data} = await api.post<{data:{token:string;expiresAt:string}}>(`/mobile/vehicles/${encodeURIComponent(id)}/shares`,{minutes});
  return {...data.data,url:`${config.apiUrl}/shared-vehicles/${encodeURIComponent(data.data.token)}`};
}
