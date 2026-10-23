import {Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {useNotificationStore} from '../store/notificationStore';
import {useVehicleStore} from '../store/vehicleStore';
import {alertMessage,isParkingWarning} from '../services/notifications/events';
import {stopParkingAlarm} from '../services/notifications/parking-sound';
import {stopVoice} from '../services/notifications/voice';

/** A separate native window appears over every RI route and existing sheet. */
export function ParkingAlertDialog(){
 const alert=useNotificationStore(state=>state.alert),dismiss=useNotificationStore(state=>state.dismiss),insets=useSafeAreaInsets();
 if(!alert||!isParkingWarning(alert))return null;
 const acknowledge=()=>{stopParkingAlarm();stopVoice();dismiss();};
 return <Modal visible transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={acknowledge}>
  <View style={[styles.overlay,{paddingTop:Math.max(insets.top,16)+16}]}>
   <View accessibilityViewIsModal accessibilityRole="alert" accessibilityLabel="Parking security alert" style={styles.dialog}>
    <View style={styles.header}><Text style={styles.heading}>⚠ PARKING ALERT</Text></View>
    <View style={styles.body}>
     <Text style={styles.vehicle}>{alert.vehicleNumber}</Text>
     <Text accessibilityLiveRegion="assertive" style={styles.message}>{alertMessage(alert)}</Text>
     <Text style={styles.note}>Parking protection stays on. You will be warned again if the vehicle remains outside and fresh GPS updates continue.</Text>
     <Pressable accessibilityRole="button" accessibilityLabel="Open parking alert vehicle in Live Map" style={styles.primary} onPress={()=>{acknowledge();useVehicleStore.getState().setSelected(alert.vehicleId);router.push('/(app)/map');}}><Text style={styles.primaryText}>View vehicle on map</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Dismiss parking alert" style={styles.secondary} onPress={acknowledge}><Text style={styles.secondaryText}>Dismiss alert</Text></Pressable>
    </View>
   </View>
  </View>
 </Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'#0008',paddingHorizontal:16},dialog:{width:'100%',maxWidth:520,alignSelf:'center',backgroundColor:'#fff',borderRadius:14,overflow:'hidden',borderWidth:2,borderColor:'#c40000',elevation:24},header:{backgroundColor:'#c40000',paddingVertical:17,paddingHorizontal:20},heading:{color:'#fff',fontSize:22,fontWeight:'900'},body:{padding:20,gap:16},vehicle:{fontSize:28,fontWeight:'900',color:'#a40000'},message:{fontSize:19,lineHeight:28,fontWeight:'700',color:'#231313'},note:{fontSize:13,lineHeight:19,color:'#655858'},primary:{backgroundColor:'#c40000',borderRadius:8,padding:15,alignItems:'center'},primaryText:{color:'#fff',fontSize:16,fontWeight:'800'},secondary:{borderWidth:1,borderColor:'#b4a6a6',borderRadius:8,padding:14,alignItems:'center'},secondaryText:{color:'#5e2020',fontSize:16,fontWeight:'700'}});
