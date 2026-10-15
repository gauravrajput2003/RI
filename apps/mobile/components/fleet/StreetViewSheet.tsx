import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {Sheet} from './Sheet';
import {loadStreetPosition,openGoogleLocation,type StreetPosition} from '../../features/street-view/service';
import {mobileMessage} from '../../services/api/mobile';
import {useAuthStore} from '../../store/authStore';

export type StreetVehicle={id:string;vehicle_number:string};
export function StreetViewSheet({vehicle,onClose}:{vehicle:StreetVehicle|null;onClose():void}){
 const id=vehicle?.id;const {height}=useWindowDimensions();
 const [position,setPosition]=useState<StreetPosition|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const operation=useRef({version:0,busy:false,controller:null as AbortController|null});
 const selection=useRef(id);selection.current=id;
 const run=useCallback(async(mode?:'street'|'map')=>{
  if(!id||operation.current.busy)return;
  const current=operation.current,version=++current.version,controller=new AbortController(),session=useAuthStore.getState().sessionKey;
  current.busy=true;current.controller=controller;setLoading(true);setError('');setNotice('');
  const wasStale=position?.stale===true;setPosition(null);
  const active=()=>current.version===version&&!controller.signal.aborted&&selection.current===id&&useAuthStore.getState().sessionKey===session;
  try{
   const next=await loadStreetPosition(id,controller.signal);if(!active())return;setPosition(next);
   if(mode){
    if(next.stale&&!wasStale){setNotice('This is an old recorded GPS position. Review its timestamp, then tap again to open it.');return;}
    const opened=await openGoogleLocation(next,mode);if(!active())return;
    setNotice(opened==='street'?'Google Maps opened. If Google reports no imagery here, return and choose “View normal map”.':mode==='street'?'Street View could not be opened; the same GPS position was opened on a normal map.':'The same recorded GPS position was opened on a normal map.');
   }
  }catch(cause){if(active())setError(mobileMessage(cause));}
  finally{if(current.version===version){current.busy=false;setLoading(false);}}
 },[id,position?.stale]);
 // Fetch once on selection, not whenever the position preview changes.
 const refresh=useRef(run);refresh.current=run;
 useEffect(()=>{
  setPosition(null);setError('');setNotice('');operation.current.busy=false;
  if(id)void refresh.current();
  return()=>{operation.current.version++;operation.current.controller?.abort();operation.current.busy=false;};
 },[id]);
 if(!vehicle)return null;
 return <Sheet visible onClose={onClose} title={`Street View · ${vehicle.vehicle_number}`}><ScrollView style={{maxHeight:Math.max(180,height*.72)}} contentContainerStyle={styles.body}>
  {loading?<View style={styles.loading}><ActivityIndicator color="#087ca7"/><Text>Loading this vehicle’s latest GPS…</Text></View>:null}
  {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
  {position?<View style={styles.preview}><Text style={styles.coordinates}>{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</Text><Text>Recorded GPS: {position.recordedAt?new Date(position.recordedAt).toLocaleString():'Time unavailable'}</Text>
   {position.stale?<Text style={styles.warning}>{position.timeUncertain?'GPS time is unavailable or ahead of the phone clock. This is a recorded position; freshness cannot be confirmed.':'Last recorded position is over 10 minutes old. This is not a live position.'}</Text>:null}
  </View>:null}
  <Text style={styles.hint}>Opens Google Maps using this vehicle’s GPS. Google may show the nearest available panorama. Street View is historical imagery, not a live camera.</Text>
  <Text style={styles.hint}>Imagery may be unavailable at this location. If Google reports no imagery, use “View normal map” below. RI cannot check coverage through an external Maps URL.</Text>
  {notice?<Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>:null}
  <Pressable accessibilityRole="button" accessibilityLabel="Open vehicle Street View" disabled={loading||!position} onPress={()=>void run('street')} style={[styles.primary,loading||!position?styles.disabled:null]}><Text style={styles.primaryText}>{position?.stale?'Open recorded Street View':'Open Street View'}</Text></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="View vehicle on normal map" disabled={loading||!position} onPress={()=>void run('map')} style={[styles.secondary,loading||!position?styles.disabled:null]}><Text style={styles.secondaryText}>View normal map</Text></Pressable>
  <View style={styles.footer}><Pressable accessibilityRole="button" accessibilityLabel="Refresh Street View GPS" disabled={loading} onPress={()=>void run()} style={styles.footerButton}><Text style={styles.secondaryText}>Retry GPS</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Close Street View" onPress={onClose} style={styles.footerButton}><Text>Close</Text></Pressable></View>
 </ScrollView></Sheet>;
}
const styles=StyleSheet.create({body:{gap:10,paddingVertical:8},loading:{flexDirection:'row',alignItems:'center',gap:10,padding:8},preview:{gap:5,padding:12,backgroundColor:'#f1f5f9',borderRadius:8},coordinates:{fontWeight:'700',color:'#1e293b'},warning:{color:'#92400e',lineHeight:19},hint:{fontSize:12,lineHeight:18,color:'#64748b'},notice:{fontSize:13,lineHeight:19,color:'#075985'},error:{color:'#b91c1c',lineHeight:20},primary:{padding:13,borderRadius:9,backgroundColor:'#087ca7',alignItems:'center'},primaryText:{color:'white',fontWeight:'700'},secondary:{padding:12,borderRadius:9,borderWidth:1,borderColor:'#cbd5e1',alignItems:'center'},secondaryText:{color:'#087ca7',fontWeight:'600'},disabled:{opacity:.45},footer:{flexDirection:'row',justifyContent:'space-between'},footerButton:{padding:10}});
