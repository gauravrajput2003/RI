import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useLocalSearchParams,useRouter,useFocusEffect} from 'expo-router';
import {Feather,Ionicons,MaterialCommunityIcons} from '@expo/vector-icons';
import MapView,{Marker,Polyline,type Region,type MapHandle} from '../map/LeafletMap';
import {useHistory} from '../vehicles/queries';
import {hasPosition} from '../map/viewport';
import {calculateRouteStats,coveredDistances,formatDate,formatDateTime,formatDuration,formatTime,normalizeRoute,parseDateTime,routeTime,seekRecording} from './route';
import {animationTimeline,animationFrame} from './animation';
import {PlaybackMetricIcon,PlaybackOptionsIcon,type PlaybackMetric} from './PlaybackMetricIcon';
import {PlaybackStatsGrid} from './PlaybackStatsGrid';

function Metric({kind,label,value,small=false}:{kind:PlaybackMetric;label:string;value:string;small?:boolean}){
 return <View style={[s.metric,small?s.mini:null]}><View style={s.metricHeading}><PlaybackMetricIcon kind={kind}/><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={s.metricLabel}>{label}</Text></View><Text numberOfLines={1} style={s.metricValue}>{value}</Text></View>;
}
const speeds=[1,4,12,60];
export default function PlaybackView(){
 const router=useRouter(),params=useLocalSearchParams<{vehicleId?:string;vehicleNumber?:string}>();
 const vehicleId=params.vehicleId??'',vehicleNumber=params.vehicleNumber??'Vehicle',map=useRef<MapHandle>(null);
 const today=useMemo(()=>new Date(),[]);
 const [startDate,setStartDate]=useState(formatDate(today)),[startTime,setStartTime]=useState('00:00');
 const [dueDate,setDueDate]=useState(formatDate(today)),[dueTime,setDueTime]=useState('23:59');
 const [formOpen,setFormOpen]=useState(true),[formError,setFormError]=useState('');
 const [range,setRange]=useState<{from:Date;to:Date}|null>(null);
 const [picker,setPicker]=useState<{field:'start'|'due';mode:'date'|'time'}|null>(null);
 const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[rate,setRate]=useState(4);
 const [animated,setAnimated]=useState<ReturnType<typeof animationFrame>>(null);
 const cursor=useRef(0);
 const [speedOpen,setSpeedOpen]=useState(false),[optionsOpen,setOptionsOpen]=useState(false);
 const [showRoute,setShowRoute]=useState(true),[showHalts,setShowHalts]=useState(true),[follow,setFollow]=useState(false);
 const [trackWidth,setTrackWidth]=useState(1);
 useEffect(()=>{setRange(null);setIndex(0);setPlaying(false);setFormOpen(true);setFormError('');},[vehicleId]);
 useFocusEffect(useCallback(()=>{
  setFormOpen(true);setPlaying(false);
  return()=>{setPlaying(false);setFormOpen(false);setPicker(null);setSpeedOpen(false);setOptionsOpen(false);};
 },[vehicleId]));
 const query=useHistory(vehicleId,range?.from??null,range?.to??null,Boolean(range&&vehicleId));
 const points=useMemo(()=>normalizeRoute(query.data??[]),[query.data]);
 const timeline=useMemo(()=>animationTimeline(points),[points]);
 const stats=useMemo(()=>calculateRouteStats(points),[points]),distances=useMemo(()=>coveredDistances(points),[points]);
 const coordinates=useMemo(()=>points.map(point=>({latitude:point.latitude!,longitude:point.longitude!})),[points]);
 const initialRegion=useMemo<Region|undefined>(()=>points[0]?{latitude:points[0].latitude!,longitude:points[0].longitude!,latitudeDelta:.08,longitudeDelta:.08}:undefined,[points]);
 const fitRoute=useCallback(()=>{if(coordinates.length===1)map.current?.animateToRegion({...coordinates[0],latitudeDelta:.02,longitudeDelta:.02},250);else if(coordinates.length>1)map.current?.fitToCoordinates(coordinates,{edgePadding:{top:40,right:40,bottom:60,left:40},animated:false});},[coordinates]);
 useEffect(()=>{fitRoute();},[fitRoute]);
 useEffect(()=>{setIndex(0);setPlaying(false);setAnimated(null);cursor.current=0;},[points]);
 useEffect(()=>{
  if(!playing||points.length<2)return;
  let last=Date.now();
  const timer=setInterval(()=>{const now=Date.now();cursor.current+=(now-last)*rate;last=now;const frame=animationFrame(points,timeline,cursor.current);if(frame){setIndex(frame.index);setAnimated(frame);if(frame.index>=points.length-1)setPlaying(false);}},50);
  return()=>clearInterval(timer);
 },[playing,points,timeline,rate]);
 const current=points[index]??points.at(-1),first=coordinates[0],last=coordinates.length>1?coordinates.at(-1):undefined;
 const bike=animated&&animated.index===index?animated:current;
 const centerCurrent=useCallback(()=>{if(bike&&typeof bike.latitude==='number'&&typeof bike.longitude==='number'&&Number.isFinite(bike.latitude)&&Number.isFinite(bike.longitude))map.current?.animateToRegion({latitude:bike.latitude!,longitude:bike.longitude!,latitudeDelta:.02,longitudeDelta:.02},250);},[bike]);
 useEffect(()=>{if(follow)centerCurrent();},[follow,centerCurrent]);
 const fraction=points.length>1?(routeTime(points[index])-routeTime(points[0]))/Math.max(1,routeTime(points.at(-1)!)-routeTime(points[0])):0;
 const seekTo=(next:number)=>{setPlaying(false);setIndex(next);cursor.current=timeline[next]??0;setAnimated(null);};
 const seek=(x:number)=>seekTo(seekRecording(points,x/Math.max(1,trackWidth)));
 const back=()=>{setPlaying(false);setFormOpen(false);setPicker(null);setSpeedOpen(false);setOptionsOpen(false);router.replace({pathname:'/(app)/vehicles',params:{mode:'playback'}});};
 const cancel=()=>{setPicker(null);if(!range)back();else setFormOpen(false);};
 const confirm=()=>{
  const from=parseDateTime(startDate,startTime),to=parseDateTime(dueDate,dueTime);
  if(!from||!to){setFormError('Enter valid dates (DD/MM/YYYY) and times (HH:MM).');return;}
  // The selected due minute includes its final second, including 23:59:59.
  if(dueTime.trim().split(':').length===2)to.setSeconds(59,999);
  if(from>=to){setFormError('Start date/time must be before due date/time.');return;}
  if(!vehicleId){setFormError('Select a vehicle before loading playback.');return;}
  setFormError('');setPicker(null);setRange({from,to});setIndex(0);setPlaying(false);setFormOpen(false);
 };
 const toggle=()=>{if(points.length<2)return;if(!playing&&index>=points.length-1){setIndex(0);cursor.current=0;setAnimated(null);}setPlaying(value=>!value);};
 const stamp=current?formatDateTime(new Date(routeTime(current))):'--';
 const pickedValue=picker?parseDateTime(picker.field==='start'?startDate:dueDate,picker.field==='start'?startTime:dueTime)??today:today;
 return <SafeAreaView edges={['bottom']} style={s.page}>
  <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={s.back}><Feather name="arrow-left" size={24} color="#111"/></Pressable><View style={{flex:1}}><Text numberOfLines={1} style={s.title}>History · {vehicleNumber}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={s.subtitle}>{range?`${formatDateTime(range.from)} - ${formatDateTime(range.to)}`:`${startDate} 00:00:00 - ${dueDate} 23:59:59`}</Text></View></View>
  <View style={s.miniStrip}><Metric small kind="covered" label="KM Covered" value={current?`${distances[index]??0} KM`:'0 KM'}/><Metric small kind="gps" label="GPS Timestamp" value={current?formatDateTime(new Date(routeTime(current))).split(' ')[1]:'--'}/><Metric small kind="speed" label="Current Speed" value={current?.speed!=null?`${Math.round(current.speed)} KMH`:'-- KMH'}/></View>
  <View style={s.mapContainer}>
   {query.isLoading?<View style={s.empty}><ActivityIndicator color="#ef4444"/><Text>Loading route playback…</Text></View>:query.isError||!points.length?<View style={s.empty}><Text style={s.emptyText}>{!range?'Choose a date range to load recorded GPS.':query.isError?'Unable to load GPS history.':'No valid GPS recordings in this period.'}</Text>{range?<Pressable accessibilityRole="button" accessibilityLabel="Refresh GPS history" onPress={()=>void query.refetch()}><Text style={s.link}>Retry</Text></Pressable>:null}</View>:<MapView ref={map} style={s.map} initialRegion={initialRegion} onMapReady={fitRoute} onPanDrag={()=>setFollow(false)}>
    {showRoute&&coordinates.length>1?<Polyline coordinates={coordinates} strokeColor="#087ca7" strokeWidth={3.5}/>:null}
    {current&&hasPosition(current)?<Marker coordinate={{latitude:bike!.latitude!,longitude:bike!.longitude!}} rotation={animated?.heading??current.course??0} pinColor="#22c55e" iconType="bike" zIndexOffset={3000} title={`Playback ${stamp}`}><MaterialCommunityIcons name="motorbike" size={30} color="#087ca7"/></Marker>:null}
    {first?<Marker coordinate={first} title="Start" pinColor="#22c55e"><View><Text>S</Text></View></Marker>:null}
    {last?<Marker coordinate={last} title="End" pinColor="#ef4444"><View><Text>E</Text></View></Marker>:null}
    {showHalts?stats.halts.map(halt=><Marker key={halt.haltIndex} coordinate={halt} title={`Halt ${halt.haltIndex} (${formatDuration(halt.durationSeconds)})`} pinColor="#ef4444"><View><Text>{halt.haltIndex}</Text></View></Marker>):null}
   </MapView>}
   <View style={s.mapTools}>
    <Pressable accessibilityRole="button" accessibilityLabel="Centre on playback vehicle" accessibilityState={{selected:follow}} disabled={!current} onPress={()=>{setFollow(true);centerCurrent();}} style={s.mapButton}><MaterialCommunityIcons name="crosshairs-gps" size={23} color={follow?'#087ca7':'#64748b'}/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Show halt markers" accessibilityState={{selected:showHalts}} onPress={()=>setShowHalts(value=>!value)} style={s.mapButton}><MaterialCommunityIcons name="traffic-light" size={25} color={showHalts?'#364c56':'#aeb8bd'}/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Show route line" accessibilityState={{selected:showRoute}} onPress={()=>setShowRoute(value=>!value)} style={s.mapButton}><MaterialCommunityIcons name="map-outline" size={24} color={showRoute?'#087ca7':'#aeb8bd'}/></Pressable>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Change playback speed" onPress={()=>setSpeedOpen(true)} style={s.speedTag}><Text style={s.speedText}>{rate}x</Text></Pressable>
  </View>
  <View style={s.bottom}>
   <View style={s.transport}>
    <Pressable accessibilityRole="adjustable" accessibilityLabel="Playback timeline" accessibilityValue={{min:0,max:100,now:Math.round(fraction*100)}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>seekTo(Math.max(0,Math.min(points.length-1,index+(event.nativeEvent.actionName==='increment'?1:-1))))} disabled={!points.length} onLayout={event=>setTrackWidth(event.nativeEvent.layout.width)} onPress={event=>seek(event.nativeEvent.locationX)} onTouchMove={event=>seek(event.nativeEvent.locationX)} style={s.trackTouch}><View pointerEvents="none" style={s.track}><View style={[s.progress,{width:`${Math.min(100,fraction*100)}%`}]}/><View style={[s.thumb,{left:`${Math.min(96,fraction*100)}%`}]}/></View></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={playing?'Pause playback':'Start playback'} disabled={points.length<2} onPress={toggle} style={[s.play,{opacity:points.length<2?.45:1}]}><Ionicons name={playing?'pause':'play'} size={20} color="white"/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Filter date range" onPress={()=>{setFormError('');setFormOpen(true);}} style={s.control}><Ionicons name="funnel-outline" size={26} color="#364c56"/></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Playback options" onPress={()=>setOptionsOpen(true)} style={s.control}><PlaybackOptionsIcon/></Pressable>
   </View>
   <PlaybackStatsGrid stats={stats} hasRecordings={points.length>0}/>
  </View>
  <Modal visible={formOpen} transparent animationType="fade" onRequestClose={cancel}><KeyboardAvoidingView style={s.overlay} behavior={Platform.OS==='ios'?'padding':undefined}><View style={s.dialog}><View style={s.redHeader}><Text style={s.dialogPlate}>{vehicleNumber}</Text></View><ScrollView style={{flexGrow:0}} keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
   {(['start','due'] as const).map(field=><View key={field} style={{marginBottom:12}}><Text style={s.fieldLabel}>{field==='start'?'Start Date':'Due Date'}</Text><View style={s.inputRow}><TextInput accessibilityLabel={field==='start'?'Start date':'Due date'} value={field==='start'?startDate:dueDate} onChangeText={field==='start'?setStartDate:setDueDate} placeholder="DD/MM/YYYY" style={[s.input,{flex:1.2}]} keyboardType="numbers-and-punctuation"/><Pressable accessibilityRole="button" accessibilityLabel={`Choose ${field} date`} onPress={()=>setPicker({field,mode:'date'})} style={s.pickerButton}><Feather name="calendar" size={18} color="#64748b"/></Pressable><TextInput accessibilityLabel={field==='start'?'Start time':'Due time'} value={field==='start'?startTime:dueTime} onChangeText={field==='start'?setStartTime:setDueTime} placeholder="HH:MM" style={[s.input,{flex:.8}]} keyboardType="numbers-and-punctuation"/><Pressable accessibilityRole="button" accessibilityLabel={`Choose ${field} time`} onPress={()=>setPicker({field,mode:'time'})} style={s.pickerButton}><Feather name="clock" size={18} color="#64748b"/></Pressable></View></View>)}
   {picker?<View><DateTimePicker value={pickedValue} mode={picker.mode} is24Hour display={Platform.OS==='ios'?'spinner':'default'} onDismiss={()=>setPicker(null)} onValueChange={(_event,value)=>{void _event;if(Platform.OS!=='ios')setPicker(null);if(picker.mode==='date')(picker.field==='start'?setStartDate:setDueDate)(formatDate(value));else(picker.field==='start'?setStartTime:setDueTime)(formatTime(value).slice(0,5));}}/>{Platform.OS==='ios'?<Pressable onPress={()=>setPicker(null)}><Text style={s.link}>Done</Text></Pressable>:null}</View>:null}
   {formError?<Text accessibilityRole="alert" style={s.error}>{formError}</Text>:null}
   <View style={s.dialogActions}><Pressable accessibilityRole="button" accessibilityLabel="Confirm playback range" onPress={confirm} style={s.dialogAction}><Ionicons name="checkmark-circle-outline" size={32} color="#22c55e"/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Cancel playback dialog" onPress={cancel} style={s.dialogAction}><Ionicons name="close-circle-outline" size={32} color="#ef4444"/></Pressable></View>
  </ScrollView></View></KeyboardAvoidingView></Modal>
  <Modal visible={speedOpen} transparent animationType="fade" onRequestClose={()=>setSpeedOpen(false)}><View style={s.overlay}><View style={s.sheet}><Text style={s.sheetTitle}>Playback speed</Text>{speeds.map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:rate===value}} accessibilityLabel={`${value}x speed`} onPress={()=>{setRate(value);setSpeedOpen(false);}} style={s.sheetRow}><Text>{value}x</Text>{rate===value?<Feather name="check" size={20} color="#22c55e"/>:null}</Pressable>)}<Pressable accessibilityRole="button" onPress={()=>setSpeedOpen(false)} style={s.sheetRow}><Text>Close</Text></Pressable></View></View></Modal>
  <Modal visible={optionsOpen} transparent animationType="fade" onRequestClose={()=>setOptionsOpen(false)}><View style={s.overlay}><View style={s.sheet}><Text style={s.sheetTitle}>Playback options</Text><Text style={s.coverage}>Playback animation compresses long stops and missing-data waits. Recorded times and totals stay unchanged.</Text><Text style={s.coverage}>Recorded GPS: {points.length?`${formatDateTime(new Date(routeTime(points[0])))} – ${formatDateTime(new Date(routeTime(points.at(-1)!)))}`:'No recordings'}</Text>
   {current?.address?<Text style={s.coverage}>{current.address}{current.address_attribution?` · ${current.address_attribution}`:''}</Text>:null}
   <Pressable accessibilityRole="button" accessibilityLabel="Next recording" disabled={!points.length} onPress={()=>{seekTo(Math.min(index+1,points.length-1));setOptionsOpen(false);}} style={s.sheetRow}><Text>Next recording</Text><Feather name="skip-forward" size={20} color="#087ca7"/></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Fit recorded route" disabled={!points.length} onPress={()=>{setFollow(false);fitRoute();setOptionsOpen(false);}} style={s.sheetRow}><Text>Fit recorded route</Text><Feather name="maximize" size={20} color="#087ca7"/></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Refresh GPS history" disabled={query.isFetching||!range} onPress={()=>{setPlaying(false);void query.refetch();setOptionsOpen(false);}} style={s.sheetRow}><Text>Refresh GPS history</Text><Feather name="refresh-cw" size={20} color="#087ca7"/></Pressable>
   {points.length>=50000?<Text style={s.coverage}>Recording limit reached. Select a shorter date range.</Text>:null}
   <Pressable onPress={()=>setOptionsOpen(false)} style={s.sheetRow}><Text>Close</Text></Pressable>
  </View></View></Modal>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#fff'},header:{minHeight:50,flexDirection:'row',alignItems:'center',paddingHorizontal:8,borderBottomWidth:1,borderColor:'#e2e8f0'},back:{padding:8,marginRight:6},title:{fontSize:17,fontWeight:'700',color:'#111'},subtitle:{fontSize:10,color:'#111',marginTop:2},miniStrip:{height:49,flexDirection:'row',borderBottomWidth:1,borderColor:'#ddd'},metric:{flex:1,minWidth:0,justifyContent:'center',alignItems:'center',paddingHorizontal:3,paddingVertical:4,borderRightWidth:1,borderColor:'#e2e8f0'},mini:{paddingVertical:2},metricHeading:{flexDirection:'row',alignItems:'center',gap:3,width:'100%',justifyContent:'center'},metricLabel:{fontSize:10,fontWeight:'700',color:'#111',flexShrink:1},metricValue:{fontSize:11,fontWeight:'600',color:'#111',marginTop:1},mapContainer:{flex:1,minHeight:140,position:'relative'},map:{position:'absolute',top:0,right:0,bottom:0,left:0},empty:{flex:1,justifyContent:'center',alignItems:'center',gap:12,padding:30,backgroundColor:'#edf2f4'},emptyText:{color:'#64748b',textAlign:'center'},link:{color:'#087ca7',padding:8,fontWeight:'600'},mapTools:{position:'absolute',right:8,top:10,gap:5},mapButton:{width:36,height:36,borderRadius:18,backgroundColor:'rgba(255,255,255,.94)',alignItems:'center',justifyContent:'center',elevation:2},speedTag:{position:'absolute',bottom:12,right:10,width:38,height:38,borderRadius:19,backgroundColor:'#ed0505',alignItems:'center',justifyContent:'center',elevation:4},speedText:{fontSize:14,fontWeight:'800',color:'white'},bottom:{backgroundColor:'white',borderTopWidth:1,borderColor:'#ddd'},transport:{height:43,flexDirection:'row',alignItems:'center',paddingHorizontal:8,gap:5},trackTouch:{flex:1,height:40,justifyContent:'center',paddingHorizontal:3},track:{height:3,backgroundColor:'#e5e7eb',borderRadius:2},progress:{height:3,backgroundColor:'#ef0000'},thumb:{position:'absolute',top:-4,width:11,height:11,borderRadius:6,backgroundColor:'#ef0000'},play:{width:30,height:30,borderRadius:15,backgroundColor:'#78c800',alignItems:'center',justifyContent:'center'},control:{width:34,height:40,alignItems:'center',justifyContent:'center'},overlay:{flex:1,backgroundColor:'rgba(0,0,0,.55)',justifyContent:'center',alignItems:'center',padding:20},dialog:{width:'100%',maxWidth:360,maxHeight:'90%',backgroundColor:'white',borderRadius:3,overflow:'hidden'},redHeader:{height:48,backgroundColor:'#ed0505',alignItems:'center',justifyContent:'center'},dialogPlate:{color:'white',fontSize:15,fontWeight:'700'},form:{paddingHorizontal:16,paddingTop:16},fieldLabel:{color:'#ef9a00',fontSize:14,fontStyle:'italic',fontWeight:'700',marginBottom:6},inputRow:{flexDirection:'row',alignItems:'center',gap:4},input:{fontSize:15,color:'#111',borderBottomWidth:1,borderColor:'#555',paddingVertical:6,minWidth:0},pickerButton:{padding:3},dialogActions:{borderTopWidth:1,borderColor:'#ddd',marginTop:4,paddingVertical:8,flexDirection:'row',justifyContent:'center',gap:16},dialogAction:{width:44,height:44,justifyContent:'center',alignItems:'center'},error:{fontSize:12,color:'#b91c1c',paddingVertical:8},sheet:{width:'100%',maxWidth:360,backgroundColor:'white',borderRadius:12,padding:16},sheetTitle:{fontSize:17,fontWeight:'700',marginBottom:10},sheetRow:{minHeight:46,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderColor:'#eee'},coverage:{fontSize:12,color:'#64748b',paddingVertical:6},
});
