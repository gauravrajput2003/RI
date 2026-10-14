import * as TaskManager from 'expo-task-manager';
import {isNativePushAvailable,loadNativeNotifications} from './native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import {tokenStorage} from '../storage/tokens';
import {parseVehicleAlert,spokenAlert} from './events';
export const VOICE_TASK='fleet-vehicle-voice';
export const PUSH_SESSION='fleet.push.session.v1';
let claims:Promise<unknown>=Promise.resolve();
async function claim(id:string,channel:'voice'|'popup'){
 const key=`fleet.alert.${channel}.v1`;
 const seen:Record<string,number>=JSON.parse(await AsyncStorage.getItem(key)??'{}');
 if(seen[id])return false;
 const now=Date.now();
 for(const [event,at] of Object.entries(seen))if(now-at>600000)delete seen[event];
 seen[id]=now;
 await AsyncStorage.setItem(key,JSON.stringify(seen));return true;
}
export function claimAlert(id:string,channel:'voice'|'popup'){const result=claims.catch(()=>{}).then(()=>claim(id,channel));claims=result;return result;}
if(Platform.OS==='android'&&isNativePushAvailable()&&!TaskManager.isTaskDefined(VOICE_TASK))TaskManager.defineTask(VOICE_TASK,async({data,error})=>{
 if(error||!data)return;
 const task=data as {data?:unknown;notification?:{request?:{content?:{data?:unknown}}}};
 let payload=task.notification?.request?.content?.data??task.data;
 if(payload&&typeof payload==='object'&&'dataString' in payload){try{payload=JSON.parse(String(payload.dataString));}catch{return;}}
 const alert=parseVehicleAlert(payload);
 if(!alert?.voiceOnly)return;
 const saved=JSON.parse(await AsyncStorage.getItem(PUSH_SESSION)??'null');
 const auth=JSON.parse(await tokenStorage.getItem('fleet.auth.tokens')??'null');
 if(!saved?.enabled||!saved.voice||saved.userId!==alert.userId||!auth?.sessionKey||saved.sessionKey!==auth.sessionKey)return;
 if(!await claimAlert(alert.id,'voice'))return;
 // Let the bundled fallback announcement finish before reading the plate.
 await new Promise(resolve=>setTimeout(resolve,3000));
 const latest=JSON.parse(await AsyncStorage.getItem(PUSH_SESSION)??'null');
 const latestAuth=JSON.parse(await tokenStorage.getItem('fleet.auth.tokens')??'null');
 const preferences=JSON.parse(await AsyncStorage.getItem('fleet.settings.v1')??'null');
 if(preferences?.state?.alertNotification===false||preferences?.state?.voiceAssistance===false)return;
 if(!latest?.enabled||!latest.voice||latest.sessionKey!==saved.sessionKey||latestAuth?.sessionKey!==auth.sessionKey)return;
 await new Promise<void>(resolve=>{
  const timeout=setTimeout(resolve,20000);
  const finish=()=>{clearTimeout(timeout);resolve();};
  Speech.speak(spokenAlert(alert),{language:'en-IN',rate:0.9,onDone:finish,onError:finish,onStopped:finish});
 });
});
export async function registerVoiceTask(){if(Platform.OS==='android')await loadNativeNotifications()?.registerTaskAsync(VOICE_TASK);}
