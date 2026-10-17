import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,FlatList,Linking,PanResponder,Pressable,StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {FontAwesome6} from '@expo/vector-icons';
import MapView,{Marker,type MapHandle} from '../map/LeafletMap';
import {NearbySheet} from '../../components/fleet/NearbySheet';
import {mobileMessage} from '../../services/api/mobile';
import {useAuthStore} from '../../store/authStore';
import {loadNearby,loadNearbyDetails,nearbyCategories,nearbyCategoryIds,placeAction,type NearbyCategory,type NearbyPlace,type NearbyResult} from './service';

export function NearbyView({vehicleId,vehicleNumber,category:rawCategory}:{vehicleId:string;vehicleNumber:string;category:string}){
 const category=nearbyCategoryIds.includes(rawCategory as NearbyCategory)?rawCategory as NearbyCategory:null;
 const session=useAuthStore(state=>state.sessionKey),{height}=useWindowDimensions();
 const [data,setData]=useState<NearbyResult|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[actionError,setActionError]=useState('');
 const [radius,setRadius]=useState(5000),[retry,setRetry]=useState(0),[search,setSearch]=useState(''),[alphabetical,setAlphabetical]=useState(false),[expanded,setExpanded]=useState(false),[categoriesOpen,setCategoriesOpen]=useState(false);
 const [selected,setSelected]=useState<string|null>(null),[details,setDetails]=useState<Record<string,NearbyPlace>>({}),[detailBusy,setDetailBusy]=useState<string|null>(null),[actionBusy,setActionBusy]=useState(false);
 const map=useRef<MapHandle>(null),list=useRef<FlatList<NearbyPlace>>(null),detailRequest=useRef<AbortController|null>(null),detailLock=useRef(false),active=useRef(false),actionLock=useRef(false);
 useFocusEffect(useCallback(()=>{
  const controller=new AbortController();active.current=true;detailLock.current=false;setData(null);setError('');setActionError('');setDetails({});setSelected(null);setSearch('');setDetailBusy(null);detailRequest.current?.abort();
  if(!vehicleId||!category){setError('Select a vehicle and a valid Nearby category.');setLoading(false);return()=>{active.current=false;controller.abort();};}
  setLoading(true);
  void loadNearby(vehicleId,category,radius,controller.signal).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(cause=>{if(!controller.signal.aborted)setError(mobileMessage(cause));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>{active.current=false;controller.abort();detailRequest.current?.abort();};
 },[vehicleId,category,radius,retry,session]));
 const places=useMemo(()=>{
  const rows=(data?.places??[]).filter(place=>`${place.name} ${place.address??''}`.toLowerCase().includes(search.toLowerCase()));
  return [...rows].sort(alphabetical?(a,b)=>a.name.localeCompare(b.name):(a,b)=>a.distanceMeters-b.distanceMeters);
 },[data,search,alphabetical]);
 const fit=useCallback(()=>{if(data)map.current?.fitToCoordinates([data.center,...places]);},[data,places]);
 useEffect(()=>{fit();},[fit]);
 const pan=useMemo(()=>PanResponder.create({onMoveShouldSetPanResponder:(_event,gesture)=>Math.abs(gesture.dy)>8,onPanResponderRelease:(_event,gesture)=>{if(gesture.dy<-20)setExpanded(true);else if(gesture.dy>20)setExpanded(false);}}),[]);
 const choose=(place:NearbyPlace)=>{
  setSelected(place.id);setActionError('');map.current?.animateToRegion({...place,latitudeDelta:.01,longitudeDelta:.01},250);
  const index=places.findIndex(item=>item.id===place.id);if(index>=0)list.current?.scrollToIndex({index,animated:true});
 };
 const detail=async(place:NearbyPlace)=>{
  if(!category||detailLock.current)return;detailLock.current=true;
  detailRequest.current?.abort();const controller=new AbortController();detailRequest.current=controller;setDetailBusy(place.id);setActionError('');
  try{const result=await loadNearbyDetails(vehicleId,category,place.id,controller.signal);if(!controller.signal.aborted&&active.current)setDetails(previous=>({...previous,[place.id]:result}));}
  catch(cause){if(!controller.signal.aborted&&active.current)setActionError(mobileMessage(cause));}
  finally{if(detailRequest.current===controller){detailLock.current=false;if(!controller.signal.aborted&&active.current)setDetailBusy(null);}}
 };
 const runAction=async(action:'directions'|'call'|'share',place:NearbyPlace)=>{
  if(!data||actionLock.current)return;actionLock.current=true;setActionBusy(true);setActionError('');
  try{await placeAction(action,place,data.center);}catch(cause){if(active.current)setActionError(mobileMessage(cause));}
  finally{actionLock.current=false;if(active.current)setActionBusy(false);}
 };
 const close=()=>{if(router.canGoBack())router.back();else router.replace('/(app)');};
 const card=({item}:{item:NearbyPlace})=>{
  const place=details[item.id]??item;
  return <View style={[styles.card,selected===place.id?styles.selected:null]}>
   <Pressable accessibilityRole="button" accessibilityLabel={`Locate ${place.name}`} onPress={()=>choose(place)}><Text style={styles.placeName}>{place.name}</Text><Text style={styles.muted}>{place.type} · {(place.distanceMeters/1000).toFixed(2)} km away</Text></Pressable>
   <Text style={styles.address}>{place.address??'Address not provided'}</Text>
   {place.openingHours?<Text style={styles.hours}>{place.openingHours==='24/7'?'Open 24 hours':`Hours: ${place.openingHours}`}</Text>:null}
   <View style={styles.actions}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Directions to ${place.name}`} disabled={actionBusy} onPress={()=>void runAction('directions',place)} style={styles.pill}><Text style={styles.pillText}>↗ Directions</Text></Pressable>
    {place.phone?<Pressable accessibilityRole="button" accessibilityLabel={`Call ${place.name}`} disabled={actionBusy} onPress={()=>void runAction('call',place)} style={styles.pill}><Text style={styles.pillText}>☎ Call</Text></Pressable>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={`Share ${place.name}`} disabled={actionBusy} onPress={()=>void runAction('share',place)} style={styles.pill}><Text style={styles.pillText}>♧ Share</Text></Pressable>
    {!details[item.id]?<Pressable accessibilityRole="button" accessibilityLabel={`Load details for ${place.name}`} disabled={Boolean(detailBusy)} onPress={()=>void detail(place)} style={styles.pill}><Text style={styles.pillText}>{detailBusy===item.id?'Loading…':'Details'}</Text></Pressable>:null}
   </View>
   {details[item.id]&&!place.phone&&!place.openingHours?<Text style={styles.small}>Phone and opening hours not supplied by the provider.</Text>:null}
  </View>;
 };
 return <View style={styles.page}>
  {data?<MapView ref={map} style={styles.map} initialRegion={{...data.center,latitudeDelta:.1,longitudeDelta:.1}} onMapReady={fit}>
   <Marker coordinate={data.center} title={`${vehicleNumber} · Recorded vehicle GPS`} pinColor="#087ca7" zIndexOffset={1000} onPress={fit}><Text>V</Text></Marker>
   {places.map(place=><Marker key={place.id} coordinate={place} title={place.name} pinColor={selected===place.id?'#087ca7':'#ef4444'} onPress={()=>choose(place)}><Text>{category==='hospitals'?'H':category==='atm'?'A':'•'}</Text></Marker>)}
  </MapView>:<View style={styles.emptyMap}/>}
  <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Choose Nearby category" style={{flex:1}} onPress={()=>setCategoriesOpen(true)}><Text style={styles.topTitle}>{category?nearbyCategories[category].label:'Nearby'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Close Nearby results" onPress={close} style={styles.close}><Text style={styles.cross}>×</Text></Pressable></View>
  {data?<Pressable accessibilityRole="button" accessibilityLabel="Recenter Nearby map" onPress={fit} style={styles.recenter}><FontAwesome6 name="crosshairs" size={22} color="#087ca7"/></Pressable>:null}
  <View style={[styles.sheet,{height:Math.min(height-110,Math.max(230,height*(expanded ? .76 : .56)))}]}>
   <View {...pan.panHandlers}><Pressable accessibilityRole="button" accessibilityLabel="Expand or collapse Nearby results" onPress={()=>setExpanded(value=>!value)} style={styles.handleTouch}><View style={styles.handle}/></Pressable></View>
   <View style={styles.sheetHeading}><Text accessibilityRole="header" style={styles.heading}>{category?nearbyCategories[category].label:'Nearby'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close Nearby results sheet" onPress={close} style={styles.close}><Text style={styles.cross}>×</Text></Pressable></View>
   <View style={styles.filters}><Pressable accessibilityRole="button" accessibilityLabel="Change Nearby search radius" onPress={()=>setRadius(value=>value===5000?10000:5000)} style={styles.filter}><Text>{radius/1000} km ▾</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Sort Nearby results" onPress={()=>setAlphabetical(value=>!value)} style={styles.filter}><Text>{alphabetical?'Name A–Z':'Nearest first'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Refresh Nearby results" disabled={loading} onPress={()=>setRetry(value=>value+1)} style={styles.filter}><Text>Refresh</Text></Pressable></View>
   <Text style={styles.vehicle}>Around {vehicleNumber||'selected vehicle'} · blue V = recorded vehicle GPS</Text>
   {data?.center.stale?<Text accessibilityRole="alert" style={styles.warning}>{data.center.timeUncertain?'GPS time cannot be confirmed.':'GPS position is over 10 minutes old.'} Recorded: {data.center.recordedAt?new Date(data.center.recordedAt).toLocaleString():'Time unavailable'}</Text>:null}
   {data?.limitation?<Text style={styles.warning}>{data.limitation}</Text>:null}
   {actionError?<Text accessibilityRole="alert" style={styles.error}>{actionError}</Text>:null}
   {loading?<View style={styles.state}><ActivityIndicator/><Text>Loading vehicle GPS and nearby places…</Text></View>:error?<View style={styles.state}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setRetry(value=>value+1)}><Text style={styles.pillText}>Retry search</Text></Pressable></View>:<>
    <TextInput accessibilityLabel="Filter nearby places" placeholder="Filter these results" value={search} onChangeText={setSearch} style={styles.search}/>
    <FlatList ref={list} data={places} keyExtractor={item=>item.id} renderItem={card} onScrollToIndexFailed={()=>list.current?.scrollToOffset({offset:0,animated:true})} ListEmptyComponent={<Text style={styles.state}>{search?'No results match this filter.':'No matching places found in this radius. Try 10 km or another category.'}</Text>}/>
   </>}
   <Text style={styles.attribution}><Text accessibilityRole="link" onPress={()=>void Linking.openURL('https://www.geoapify.com/').catch(()=>setActionError('Could not open attribution link.'))}>Powered by Geoapify</Text> · <Text accessibilityRole="link" onPress={()=>void Linking.openURL('https://www.openstreetmap.org/copyright').catch(()=>setActionError('Could not open attribution link.'))}>© OpenStreetMap contributors</Text></Text><Text style={styles.small}>Ratings/reviews and current opening status are not supplied. Hours appear when available.</Text>
  </View>
  <NearbySheet vehicle={categoriesOpen&&vehicleId?{id:vehicleId,vehicle_number:vehicleNumber}:null} onClose={()=>setCategoriesOpen(false)}/>
 </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#f3f4f6'},map:{flex:1},emptyMap:{flex:1,backgroundColor:'#e8ede8'},topBar:{position:'absolute',top:10,left:12,right:12,borderRadius:28,backgroundColor:'white',minHeight:48,paddingLeft:18,paddingRight:8,flexDirection:'row',alignItems:'center',elevation:4,shadowOpacity:.15,shadowRadius:4},topTitle:{fontSize:22,color:'#222'},close:{width:36,height:36,alignItems:'center',justifyContent:'center',borderRadius:18,backgroundColor:'#f3f4f6'},cross:{fontSize:26,lineHeight:28,color:'#555'},recenter:{position:'absolute',right:14,top:76,width:40,height:40,borderRadius:20,backgroundColor:'white',alignItems:'center',justifyContent:'center',elevation:3},sheet:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'white',borderTopLeftRadius:26,borderTopRightRadius:26,paddingBottom:8,elevation:8,shadowOpacity:.12,shadowRadius:6},handleTouch:{height:20,alignItems:'center',justifyContent:'center'},handle:{width:36,height:4,borderRadius:2,backgroundColor:'#ccc'},sheetHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:18},heading:{fontSize:23,fontWeight:'600',color:'#222'},filters:{flexDirection:'row',gap:8,paddingHorizontal:16,paddingVertical:8},filter:{backgroundColor:'#f3f4f6',paddingHorizontal:10,paddingVertical:6,borderRadius:8},vehicle:{fontSize:11,color:'#64748b',paddingHorizontal:18},search:{marginHorizontal:16,marginVertical:5,paddingHorizontal:10,paddingVertical:6,borderWidth:1,borderColor:'#e2e8f0',borderRadius:8},card:{paddingHorizontal:18,paddingVertical:12,borderBottomWidth:5,borderBottomColor:'#f3f4f6',gap:5},selected:{backgroundColor:'#effbff'},placeName:{fontSize:19,color:'#222',marginBottom:3},muted:{fontSize:12,color:'#555'},address:{fontSize:13,color:'#555'},hours:{fontSize:13,color:'#218044'},actions:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:5},pill:{backgroundColor:'#cff7fd',borderRadius:20,paddingHorizontal:12,paddingVertical:8},pillText:{color:'#075a6a',fontWeight:'600',fontSize:12},small:{fontSize:10,color:'#64748b',paddingHorizontal:12,lineHeight:14},warning:{color:'#92400e',fontSize:11,lineHeight:15,paddingHorizontal:18,paddingTop:3},error:{color:'#b91c1c',fontSize:13,lineHeight:18,paddingHorizontal:12},state:{padding:16,gap:10,alignItems:'center'},attribution:{fontSize:10,color:'#475569',textAlign:'center',paddingVertical:3}});
