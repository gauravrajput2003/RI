import type {QueryClient} from '@tanstack/react-query';
import {AppState,Platform,Vibration} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {loadNativeNotifications} from './native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {api} from '../api/client';
import {useAuthStore} from '../../store/authStore';
import {useSettingsStore} from '../../store/settingsStore';
import {useNotificationStore} from '../../store/notificationStore';
import {parseVehicleAlert,subscribeMobileAlerts,spokenAlert} from './events';
import {claimAlert,PUSH_SESSION,registerVoiceTask} from './background';
import {voiceQueue,stopVoice} from './voice';
import {config} from '../../constants/config';
import {prepareIosVehicleSounds} from './ios-sounds';

export function startNotificationRuntime(queryClient?:QueryClient){
 if(config.demoMode)return()=>{};
 let disposed=false,generation=0,timer:ReturnType<typeof setTimeout>|undefined;
 let sessionKey=useAuthStore.getState().sessionKey;
 const preview=Platform.OS==='web';
 const Notifications=loadNativeNotifications();
 const status=(text:string)=>useNotificationStore.setState({status:text});
 let iosPreparation:Promise<string[]>=Promise.resolve([]);
 const channels=async()=>{
  if(Platform.OS!=='android'||!Notifications)return;
  for(const kind of ['running','idle','stopped'])for(const vibrate of [true,false])await Notifications.setNotificationChannelAsync(`vehicle-voice-${kind}-${vibrate?'vibrate':'quiet'}`,{
   name:`Spoken vehicle ${kind} (${vibrate?'vibration':'no vibration'})`,importance:Notifications.AndroidImportance.HIGH,
   sound:`vehicle-${kind}.wav`,enableVibrate:vibrate,vibrationPattern:vibrate?[0,250,100,250]:[0],
  });
  for(const sound of [true,false])for(const vibrate of [true,false])await Notifications.setNotificationChannelAsync(
   `vehicle-alerts-${sound?'sound':'silent'}-${vibrate?'vibrate':'quiet'}`,{
    name:`Vehicle alerts (${sound?'sound':'silent'}, ${vibrate?'vibration':'no vibration'})`,
    importance:Notifications.AndroidImportance.HIGH,sound:sound?'default':null,
    enableVibrate:vibrate,vibrationPattern:vibrate?[0,250,100,250]:[0],
   });
 };
 const configure=async()=>{
  const version=++generation,auth=useAuthStore.getState(),settings=useSettingsStore.getState();
  if(!auth.tokens||!auth.sessionKey){await AsyncStorage.removeItem(PUSH_SESSION);return;}
  const idKey=`fleet.push.installation.v1.${auth.sessionKey}`;
  let installationId=await AsyncStorage.getItem(idKey);
  if(!installationId){installationId='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3)|8).toString(16);});await AsyncStorage.setItem(idKey,installationId);}
  let expoToken:string|null=null;let voiceVehicles:string[]=[];let voicePreparationFailed=false;
  if(Notifications&&!settings.alertNotification)await Notifications.unregisterForNotificationsAsync();
  if(Notifications&&settings.alertNotification){
   if(!Device.isDevice){status('Use a physical phone to test remote push alerts.');return;}
   await channels();
   const permission=await Notifications.getPermissionsAsync();
   const granted=permission.granted||(settings.alertNotification&&(await Notifications.requestPermissionsAsync()).granted);
   if(!granted){await AsyncStorage.removeItem(PUSH_SESSION);await api.delete(`/mobile/push-device/${installationId}`).catch(()=>{});status('Phone notification permission is off. Enable it in phone settings.');return;}
   const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId;
   if(!projectId){status('Push project is not configured.');return;}
   expoToken=(await Notifications.getExpoPushTokenAsync({projectId})).data;
   await registerVoiceTask();
   if(Platform.OS==='ios'&&settings.voiceAssistance){
    status('Preparing spoken vehicle notifications…');
    iosPreparation=iosPreparation.catch(()=>[]).then(()=>prepareIosVehicleSounds(()=>!disposed&&version===generation&&useAuthStore.getState().sessionKey===auth.sessionKey));
    voiceVehicles=await iosPreparation.catch(()=>{voicePreparationFailed=true;return [];});
   }
  }
  if(disposed||version!==generation||useAuthStore.getState().sessionKey!==auth.sessionKey)return;
  // Web/Expo Go can still receive foreground events; neither can receive this
  // project's native phone push token without an installed build.
  const body={installationId,expoToken,platform:expoToken?Platform.OS:'web',refreshToken:auth.tokens.refreshToken,
   enabled:settings.alertNotification,sound:settings.sound,vibration:settings.vibration,voice:settings.voiceAssistance,voiceVehicles};
  const response=await api.put<{data:{userId:string}}>('/mobile/push-device',body);
  if(disposed||version!==generation||useAuthStore.getState().sessionKey!==auth.sessionKey)return;
  await AsyncStorage.setItem(PUSH_SESSION,JSON.stringify({userId:response.data.data.userId,sessionKey:auth.sessionKey,
   enabled:settings.alertNotification,voice:settings.voiceAssistance}));
  status(!settings.alertNotification?'Vehicle alerts are off.':expoToken?(voicePreparationFailed?'Push alerts enabled with spoken state sounds. Rebuild the app or reopen Settings to prepare full vehicle-number speech.':'Phone push alerts are enabled.'):
   preview?'Web preview: voice and popups work while this page is open.':'Expo Go: foreground alerts only. Install a development build for phone push.');
 };
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{const expected=generation+1;void configure().catch(()=>{if(!disposed&&generation===expected)status('Push setup unavailable. Check the connection and phone push credentials.');});},300);};
 const receive=async(payload:unknown)=>{
  const alert=parseVehicleAlert(payload),settings=useSettingsStore.getState(),auth=useAuthStore.getState();
  if(!alert||!auth.sessionKey||!settings.alertNotification||AppState.currentState!=='active')return;
  const expected=auth.sessionKey;
  if(alert.userId){const saved=JSON.parse(await AsyncStorage.getItem(PUSH_SESSION)??'null');if(saved?.userId!==alert.userId||saved.sessionKey!==expected)return;}
  if(!alert.voiceOnly&&await claimAlert(alert.id,'popup')){
   if(disposed||useAuthStore.getState().sessionKey!==expected)return;
   useNotificationStore.getState().show(alert);
   if(settings.vibration)Vibration.vibrate([0,250,100,250]);

  }
  if(settings.voiceAssistance&&await claimAlert(alert.id,'voice')){
   if(!disposed&&useAuthStore.getState().sessionKey===expected&&useSettingsStore.getState().voiceAssistance&&useSettingsStore.getState().alertNotification)voiceQueue.add(spokenAlert(alert));
  }
 };
 const stopEvents=subscribeMobileAlerts(payload=>{void receive(payload).catch(()=>{});});
 const stopSettings=useSettingsStore.subscribe((state,previous)=>{
  if(!state.voiceAssistance||!state.alertNotification)stopVoice();
  if(state.alertNotification!==previous.alertNotification||state.voiceAssistance!==previous.voiceAssistance||state.sound!==previous.sound||state.vibration!==previous.vibration)schedule();
 });
 const stopAuth=useAuthStore.subscribe((state,previous)=>{
  if(state.sessionKey!==sessionKey){sessionKey=state.sessionKey;stopVoice();useNotificationStore.getState().dismiss();void AsyncStorage.removeItem(PUSH_SESSION);if(Notifications&&!state.sessionKey){void Notifications.unregisterForNotificationsAsync().catch(()=>{});void Notifications.dismissAllNotificationsAsync().catch(()=>{});}}
  if(state.tokens!==previous.tokens||state.sessionKey!==previous.sessionKey)schedule();
 });
 let stopReceived:(()=>void)|undefined;
 if(Notifications){
  Notifications.setNotificationHandler({handleNotification:async notification=>{
   const settings=useSettingsStore.getState(),data=notification.request.content.data??{};
   const auth=useAuthStore.getState();
   const saved=JSON.parse(await AsyncStorage.getItem(PUSH_SESSION)??'null');
   const alert=parseVehicleAlert(data);
   const enabled=settings.alertNotification&&Boolean(auth.sessionKey)&&Boolean(alert)&&saved?.sessionKey===auth.sessionKey&&saved.userId===data.userId;
   return {shouldShowBanner:false,shouldShowList:enabled&&!data.voiceOnly,
    shouldPlaySound:enabled&&settings.sound&&!settings.voiceAssistance&&!data.voiceOnly,shouldSetBadge:false};
  }});
  const listener=Notifications.addNotificationReceivedListener(notification=>{
   if(notification.request.content.data?.localAlert)return;
   void receive(notification.request.content.data).catch(()=>{});
  });stopReceived=()=>listener.remove();
 }
 let fleetSignature='';
 const stopFleet=queryClient?.getQueryCache().subscribe(event=>{
  if(event.type!=='updated'||event.query.queryKey[0]!=='vehicles'||event.query.queryKey[1]!=='list')return;
  const snapshot=event.query.state.data as {pages?:{data?:{id:string;vehicle_number:string}[]}[]}|undefined;
  const signature=(snapshot?.pages?.flatMap(page=>page.data??[]).map(vehicle=>`${vehicle.id}:${vehicle.vehicle_number}`).sort()??[]).join('|');
  if(signature&&signature!==fleetSignature){fleetSignature=signature;schedule();}
 });
 const app=AppState.addEventListener('change',state=>{if(state==='active')schedule();else stopVoice();});
 schedule();
 return()=>{disposed=true;generation++;clearTimeout(timer);stopEvents();stopSettings();stopAuth();stopReceived?.();stopFleet?.();app.remove();stopVoice();};
}
