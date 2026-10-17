import {useInfiniteQuery,useQuery} from '@tanstack/react-query';
import {useAuthStore} from '../../store/authStore';
import {config} from '../../constants/config';
import {driverKeys,getDrivers,getVehicleDriver} from './service';
export function useDrivers(vehicleId?:string){
 const session=useAuthStore(state=>state.sessionKey);
 return useInfiniteQuery({queryKey:driverKeys.list(session,vehicleId),initialPageParam:undefined as string|undefined,
  queryFn:({pageParam,signal})=>getDrivers(vehicleId,pageParam,signal),getNextPageParam:(last,_pages,lastCursor)=>last.nextCursor&&last.nextCursor!==lastCursor?last.nextCursor:undefined,
  enabled:Boolean(session)&&!config.demoMode,staleTime:0,retry:1});
}
export function useVehicleDriver(vehicleId:string){
 const session=useAuthStore(state=>state.sessionKey);
 return useQuery({queryKey:driverKeys.assignment(session,vehicleId),queryFn:({signal})=>getVehicleDriver(vehicleId,signal),enabled:Boolean(session&&vehicleId)&&!config.demoMode,staleTime:0,retry:1});
}
