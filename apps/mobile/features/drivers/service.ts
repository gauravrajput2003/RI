import {api} from '../../services/api/client';
import {requireOnline} from '../../services/api/mobile';
import {useAuthStore} from '../../store/authStore';
import type {Driver,DriverInput,VehicleDriver} from '../../../../packages/shared-types/src/drivers';
export {validateDriver} from '../../../../packages/shared-types/src/drivers';
export type {Driver,DriverInput,VehicleDriver} from '../../../../packages/shared-types/src/drivers';
export const driverKeys={all:['drivers'] as const,list:(session:string|null,vehicleId?:string)=>['drivers',session,'list',vehicleId??'all'] as const,assignment:(session:string|null,vehicleId:string)=>['drivers',session,'assignment',vehicleId] as const};
export async function getDrivers(vehicleId?:string,cursor?:string,signal?:AbortSignal){
 requireOnline();return (await api.get<{data:Driver[];nextCursor:string|null}>('/drivers',{params:{vehicleId,cursor,limit:50},signal})).data;
}
export async function getVehicleDriver(vehicleId:string,signal?:AbortSignal){
 requireOnline();return (await api.get<{data:VehicleDriver}>(`/vehicles/${encodeURIComponent(vehicleId)}/driver`,{signal})).data.data;
}
function sessionKey(){const session=useAuthStore.getState().sessionKey;if(!session)throw new Error('Sign in again to manage drivers.');return session;}
export async function saveDriver(input:DriverInput,vehicleId?:string){
 requireOnline();const session=sessionKey();
 const result=(await api.post<{data:Driver}>('/drivers',{...input,...(vehicleId?{vehicleId}:{})})).data.data;
 if(useAuthStore.getState().sessionKey!==session)throw new Error('Your session changed. Sign in and reload Driver List.');return result;
}
export async function setVehicleDriver(vehicleId:string,driverId:string,expectedAssignmentId:string|null){
 requireOnline();const session=sessionKey();
 const result=(await api.put<{data:VehicleDriver}>(`/vehicles/${encodeURIComponent(vehicleId)}/driver`,{driverId,expectedAssignmentId})).data.data;
 if(useAuthStore.getState().sessionKey!==session)throw new Error('Your session changed. Sign in and reload the vehicle’s Driver information.');return result;
}
