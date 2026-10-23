import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({disk:new Map<string,string>(),auth:{tokens:{accessToken:'access',refreshToken:'refresh'},sessionKey:'session'},settings:{alertNotification:true,voiceAssistance:true,sound:true,vibration:true},authListener:undefined as undefined|((next:unknown,previous:unknown)=>void),settingsListener:undefined as undefined|((next:unknown,previous:unknown)=>void),received:undefined as undefined|((notification:unknown)=>void),speak:vi.fn(),stop:vi.fn(),vibrate:vi.fn(),put:vi.fn().mockResolvedValue({data:{data:{userId:'client'}}}),unregister:vi.fn().mockResolvedValue(undefined)}));
vi.mock('react-native',()=>({Platform:{OS:'android'},AppState:{currentState:'active',addEventListener:()=>({remove:vi.fn()})},Vibration:{vibrate:state.vibrate}}));
vi.mock('@react-native-async-storage/async-storage',()=>({default:{getItem:async(key:string)=>state.disk.get(key)??null,setItem:async(key:string,value:string)=>{state.disk.set(key,value);},removeItem:async(key:string)=>{state.disk.delete(key);}}}));
vi.mock('expo-constants',()=>({default:{appOwnership:'standalone',expoConfig:{extra:{eas:{projectId:'project'}}}}}));
vi.mock('expo-device',()=>({isDevice:true}));
vi.mock('expo',()=>({requireOptionalNativeModule:()=>null}));
vi.mock('expo-task-manager',()=>({isTaskDefined:()=>false,defineTask:vi.fn()}));
vi.mock('expo-speech',()=>({speak:state.speak,stop:state.stop}));
vi.mock('./native',()=>({isNativePushAvailable:()=>true,loadNativeNotifications:()=>({AndroidImportance:{HIGH:4},setNotificationChannelAsync:vi.fn().mockResolvedValue(undefined),getPermissionsAsync:vi.fn().mockResolvedValue({granted:true}),getExpoPushTokenAsync:vi.fn().mockResolvedValue({data:'ExpoPushToken[test]'}),registerTaskAsync:vi.fn().mockResolvedValue(undefined),setNotificationHandler:vi.fn(),addNotificationReceivedListener:(fn:typeof state.received)=>{state.received=fn;return{remove:vi.fn()};},unregisterForNotificationsAsync:state.unregister,dismissAllNotificationsAsync:vi.fn().mockResolvedValue(undefined)})}));
vi.mock('../api/client',()=>({api:{put:state.put}}));
vi.mock('../api/vehicles',()=>({getVehicles:vi.fn()}));
vi.mock('../storage/tokens',()=>({tokenStorage:{getItem:async()=>JSON.stringify({sessionKey:state.auth.sessionKey})}}));
vi.mock('../../constants/config',()=>({config:{demoMode:false}}));
vi.mock('../../store/authStore',()=>({useAuthStore:{getState:()=>state.auth,subscribe:(fn:typeof state.authListener)=>{state.authListener=fn;return()=>{};}}}));
vi.mock('../../store/settingsStore',()=>({useSettingsStore:{getState:()=>state.settings,subscribe:(fn:typeof state.settingsListener)=>{state.settingsListener=fn;return()=>{};}}}));
import {startNotificationRuntime} from './runtime';
import {playParkingAlarm} from './parking-sound';
vi.mock('./parking-sound',()=>({playParkingAlarm:vi.fn().mockResolvedValue(undefined),stopParkingAlarm:vi.fn()}));
import {publishMobileAlert} from './events';
import {useNotificationStore} from '../../store/notificationStore';
let stop:(()=>void)|undefined;
beforeEach(()=>{vi.useFakeTimers();state.disk.clear();vi.clearAllMocks();useNotificationStore.getState().clear();state.auth={tokens:{accessToken:'access',refreshToken:'refresh'},sessionKey:'session'};state.settings={alertNotification:true,voiceAssistance:true,sound:true,vibration:true};});
afterEach(()=>{stop?.();stop=undefined;vi.useRealTimers();});
it('registers preferences and speaks a socket/push event once with the real registration',async()=>{
 stop=startNotificationRuntime();await vi.advanceTimersByTimeAsync(500);
 expect(state.put).toHaveBeenCalledWith('/mobile/push-device',expect.objectContaining({voice:true,enabled:true,platform:'android',refreshToken:'refresh'}));
 const alert={id:'one',vehicleId:'bike',vehicleNumber:'AB12',eventType:'VEHICLE_RUNNING',message:'Vehicle AB12 has started.',occurredAt:new Date().toISOString()};
 publishMobileAlert(alert);await vi.advanceTimersByTimeAsync(1);
 state.received!({request:{content:{data:{...alert,userId:'client'}}}});await vi.advanceTimersByTimeAsync(1);
 expect(state.speak).toHaveBeenCalledOnce();expect(state.speak.mock.calls[0][0]).toBe('Vehicle A B 1 2 has started.');
 expect(state.vibrate).toHaveBeenCalledOnce();expect(useNotificationStore.getState().alert?.id).toBe('one');
});
it('stops voice immediately and rejects stale events and deliveries for another account',async()=>{
 stop=startNotificationRuntime();await vi.advanceTimersByTimeAsync(500);
 const alert={id:'other',vehicleId:'bike',vehicleNumber:'AB12',eventType:'VEHICLE_STOPPED',message:'Vehicle AB12 has stopped.',occurredAt:new Date().toISOString()};
 state.received!({request:{content:{data:{...alert,userId:'foreign'}}}});await vi.advanceTimersByTimeAsync(1);
 publishMobileAlert({...alert,occurredAt:new Date(Date.now()-360000).toISOString()});await vi.advanceTimersByTimeAsync(1);
 expect(state.speak).not.toHaveBeenCalled();
 const previous=state.settings;state.settings={...previous,voiceAssistance:false};state.settingsListener!(state.settings,previous);
 expect(state.stop).toHaveBeenCalled();
 publishMobileAlert(alert);await vi.advanceTimersByTimeAsync(1);expect(state.speak).not.toHaveBeenCalled();
});

it('rings, pops up and speaks each parking reminder once, with a short vehicle/radius warning',async()=>{
 stop=startNotificationRuntime();await vi.advanceTimersByTimeAsync(500);
 const alert={id:'movement',vehicleId:'bike',vehicleNumber:'HR12AU6675',radius:50,eventType:'PARKING_MOVEMENT',message:'Long parking audit message with time and coordinates.',occurredAt:new Date().toISOString()};
 publishMobileAlert(alert);publishMobileAlert(alert);await vi.advanceTimersByTimeAsync(1);
 expect(playParkingAlarm).toHaveBeenCalledOnce();expect(state.vibrate).toHaveBeenCalledOnce();
 expect(useNotificationStore.getState().alert?.id).toBe('movement');
 expect(state.speak.mock.calls[0][0]).toBe('Warning! Vehicle H R 1 2 A U 6 6 7 5 has moved more than 50 metres from its parking place. Please check your vehicle now.');
 // Simulate speech completing before the server's next interval event.
 state.speak.mock.calls[0][1].onDone();
 await vi.advanceTimersByTimeAsync(60000);
 publishMobileAlert({...alert,id:'reminder',eventType:'PARKING_REMINDER',occurredAt:new Date().toISOString()});await vi.advanceTimersByTimeAsync(1);
 expect(playParkingAlarm).toHaveBeenCalledTimes(2);expect(state.speak).toHaveBeenCalledTimes(2);
 expect(useNotificationStore.getState().alert?.id).toBe('reminder');
 state.received!({request:{content:{data:{...alert,id:'reminder',eventType:'PARKING_REMINDER',userId:'client',occurredAt:new Date().toISOString()}}}});await vi.advanceTimersByTimeAsync(1);
 expect(playParkingAlarm).toHaveBeenCalledTimes(2);expect(state.speak).toHaveBeenCalledTimes(2);
});

it('parking still speaks when sound is disabled and still pops up when voice is disabled',async()=>{
 state.settings.sound=false;stop=startNotificationRuntime();await vi.advanceTimersByTimeAsync(500);
 const alert={id:'parking',vehicleId:'bike',vehicleNumber:'AB12',radius:30,eventType:'PARKING_REMINDER',message:'Parking reminder',occurredAt:new Date().toISOString()};
 publishMobileAlert(alert);await vi.advanceTimersByTimeAsync(1);
 expect(playParkingAlarm).not.toHaveBeenCalled();expect(state.speak).toHaveBeenCalledOnce();
 const previous=state.settings;state.settings={...previous,voiceAssistance:false,sound:true};state.settingsListener!(state.settings,previous);
 publishMobileAlert({...alert,id:'next'});await vi.advanceTimersByTimeAsync(1);
 expect(playParkingAlarm).toHaveBeenCalledOnce();expect(state.speak).toHaveBeenCalledOnce();expect(useNotificationStore.getState().alert?.id).toBe('next');
});

it('audio playback errors do not swallow parking speech and alerts off blocks all presentation',async()=>{
 vi.mocked(playParkingAlarm).mockRejectedValueOnce(new Error('Audio unavailable'));
 stop=startNotificationRuntime();await vi.advanceTimersByTimeAsync(500);
 const alert={id:'parking-error',vehicleId:'bike',vehicleNumber:'AB12',radius:20,eventType:'PARKING_MOVEMENT',message:'Parking alert',occurredAt:new Date().toISOString()};
 publishMobileAlert(alert);await vi.advanceTimersByTimeAsync(1);expect(state.speak).toHaveBeenCalledOnce();expect(useNotificationStore.getState().alert?.id).toBe('parking-error');
 state.settings.alertNotification=false;publishMobileAlert({...alert,id:'muted'});await vi.advanceTimersByTimeAsync(1);
 expect(playParkingAlarm).toHaveBeenCalledOnce();expect(state.speak).toHaveBeenCalledOnce();expect(useNotificationStore.getState().alert?.id).toBe('parking-error');
});

it('does not speak a warning after it was acknowledged while the siren was playing',async()=>{
 let finish!:()=>void;vi.mocked(playParkingAlarm).mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
 stop=startNotificationRuntime();await vi.advanceTimersByTimeAsync(500);
 publishMobileAlert({id:'acknowledged',vehicleId:'bike',vehicleNumber:'AB12',radius:50,eventType:'PARKING_MOVEMENT',message:'Parking audit',occurredAt:new Date().toISOString()});await vi.advanceTimersByTimeAsync(1);
 useNotificationStore.getState().dismiss();finish();await vi.advanceTimersByTimeAsync(1);expect(state.speak).not.toHaveBeenCalled();
});
