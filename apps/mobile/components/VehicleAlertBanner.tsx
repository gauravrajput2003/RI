import {useEffect} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {useVehicleStore} from '../store/vehicleStore';
import {router} from 'expo-router';
import {useNotificationStore} from '../store/notificationStore';
import {alertMessage,isParkingWarning} from '../services/notifications/events';
export function VehicleAlertBanner({onNavigate}:{onNavigate?:()=>void}={}){
 const {alert,dismiss}=useNotificationStore();
 useEffect(()=>{if(!alert||isParkingWarning(alert))return;const timeout=setTimeout(dismiss,8000);return()=>clearTimeout(timeout);},[alert,dismiss]);
 if(!alert||isParkingWarning(alert))return null;
 return <View style={styles.banner} accessibilityLiveRegion="assertive"><Pressable style={styles.body} onPress={()=>{dismiss();onNavigate?.();if(alert.eventType.startsWith('PARKING_')){useVehicleStore.getState().setSelected(alert.vehicleId);router.push('/(app)/map');return;}router.push({pathname:'/(app)/vehicle/[vehicleId]',params:{vehicleId:alert.vehicleId}});}}><Text style={styles.title}>{alert.eventType==='PARKING_REMINDER'?'Parking reminder':alert.eventType==='PARKING_RETURNED'?'Parking returned':alert.eventType==='PARKING_MOVEMENT'?'Parking Movement Alert':'Vehicle alert'}</Text><Text style={styles.message}>{alertMessage(alert)}</Text></Pressable><Pressable onPress={dismiss} accessibilityLabel="Dismiss vehicle alert" hitSlop={12}><Text style={styles.close}>×</Text></Pressable></View>;
}
const styles=StyleSheet.create({banner:{position:'absolute',top:55,left:12,right:12,zIndex:10000,elevation:12,backgroundColor:'#fff',borderColor:'#0f766e',borderWidth:1,borderRadius:12,padding:14,flexDirection:'row',gap:12},body:{flex:1},title:{fontWeight:'800',color:'#0f766e',marginBottom:4},message:{color:'#172b3d',fontSize:15},close:{fontSize:24,color:'#172b3d'}});
