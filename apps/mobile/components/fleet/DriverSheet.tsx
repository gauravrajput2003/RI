import {useCallback,useRef,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {SvgXml} from 'react-native-svg';
import {useVehicleDriver} from '../../features/drivers/queries';
import {useAccount,mobileMessage} from '../../services/api/mobile';
import {capabilities} from '../../features/account/capabilities';
import type {StreetVehicle} from './StreetViewSheet';
export function DriverSheet({vehicle,onClose}:{vehicle:StreetVehicle|null;onClose():void}){
 const [focused,setFocused]=useState(false);
 const choosing=useRef(false);
 useFocusEffect(useCallback(()=>{choosing.current=false;setFocused(true);return()=>setFocused(false);},[]));
 if(!vehicle||!focused)return null;
 return <DriverDialog key={vehicle.id} vehicle={vehicle} onClose={onClose} onChoose={()=>{if(choosing.current)return;choosing.current=true;setFocused(false);router.push({pathname:'/(app)/drivers',params:{vehicleId:vehicle.id,vehicleNumber:vehicle.vehicle_number}});}}/>;
}
function DriverDialog({vehicle,onClose,onChoose}:{vehicle:StreetVehicle;onClose():void;onChoose():void}){
 const current=useVehicleDriver(vehicle.id),account=useAccount(),caps=capabilities(account.data),driver=current.data?.driver;
 return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={styles.overlay}><Pressable accessibilityLabel="Dismiss Driver" onPress={onClose} style={StyleSheet.absoluteFill}/><View accessibilityViewIsModal style={styles.modal}>
  <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Driver</Text><Pressable accessibilityRole="button" accessibilityLabel="Close Driver" onPress={onClose} hitSlop={10} style={styles.close}><SvgXml xml={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path d="m2 2 8 8m0-8-8 8" fill="none" stroke="#444" stroke-width="1.8" stroke-linecap="round"/></svg>'} width={12} height={12}/></Pressable></View>
  <View style={styles.body}>{current.isLoading?<ActivityIndicator/>:current.isError?<><Text accessibilityRole="alert" style={styles.error}>{mobileMessage(current.error)}</Text><Pressable accessibilityRole="button" onPress={()=>void current.refetch()}><Text>Retry driver</Text></Pressable></>:driver?<View style={styles.driver}><Text style={styles.name}>{driver.name}</Text><Text>{driver.mobile}</Text><Text style={styles.licence}>{driver.licence_number}</Text></View>:null}
   <Pressable accessibilityRole="button" accessibilityLabel="Assign Driver" disabled={!caps.editVehicle||current.isLoading||current.isError} onPress={onChoose} style={[styles.assign,(!caps.editVehicle||current.isLoading||current.isError)&&{opacity:.5}]}><Text style={styles.assignText}>⊕ Assign Driver</Text></Pressable>
   {!caps.editVehicle&&account.data?<Text style={styles.error}>Vehicle edit permission is required to assign a driver.</Text>:null}
  </View>
 </View></View></Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'#0007',justifyContent:'center',paddingHorizontal:16},modal:{width:'100%',maxWidth:420,alignSelf:'center',backgroundColor:'#fff',borderTopLeftRadius:4,borderTopRightRadius:4,overflow:'hidden'},header:{height:45,paddingHorizontal:10,backgroundColor:'#f00000',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontSize:20,fontWeight:'700',color:'#fff'},close:{width:18,height:18,borderRadius:10,backgroundColor:'#eee',alignItems:'center',justifyContent:'center'},body:{padding:14,gap:10},assign:{borderWidth:1,borderStyle:'dotted',borderColor:'#9d44b5',borderRadius:8,height:42,alignItems:'center',justifyContent:'center'},assignText:{color:'#8914a7',fontSize:16,fontWeight:'700'},driver:{gap:4,paddingBottom:3},name:{fontSize:17,fontWeight:'700',color:'#111'},licence:{fontSize:12,color:'#666'},error:{fontSize:12,color:'#b91c1c',lineHeight:18}});
