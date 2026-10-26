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
 const [confirmation,setConfirmation]=useState<RelayAction|'test-restore'|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[testProfile,setTestProfile]=useState('');
 const [submittedId,setSubmittedId]=useState<string|null>(null);
 const submitting=useRef(false),requestKey=useRef<string|null>(null),testConnection=useRef<string|null>(null),data=current.data;
 const submittedResult=data?.history.find(command=>command.id===submittedId);
 // Background polling must not disable a usable cached screen every second.
 // Current server capability flags still govern each action; the API rechecks at dispatch.
 const blocked=busy||online===false||current.isLoading||current.isError||!data||!caps.editVehicle||config.demoMode;
 const eligible=confirmation==='test-restore'?Boolean(data?.canTestRestore&&data.testConnectionId&&data.testRestoreProfiles?.some(profile=>profile.name===testProfile)):confirmation==='lock'?Boolean(data?.canLock):Boolean(data?.canUnlock);
 const connectionChanged=Boolean(confirmation&&testConnection.current&&testConnection.current!==data?.testConnectionId);
 const confirmationBlocked=blocked||!eligible||connectionChanged;
 const confirmationReason=connectionChanged?'Tracker connection changed. Cancel and confirm a new request.':online===false?'Phone is offline. No command has been sent.':current.isError?'Cannot verify relay information. Refresh before confirming.':!eligible?(data?.message??'Relay is currently unavailable. No command has been sent.'):null;
 const choose=(action:RelayAction)=>{if(blocked||!(action==='lock'?data?.canLock:data?.canUnlock))return;setMessage('');setSubmittedId(null);requestKey.current=data!.requestKey;testConnection.current=data?.testConnectionId??null;setConfirmation(action);};
 const chooseTest=()=>{if(blocked||!data?.canTestRestore||!data.testConnectionId||!data.testRestoreProfiles?.some(profile=>profile.name===testProfile))return;setMessage('');setSubmittedId(null);requestKey.current=data.requestKey;testConnection.current=data.testConnectionId;setConfirmation('test-restore');};
 const submit=async()=>{
  if(!confirmation||submitting.current||busy)return;
  if(connectionChanged){setMessage('Tracker reconnected. Refresh and confirm a new request.');setConfirmation(null);return;}
  if(confirmationBlocked){setMessage(confirmationReason??'Relay is not available. No command has been sent.');return;}
  submitting.current=true;setBusy(true);
  try{if(!requestKey.current)throw new Error('Refresh relay information before submitting.');const result=confirmation==='test-restore'?await sendRelayRequest(vehicle.id,'unlock',requestKey.current,{profile:testProfile,connectionId:testConnection.current!}):await sendRelayRequest(vehicle.id,confirmation,requestKey.current);setSubmittedId(result?.id??null);setMessage('Request submitted. Result not confirmed. Watch Recent requests for the tracker reply.');setConfirmation(null);}
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
   {data?.testRestoreProfiles?.length?<View style={styles.confirm}><Text style={styles.state}>Test Restore</Text><Text style={styles.muted}>Select one configured profile. This test only restores the circuit; it cannot lock or cut the vehicle. Ignition may be ON. Restore needs a live tracker connection; fresh GPS is not required.</Text>{data.testRestoreProfiles.map(profile=><Pressable key={profile.name} accessibilityRole="button" accessibilityLabel={`Test profile ${profile.name}`} disabled={busy||Boolean(confirmation)} onPress={()=>setTestProfile(profile.name)} style={[styles.history,testProfile===profile.name&&styles.selected]}><Text>{testProfile===profile.name?'✓ ':''}{profile.name}</Text><Text style={styles.muted}>{profile.languageField?'Concox format':'Client PDF format'} · {profile.hasPassword?'Configured password':'Without password'}</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="Test Restore" disabled={blocked||!data.canTestRestore||!testProfile} onPress={chooseTest} style={[styles.button,styles.unlock,(blocked||!data.canTestRestore||!testProfile)&&styles.disabled]}><Text style={styles.buttonText}>Test Restore</Text></Pressable></View>:null}
   {confirmation?<View style={styles.confirm}>
    <Text>{confirmation==='test-restore'?`Test restore for ${data?.vehicleNumber??vehicle.vehicle_number} using ${testProfile}? This restores the circuit; ignition may be ON.`:`Are you sure you want to ${confirmation} vehicle ${data?.vehicleNumber??vehicle.vehicle_number}${confirmation==='lock'?'? The tracker may interrupt the configured vehicle circuit.':' and restore the configured vehicle circuit?'}`}</Text>
    {confirmationReason?<Text accessibilityRole="alert" style={styles.error}>{confirmationReason}</Text>:null}
    <Pressable accessibilityRole="button" accessibilityLabel="Confirm relay command" disabled={confirmationBlocked} onPress={()=>void submit()} style={[styles.button,confirmationBlocked&&styles.disabled]}>{busy?<ActivityIndicator color="#fff"/>:<Text style={styles.buttonText}>Confirm {confirmation==='test-restore'?'restore test':confirmation}</Text>}</Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setConfirmation(null)}><Text>Cancel</Text></Pressable>
   </View>:null}
   {message&&(!submittedResult||['pending','sent'].includes(submittedResult.status))?<Text accessibilityRole="alert" style={styles.error}>{message}</Text>:null}
   {data?.history.length?<><Text style={styles.state}>Recent requests</Text>{data.history.map(command=><View key={command.id} style={styles.history}><Text>{command.action==='lock'?'Lock':'Unlock'} · {command.status==='succeeded'?'Tracker confirmed':command.status.replace('_',' ')}</Text><Text style={styles.muted}>{new Date(command.createdAt).toLocaleString()}</Text>{command.probeProfile?<Text style={styles.muted}>Test profile: {command.probeProfile}</Text>:null}<Text style={styles.muted}>{command.message}</Text>{command.reply?<Text>Tracker reply: {command.reply}</Text>:null}</View>)}</>:null}
   <Pressable accessibilityRole="button" disabled={busy||current.isFetching} onPress={()=>void current.refetch()}><Text style={styles.link}>Refresh tracker information</Text></Pressable>
  </ScrollView>
 </View></View></Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'#0007',justifyContent:'center',padding:18},modal:{width:'100%',maxWidth:440,maxHeight:'85%',alignSelf:'center',backgroundColor:'#fff',borderRadius:10,overflow:'hidden'},header:{backgroundColor:'#ef0000',padding:13,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{color:'#fff',fontSize:20,fontWeight:'700'},close:{color:'#fff',fontSize:26,lineHeight:27},body:{padding:16,gap:11},number:{fontSize:18,fontWeight:'700',color:'#111'},muted:{fontSize:12,lineHeight:17,color:'#666'},state:{fontSize:15,fontWeight:'600',color:'#222'},error:{fontSize:13,lineHeight:19,color:'#9c3131'},button:{minHeight:44,backgroundColor:'#e50914',alignItems:'center',justifyContent:'center',padding:10,borderRadius:7},unlock:{backgroundColor:'#21884c'},disabled:{opacity:.4},buttonText:{color:'#fff',fontSize:15,fontWeight:'700'},confirm:{padding:12,borderWidth:1,borderColor:'#edb5b5',borderRadius:7,gap:12},selected:{backgroundColor:'#e6f5ec',padding:8},history:{borderTopWidth:1,borderColor:'#eee',paddingTop:8,gap:3},link:{color:'#007c9e',paddingVertical:5}});
