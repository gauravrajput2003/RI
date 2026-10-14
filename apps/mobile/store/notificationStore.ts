import {create} from 'zustand';
import type {VehicleAlert} from '../services/notifications/events';
export const useNotificationStore=create<{alert:VehicleAlert|null;status:string;show:(alert:VehicleAlert)=>void;dismiss:()=>void}>(set=>({
 alert:null,status:'Notifications not enabled',show:alert=>set({alert}),dismiss:()=>set({alert:null}),
}));
