import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {useQueryClient} from '@tanstack/react-query';
import {PARKING_RADII,PARKING_INTERVALS} from '../../../../packages/shared-types/src/parking';
import {changeParking,useParking} from '../../features/parking/queries';
import {useAccount,mobileMessage} from '../../services/api/mobile';
import {capabilities} from '../../features/account/capabilities';
import {useRuntimeStore} from '../../store/runtimeStore';
import {useVehicleStore} from '../../store/vehicleStore';
import {config} from '../../constants/config';
import MapView,{Marker} from '../../features/map/LeafletMap';
import type {StreetVehicle} from './StreetViewSheet';
export function ParkingSheet({vehicle,onClose}:{vehicle:StreetVehicle|null;onClose():void}){
 const [focused,setFocused]=useState(false);useFocusEffect(useCallback(()=>{setFocused(true);return()=>setFocused(false);},[]));
 return vehicle&&focused?<ParkingDialog key={vehicle.id} vehicle={vehicle} onClose={onClose}/>:null;
}
function ParkingDialog({vehicle,onClose}:{vehicle:StreetVehicle;onClose():void}){
 const current=useParking(vehicle.id),account=useAccount(),caps=capabilities(account.data),online=useRuntimeStore(state=>state.online),cache=useQueryClient(),data=current.data;
 const [radius,setRadius]=useState(20),[repeatMinutes,setRepeat]=useState(1),[confirm,setConfirm]=useState<'enable'|'disable'|'update'|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const submitting=useRef(false);
 useEffect(()=>{if(data){setRadius(data.radius);setRepeat(data.repeatMinutes);}},[data?.version,data?.radius,data?.repeatMinutes]);
 const blocked=!data||current.isError||current.isLoading||busy||online===false||!caps.editVehicle||config.demoMode;
 const save=async()=>{
  if(!confirm||blocked||submitting.current)return;submitting.current=true;setBusy(true);setMessage('');
  try{await changeParking(vehicle.id,{enabled:confirm!=='disable',radius,repeatMinutes,expectedVersion:data!.version});await current.refetch();await cache.invalidateQueries({queryKey:['vehicles']});setConfirm(null);setMessage('Parking Mode saved.');}
  catch(error){setMessage(mobileMessage(error));void current.refetch();}
  finally{submitting.current=false;setBusy(false);}
 };
 const mapPoint=data?.reference;
 return <Modal visible transparent animationType="fade" onRequestClose={()=>{if(!busy)onClose();}}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.modal}>
  <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Parking Mode</Text><Pressable accessibilityRole="button" accessibilityLabel="Close Parking Mode" disabled={busy} onPress={onClose} hitSlop={10}><Text style={styles.close}>×</Text></Pressable></View>
  <ScrollView contentContainerStyle={styles.body}>
   <Text style={styles.number}>{data?.vehicleNumber??vehicle.vehicle_number}</Text>
   {config.demoMode?<Text style={styles.error}>Parking Mode requires real vehicle GPS and is unavailable in demo mode.</Text>:current.isLoading?<ActivityIndicator/>:current.isError?<><Text accessibilityRole="alert" style={styles.error}>{mobileMessage(current.error)}</Text><Pressable onPress={()=>void current.refetch()}><Text>Retry Parking Mode</Text></Pressable></>:data?<>
    <Text style={[styles.status,{color:data.enabled?'#16834a':'#666'}]}>Parking Mode {data.enabled?'ON':'OFF'}</Text>
    <Text style={styles.muted}>{data.message}</Text>
    {data.enabled?<><Text>Boundary: {data.boundaryState} · Radius: {data.radius} m</Text><Text style={styles.muted}>Activated: {data.activatedAt?new Date(data.activatedAt).toLocaleString():'—'}</Text><Text style={styles.muted}>Last evaluated GPS: {data.lastEvaluatedAt?new Date(data.lastEvaluatedAt).toLocaleString():'Unavailable'}</Text></>:null}
    {mapPoint?<View style={styles.map}><MapView initialRegion={{...mapPoint,latitudeDelta:.002,longitudeDelta:.002}}><Marker coordinate={mapPoint} title={`Parking reference · ${data.radius} m`}/></MapView></View>:null}
    <Text style={styles.label}>Movement radius</Text><View style={styles.options}>{PARKING_RADII.map(value=><Pressable key={value} accessibilityRole="button" accessibilityLabel={`Parking radius ${value} m`} accessibilityState={{selected:radius===value}} disabled={busy||!caps.editVehicle} onPress={()=>setRadius(value)} style={[styles.option,radius===value&&styles.selected]}><Text>{value} m</Text></Pressable>)}</View>
    <Text style={styles.label}>Repeat alert interval</Text><View style={styles.options}>{PARKING_INTERVALS.map(value=><Pressable key={value} accessibilityRole="button" accessibilityLabel={`Parking repeat ${value} minutes`} accessibilityState={{selected:repeatMinutes===value}} disabled={busy||!caps.editVehicle} onPress={()=>setRepeat(value)} style={[styles.option,repeatMinutes===value&&styles.selected]}><Text>{value} min</Text></Pressable>)}</View>
    {data.enabled?<><Pressable accessibilityRole="button" accessibilityLabel="Save parking settings" disabled={blocked} onPress={()=>setConfirm('update')} style={[styles.button,blocked&&styles.disabled]}><Text style={styles.buttonText}>Save Settings</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Disable Parking Mode" disabled={blocked} onPress={()=>setConfirm('disable')} style={[styles.button,styles.disable,blocked&&styles.disabled]}><Text style={styles.buttonText}>Disable Parking Mode</Text></Pressable></>:<Pressable accessibilityRole="button" accessibilityLabel="Enable Parking Mode" disabled={blocked||!data.canEnable} onPress={()=>{if(!blocked&&data.canEnable)setConfirm('enable');}} style={[styles.button,(blocked||!data.canEnable)&&styles.disabled]}><Text style={styles.buttonText}>Enable Parking Mode</Text></Pressable>}
    {confirm?<View style={styles.confirm}><Text>{confirm==='enable'?`Enable Parking Mode for ${data.vehicleNumber}? The server will capture its latest fresh GPS position with a ${radius} m radius.`:confirm==='disable'?`Disable Parking Mode for ${data.vehicleNumber} and stop future parking alerts?`:`Update ${data.vehicleNumber} to ${radius} m and ${repeatMinutes} minute reminders? The original parking reference will stay fixed.`}</Text><Pressable accessibilityRole="button" accessibilityLabel="Confirm parking change" disabled={blocked} onPress={()=>void save()} style={styles.button}>{busy?<ActivityIndicator color="#fff"/>:<Text style={styles.buttonText}>Confirm</Text>}</Pressable><Pressable disabled={busy} onPress={()=>setConfirm(null)}><Text>Cancel</Text></Pressable></View>:null}
    <Pressable accessibilityRole="button" accessibilityLabel="Parking vehicle Live Map" onPress={()=>{useVehicleStore.getState().setSelected(vehicle.id);onClose();router.push('/(app)/map');}}><Text style={styles.link}>Open vehicle in Live Map</Text></Pressable>
    {data.history.length?<Text style={styles.label}>Parking events</Text>:null}{data.history.map(event=><View key={event.id} style={styles.event}><Text>{event.eventType==='PARKING_REMINDER'?'Reminder':event.eventType==='PARKING_RETURNED'?'Returned inside':'Movement detected'}</Text><Text style={styles.muted}>{new Date(event.occurredAt).toLocaleString()}</Text><Text style={styles.muted}>{event.message}</Text></View>)}
   </>:null}
   {online===false?<Text style={styles.error}>Phone is offline. Parking changes cannot be saved.</Text>:null}{!caps.editVehicle&&account.data?<Text style={styles.error}>Vehicle edit permission is required to change Parking Mode.</Text>:null}
   {message?<Text accessibilityRole="alert" style={styles.muted}>{message}</Text>:null}
   <Pressable accessibilityRole="button" disabled={busy||current.isFetching} onPress={()=>void current.refetch()}><Text style={styles.link}>Refresh Parking Mode</Text></Pressable>
  </ScrollView>
 </View></View></Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'#0007',justifyContent:'center',padding:16},modal:{width:'100%',maxWidth:440,maxHeight:'90%',alignSelf:'center',backgroundColor:'#fff',borderRadius:12,overflow:'hidden'},header:{backgroundColor:'#ef0000',padding:13,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{color:'#fff',fontSize:20,fontWeight:'700'},close:{color:'#fff',fontSize:26,lineHeight:27},body:{padding:16,gap:12},number:{fontSize:18,fontWeight:'700',color:'#111'},status:{fontSize:16,fontWeight:'700'},muted:{fontSize:12,lineHeight:18,color:'#666'},label:{fontSize:14,fontWeight:'600',color:'#222'},error:{fontSize:13,lineHeight:19,color:'#b91c1c'},map:{height:150,borderRadius:8,overflow:'hidden'},options:{flexDirection:'row',gap:7},option:{flex:1,borderWidth:1,borderColor:'#ccc',paddingVertical:9,alignItems:'center',borderRadius:6},selected:{backgroundColor:'#e4f5e9',borderColor:'#279557'},button:{minHeight:44,backgroundColor:'#258d50',alignItems:'center',justifyContent:'center',padding:10,borderRadius:7},disable:{backgroundColor:'#e50914'},buttonText:{color:'#fff',fontSize:14,fontWeight:'700'},disabled:{opacity:.4},confirm:{padding:12,borderWidth:1,borderColor:'#ccc',borderRadius:7,gap:12},event:{borderTopWidth:1,borderColor:'#eee',paddingTop:8,gap:3},link:{color:'#007c9e',paddingVertical:4}});
