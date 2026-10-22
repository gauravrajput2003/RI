import {memo,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Switch,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Feather,MaterialCommunityIcons} from '@expo/vector-icons';
import {router,useFocusEffect} from 'expo-router';
import {NearbySheet} from '../../components/fleet/NearbySheet';
import {StreetViewSheet,type StreetVehicle} from '../../components/fleet/StreetViewSheet';
import {ShareSheet} from '../../components/fleet/ShareSheet';
import {VehicleMarker} from '../../components/VehicleMarker';
import MapView,{Polyline,type Region,type MapHandle} from './LeafletMap';
import {LiveMapPanel} from './LiveMapPanel';
import {useLiveMapData} from './live-data';
import {openVehicleDirections,validDestination} from './navigation';
import {STATUS_COLORS,getVehicleStatus} from '../../utils/vehicleIcons';
import {stateForVehicle,currentSpeedForVehicle} from '../vehicles/status';
import {useLatestLocation,useVehicles} from '../vehicles/queries';
import {useLiveVehicleStore} from '../../store/liveVehicleStore';
import {useRuntimeStore} from '../../store/runtimeStore';
import {useVehicleStore} from '../../store/vehicleStore';
import {useAccount,mobileMessage} from '../../services/api/mobile';
import {capabilities} from '../account/capabilities';
import {hasPosition} from './viewport';
import type {Vehicle} from '../../types/models';

const LiveVehicleMarker=memo(function LiveVehicleMarker({id,vehicle,selected}:{id:string;vehicle?:Vehicle;selected:boolean}){
 const point=useLiveVehicleStore(state=>state.byVehicleId[id]);
 const select=useCallback(()=>useVehicleStore.getState().setSelected(id),[id]);
 if(!hasPosition(point)||!validDestination(point))return null;
 const state=vehicle?stateForVehicle(vehicle,point):point.state;
 return <VehicleMarker vehicle={{id,vehicle_number:vehicle?.vehicle_number,vehicle_type:vehicle?.vehicle_type??'car',latitude:point.latitude,longitude:point.longitude,course:point.course,state,speed:state==='OFFLINE'?null:vehicle?currentSpeedForVehicle(vehicle,point):point.current_speed,ignition:point.ignition,lastSeen:point.last_seen_at??vehicle?.last_seen_at??point.server_received_at}} onPress={select} selected={selected}/>;
});
const stamp=(value?:string|null)=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value)).replaceAll('/','-').replace(',',''):'GPS timestamp unavailable';
export default function LiveMap(){
 const [focused,setFocused]=useState(false),[expanded,setExpanded]=useState(false);
 useFocusEffect(useCallback(()=>{setExpanded(false);setFocused(true);return()=>setFocused(false);},[]));
 const map=useRef<MapHandle>(null),vehicles=useVehicles(),account=useAccount(),caps=capabilities(account.data);
 const online=useRuntimeStore(state=>state.online);
 const selected=useVehicleStore(state=>state.selectedVehicleId),follow=useVehicleStore(state=>state.followSelected);
 const [nearbyVehicle,setNearbyVehicle]=useState<StreetVehicle|null>(null),[streetVehicle,setStreetVehicle]=useState<StreetVehicle|null>(null),[share,setShare]=useState(false),[settings,setSettings]=useState(false),[todayPath,setTodayPath]=useState(false),[satellite,setSatellite]=useState(false),[message,setMessage]=useState(''),[height,setHeight]=useState(640),[panelHeight,setPanelHeight]=useState(110);
 const navigating=useRef(false),[opening,setOpening]=useState(false),regionRef=useRef<Region|undefined>(undefined);
 const id=selected??vehicles.data?.data[0]?.id??'',latest=useLatestLocation(id,focused);
 const point=useLiveVehicleStore(state=>id?state.byVehicleId[id]:undefined);
 const metrics=useLiveMapData(id,`${point?.server_received_at??''}:${latest.dataUpdatedAt??''}`,focused);
 const records=useMemo(()=>new Map(vehicles.data?.data.map(vehicle=>[vehicle.id,vehicle])??[]),[vehicles.data]);
 const vehicle=records.get(id),number=vehicle?.vehicle_number??id;
 const status=getVehicleStatus({state:vehicle?stateForVehicle(vehicle,point):point?.state,lastSeen:point?.last_seen_at??vehicle?.last_seen_at??point?.server_received_at,speed:vehicle?currentSpeedForVehicle(vehicle,point):point?.current_speed,ignition:point?.ignition});
 const speed=status==='unreachable'?null:vehicle?currentSpeedForVehicle(vehicle,point)??null:point?.current_speed??null;
 const usable=hasPosition(point)&&validDestination(point),initial=useRef<Region|undefined>(undefined);
 if(!initial.current&&usable)initial.current={latitude:point.latitude,longitude:point.longitude,latitudeDelta:.008,longitudeDelta:.008};
 useEffect(()=>{if(!selected&&id)useVehicleStore.getState().setSelected(id);},[selected,id]);
 const recenter=useCallback(()=>{
  if(!validDestination(point)){setMessage('This vehicle has no valid GPS position to recenter.');return;}
  map.current?.animateToRegion({latitude:point.latitude,longitude:point.longitude,latitudeDelta:regionRef.current?.latitudeDelta??.008,longitudeDelta:regionRef.current?.longitudeDelta??.008},0);
 },[point?.latitude,point?.longitude]);
 useEffect(()=>{if(focused&&follow&&usable)recenter();},[id,follow,focused,point?.latitude,point?.longitude,recenter,usable,panelHeight]);
 const moved=useCallback((next:Region)=>{regionRef.current=next},[]);
 const pan=useCallback(()=>useVehicleStore.getState().setFollow(false),[]);
 const directions=async()=>{if(navigating.current)return;navigating.current=true;setOpening(true);setMessage('');try{await openVehicleDirections(point)}catch(cause){setMessage(mobileMessage(cause))}finally{navigating.current=false;setOpening(false)}};
 const compact=height<600,small=height<490;
 const information=<LiveMapPanel data={metrics.data} address={point?.address} attribution={point?.address_attribution} speed={speed} status={status} compact={compact} expanded={expanded} onExpandedChange={setExpanded} detailsMaxHeight={small?Math.max(75,Math.floor((height-61)*.7)-120):undefined} canShare={caps.share} canNotify={caps.notifications} onPlayback={()=>router.push({pathname:'/(app)/playback',params:{vehicleId:id,vehicleNumber:vehicle?.vehicle_number??''}})} onShare={()=>setShare(true)} onNotification={()=>router.push({pathname:'/(app)/notifications',params:{vehicleId:id}})}/>;
 return <SafeAreaView style={styles.page} edges={['bottom']}><View style={styles.page} onLayout={event=>setHeight(event.nativeEvent.layout.height)}>
 <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back from Live Map" onPress={()=>router.replace('/(app)')} style={styles.back}><Feather name="arrow-left" size={22} color="#111"/></Pressable><View style={styles.heading}><Text numberOfLines={1} style={styles.title}>{number?`${number} - Livemap`:'Livemap'}</Text><Text style={styles.timestamp}>{stamp(usable?(point?.tracker_timestamp??point?.server_received_at):null)}</Text><Text style={[styles.status,{color:STATUS_COLORS[status].dark}]}>{status==='unreachable'?'Unreachable · last-known GPS':status==='unknown'?'Status unavailable':status.charAt(0).toUpperCase()+status.slice(1)}{online===false?' · Offline cache':''}{metrics.isLoading?' · Loading metrics…':''}</Text></View></View>
 <View style={styles.mapArea}>{initial.current?<MapView ref={map} style={styles.map} initialRegion={initial.current} bottomInset={panelHeight} mapType={satellite?'satellite':'street'} onMapReady={()=>{if(follow)recenter()}} onRegionChangeComplete={moved} onPanDrag={pan}>{id&&usable?<LiveVehicleMarker key={id} id={id} vehicle={vehicle} selected/>:null}{todayPath&&metrics.data?.path.map((path,index)=><Polyline key={`${id}-path-${index}`} coordinates={path} strokeColor={STATUS_COLORS[status].main} strokeWidth={4}/>)}</MapView>:<View style={styles.noMap}>{latest.isLoading||vehicles.isLoading?<ActivityIndicator/>:null}<Text>{latest.isError?'Unable to retrieve this vehicle’s GPS position.':latest.isLoading||vehicles.isLoading?'Loading vehicle GPS…':'No valid last-known GPS position for this vehicle.'}</Text>{latest.isError?<Pressable onPress={()=>void latest.refetch()}><Text>Retry GPS</Text></Pressable>:null}</View>}
 <View style={styles.compass} accessibilityLabel="Map north up"><MaterialCommunityIcons name="compass" size={27} color="#e64b41"/></View>
 <View style={styles.controls}><Pressable accessibilityRole="button" accessibilityLabel="Recenter selected vehicle" style={styles.control} onPress={()=>{recenter();if(usable)useVehicleStore.getState().setFollow(true)}}><MaterialCommunityIcons name="crosshairs-gps" size={24} color="#666"/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Navigate to selected vehicle in Google Maps" disabled={opening} style={styles.control} onPress={()=>void directions()}><MaterialCommunityIcons name="navigation" size={24} color="#111"/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Live Map settings" style={styles.control} onPress={()=>setSettings(!settings)}><Feather name={settings?'x':'settings'} size={24} color="#555"/></Pressable></View>
 {settings?<View style={styles.settings}>{[['Traffic',false],['Satellite',satellite],['Today Path',todayPath],['Auto Center',follow]].map(([label,value])=><View key={String(label)} style={styles.settingRow}><Text style={styles.settingLabel}>{label}</Text><Switch accessibilityLabel={label==='Auto Center'?'Toggle follow selected vehicle':String(label)} disabled={label==='Traffic'} value={Boolean(value)} trackColor={{true:'#4caf50'}} onValueChange={next=>{if(label==='Satellite')setSatellite(next);if(label==='Today Path')setTodayPath(next);if(label==='Auto Center')useVehicleStore.getState().setFollow(next)}}/></View>)}<Text style={styles.hint}>Traffic is unavailable with the current map provider.</Text><Text style={styles.hint}>Today Path uses recorded fixes and the current status color.</Text>{todayPath&&metrics.data?.path.length===0&&!metrics.data.pathUnavailable?<Text style={styles.hint}>No recorded route for today.</Text>:null}{vehicle?<View style={styles.extraActions}><Pressable accessibilityLabel="Selected vehicle Nearby" onPress={()=>{setNearbyVehicle(vehicle);setSettings(false)}}><Text style={styles.link}>Nearby</Text></Pressable><Pressable accessibilityLabel="Selected vehicle Street View" onPress={()=>{setStreetVehicle(vehicle);setSettings(false)}}><Text style={styles.link}>Street View</Text></Pressable></View>:null}</View>:null}
 {message||metrics.isError||todayPath&&metrics.data?.pathUnavailable?<Pressable accessibilityLabel="Dismiss Live Map message" style={styles.message} onPress={()=>setMessage('')}><Text style={styles.messageText}>{message||(metrics.isError?'Unable to load live metrics. Retry to refresh.':metrics.data?.pathUnavailable)}</Text>{metrics.isError?<Pressable accessibilityLabel="Retry live metrics" onPress={()=>void metrics.refetch()}><Text style={styles.link}>Retry metrics</Text></Pressable>:null}</Pressable>:null}
 <View style={styles.panel} onLayout={event=>setPanelHeight(event.nativeEvent.layout.height)}>{information}</View>
 </View><NearbySheet vehicle={nearbyVehicle} onClose={()=>setNearbyVehicle(null)}/><StreetViewSheet vehicle={streetVehicle} onClose={()=>setStreetVehicle(null)}/><ShareSheet vehicleNumber={share?(vehicle?.vehicle_number??null):null} vehicleId={id} onClose={()=>setShare(false)}/>
 </View></SafeAreaView>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#fff'},header:{minHeight:61,flexDirection:'row',alignItems:'center',backgroundColor:'#fff'},back:{width:40,height:54,alignItems:'center',justifyContent:'center'},heading:{flex:1,paddingVertical:5},title:{fontSize:16,fontWeight:'600',color:'#111'},timestamp:{fontSize:10,color:'#222'},status:{fontSize:10},mapArea:{flex:1},map:{flex:1},noMap:{flex:1,alignItems:'center',justifyContent:'flex-start',paddingTop:60,paddingHorizontal:24,gap:8,backgroundColor:'#f3f4f6'},panel:{position:'absolute',bottom:0,left:0,right:0},controls:{position:'absolute',zIndex:9,top:12,right:9,gap:9},control:{width:34,height:34,borderRadius:18,backgroundColor:'#fffffff2',alignItems:'center',justifyContent:'center',elevation:2},compass:{position:'absolute',top:12,left:9,width:32,height:32,borderRadius:16,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},settings:{position:'absolute',zIndex:10,top:136,right:8,width:205,padding:10,borderRadius:7,backgroundColor:'#fff',elevation:6,shadowOpacity:.2,shadowRadius:4},settingRow:{height:33,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},settingLabel:{fontSize:12,color:'#333'},hint:{fontSize:10,lineHeight:14,color:'#666',paddingTop:5},extraActions:{flexDirection:'row',justifyContent:'space-between',paddingTop:8},link:{color:'#007c9e',fontSize:12,paddingVertical:4},message:{position:'absolute',zIndex:11,top:6,left:47,right:53,padding:7,borderRadius:5,backgroundColor:'#fff7ed'},messageText:{fontSize:11,color:'#9a3412'}});
