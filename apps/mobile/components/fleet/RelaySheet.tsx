import {useCallback,useRef,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import type {RelayAction} from '../../../../packages/shared-types/src/relay';
import {sendRelayRequest,useVehicleRelay} from '../../features/relay/queries';
import {capabilities} from '../../features/account/capabilities';
import {useAccount,mobileMessage} from '../../services/api/mobile';
import {useRuntimeStore} from '../../store/runtimeStore';
import {config} from '../../constants/config';
import type {StreetVehicle} from './StreetViewSheet';

export function RelaySheet({vehicle,onClose}:{vehicle:StreetVehicle|null;onClose():void}){
 const [focused,setFocused]=useState(false);
 useFocusEffect(useCallback(()=>{setFocused(true);return()=>setFocused(false);},[]));
 return vehicle&&focused?<RelayDialog key={vehicle.id} vehicle={vehicle} onClose={onClose}/>:null;
}
function RelayDialog({vehicle,onClose}:{vehicle:StreetVehicle;onClose():void}){
 const current=useVehicleRelay(vehicle.id),account=useAccount(),caps=capabilities(account.data),online=useRuntimeStore(state=>state.online);
 const [confirmation,setConfirmation]=useState<RelayAction|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const submitting=useRef(false),requestKey=useRef<string|null>(null),data=current.data;
 const blocked=busy||online===false||current.isFetching||current.isError||!data||!caps.editVehicle||config.demoMode;
 const choose=(action:RelayAction)=>{if(blocked||!(action==='lock'?data?.canLock:data?.canUnlock))return;setMessage('');requestKey.current=data!.requestKey;setConfirmation(action);};
 const submit=async()=>{
  if(!confirmation||submitting.current||blocked||!(confirmation==='lock'?data?.canLock:data?.canUnlock))return;
  submitting.current=true;setBusy(true);
  try{if(!requestKey.current)throw new Error('Refresh relay information before submitting.');await sendRelayRequest(vehicle.id,confirmation,requestKey.current);setMessage('Request submitted. Result not confirmed. Refresh tracker information before trying again.');setConfirmation(null);}
  catch(error){setMessage(mobileMessage(error));}
  finally{submitting.current=false;setBusy(false);void current.refetch();}
 };
 return <Modal visible transparent animationType="fade" onRequestClose={()=>{if(!busy)onClose();}}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.modal}>
  <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Lock / Unlock</Text><Pressable accessibilityRole="button" accessibilityLabel="Close Lock / Unlock" disabled={busy} onPress={onClose} hitSlop={10}><Text style={styles.close}>×</Text></Pressable></View>
  <ScrollView contentContainerStyle={styles.body}>
   <Text style={styles.number}>{data?.vehicleNumber??vehicle.vehicle_number}</Text><Text style={styles.muted}>{data?.vehicleType??'Vehicle type unavailable'}</Text>
   {config.demoMode?<Text style={styles.error}>Relay control is unavailable in demo mode. No command can be sent.</Text>:current.isLoading?<ActivityIndicator/>:current.isError?<><Text accessibilityRole="alert" style={styles.error}>{mobileMessage(current.error)}</Text><Pressable accessibilityRole="button" onPress={()=>void current.refetch()}><Text>Retry relay information</Text></Pressable></>:data?<>
    <Text style={styles.state}>Relay state: {data.state==='locked'?'Locked':data.state==='unlocked'?'Unlocked':'Unknown'}</Text><Text style={styles.muted}>{data.stateMessage}</Text>
    <Text>Relay configured: {data.configured?'Yes':'No'}</Text><Text>Tracker protocol: {data.protocol??'Unavailable'}</Text>
    <Text accessibilityRole="alert" style={styles.error}>{data.message}</Text>
   </>:null}
   {online===false?<Text style={styles.error}>Phone is offline. Commands cannot be sent.</Text>:null}
   {!caps.editVehicle&&account.data?<Text style={styles.error}>Vehicle edit permission is required for relay control.</Text>:null}
   <Pressable accessibilityRole="button" accessibilityLabel="Lock Vehicle" disabled={blocked||!data?.canLock} onPress={()=>choose('lock')} style={[styles.button,(blocked||!data?.canLock)&&styles.disabled]}><Text style={styles.buttonText}>Lock Vehicle</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Unlock Vehicle" disabled={blocked||!data?.canUnlock} onPress={()=>choose('unlock')} style={[styles.button,styles.unlock,(blocked||!data?.canUnlock)&&styles.disabled]}><Text style={styles.buttonText}>Unlock Vehicle</Text></Pressable>
   {confirmation?<View style={styles.confirm}>
    <Text>Are you sure you want to {confirmation} vehicle {data?.vehicleNumber??vehicle.vehicle_number}{confirmation==='lock'?'? The tracker may interrupt the configured vehicle circuit.':' and restore the configured vehicle circuit?'}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Confirm relay command" disabled={busy||blocked} onPress={()=>void submit()} style={styles.button}>{busy?<ActivityIndicator color="#fff"/>:<Text style={styles.buttonText}>Confirm {confirmation}</Text>}</Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setConfirmation(null)}><Text>Cancel</Text></Pressable>
   </View>:null}
   {message?<Text accessibilityRole="alert" style={styles.error}>{message}</Text>:null}
   {data?.history.length?<><Text style={styles.state}>Recent requests</Text>{data.history.map(command=><View key={command.id} style={styles.history}><Text>{command.action==='lock'?'Lock':'Unlock'} · {command.status.replace('_',' ')}</Text><Text style={styles.muted}>{new Date(command.createdAt).toLocaleString()}</Text><Text style={styles.muted}>{command.message}</Text></View>)}</>:null}
   <Pressable accessibilityRole="button" disabled={busy||current.isFetching} onPress={()=>void current.refetch()}><Text style={styles.link}>Refresh tracker information</Text></Pressable>
  </ScrollView>
 </View></View></Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'#0007',justifyContent:'center',padding:18},modal:{width:'100%',maxWidth:440,maxHeight:'85%',alignSelf:'center',backgroundColor:'#fff',borderRadius:10,overflow:'hidden'},header:{backgroundColor:'#ef0000',padding:13,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{color:'#fff',fontSize:20,fontWeight:'700'},close:{color:'#fff',fontSize:26,lineHeight:27},body:{padding:16,gap:11},number:{fontSize:18,fontWeight:'700',color:'#111'},muted:{fontSize:12,lineHeight:17,color:'#666'},state:{fontSize:15,fontWeight:'600',color:'#222'},error:{fontSize:13,lineHeight:19,color:'#9c3131'},button:{minHeight:44,backgroundColor:'#e50914',alignItems:'center',justifyContent:'center',padding:10,borderRadius:7},unlock:{backgroundColor:'#21884c'},disabled:{opacity:.4},buttonText:{color:'#fff',fontSize:15,fontWeight:'700'},confirm:{padding:12,borderWidth:1,borderColor:'#edb5b5',borderRadius:7,gap:12},history:{borderTopWidth:1,borderColor:'#eee',paddingTop:8,gap:3},link:{color:'#007c9e',paddingVertical:5}});
