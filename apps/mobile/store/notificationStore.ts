import {create} from 'zustand';
import {isParkingWarning,type VehicleAlert} from '../services/notifications/events';
export const useNotificationStore=create<{alert:VehicleAlert|null;pending:VehicleAlert[];status:string;show:(alert:VehicleAlert)=>void;dismiss:()=>void;clear:()=>void}>(set=>({
 alert:null,pending:[],status:'Notifications not enabled',
 show:alert=>set(state=>{
  if(state.alert?.id===alert.id||state.pending.some(item=>item.id===alert.id))return state;
  if(alert.eventType==='PARKING_RETURNED'){
   const pending=state.pending.filter(item=>item.vehicleId!==alert.vehicleId||!isParkingWarning(item));
   if(state.alert&&isParkingWarning(state.alert)&&state.alert.vehicleId!==alert.vehicleId)return {pending:[...pending,alert].slice(-20)};
   return {alert,pending};
  }
  if(state.alert&&isParkingWarning(state.alert)){
   // A routine start/stop message must not hide an unacknowledged parking alarm.
   if(isParkingWarning(alert)&&alert.vehicleId===state.alert.vehicleId)return {alert};
   const pending=state.pending.filter(item=>item.vehicleId!==alert.vehicleId||isParkingWarning(item)!==isParkingWarning(alert));
   return {pending:[...pending,alert].slice(-20)};
  }
  return {alert};
 }),
 dismiss:()=>set(state=>{
  const next=state.pending.findIndex(isParkingWarning),index=next<0?0:next;
  return {alert:state.pending[index]??null,pending:state.pending.filter((_,i)=>i!==index)};
 }),
 clear:()=>set({alert:null,pending:[]}),
}));
