import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,FlatList,Pressable,StyleSheet,Text,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {SvgXml} from 'react-native-svg';
import {useQueryClient} from '@tanstack/react-query';
import {DriverAvatar,DriverHeader} from './DriverUI';
import {useDrivers,useVehicleDriver} from './queries';
import {driverKeys,setVehicleDriver,type Driver} from './service';
import {useAccount,mobileMessage} from '../../services/api/mobile';
import {capabilities} from '../account/capabilities';
import {useAuthStore} from '../../store/authStore';

export function DriverListView({vehicleId,vehicleNumber}:{vehicleId?:string;vehicleNumber?:string}){
 const drivers=useDrivers(vehicleId),assignment=useVehicleDriver(vehicleId??''),account=useAccount(),caps=capabilities(account.data),cache=useQueryClient(),session=useAuthStore(state=>state.sessionKey);
 const [selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),active=useRef(false),generation=useRef(0),refresh=useRef({drivers,assignment});refresh.current={drivers,assignment};
 useFocusEffect(useCallback(()=>{active.current=true;generation.current++;if(!lock.current)setBusy(false);void refresh.current.drivers.refetch();if(vehicleId)void refresh.current.assignment.refetch();return()=>{active.current=false;generation.current++;};},[vehicleId,session]));
 useEffect(()=>{setSelected(null);setError('');},[vehicleId,session]);
 const rows=useMemo(()=>[...new Map((drivers.data?.pages??[]).flatMap(page=>page.data).map(driver=>[driver.id,driver])).values()],[drivers.data]);
 const selectedDriver=rows.find(driver=>driver.id===selected);
 const canAssign=Boolean(vehicleId&&selectedDriver&&(!selectedDriver.assigned||selectedDriver.vehicle_id===vehicleId)&&assignment.data&&!assignment.isFetching&&!assignment.isError&&caps.editVehicle&&!busy);
 const back=()=>router.replace(vehicleId?'/(app)':'/(app)/profile');
 const save=async()=>{
  if(lock.current||!canAssign||!vehicleId||!selected||!assignment.data)return;
  lock.current=true;setBusy(true);setError('');const version=generation.current;
  try{
   const result=await setVehicleDriver(vehicleId,selected,assignment.data.assignmentId);
   cache.setQueryData(driverKeys.assignment(session,vehicleId),result);await cache.invalidateQueries({queryKey:driverKeys.all});
   if(active.current&&generation.current===version&&useAuthStore.getState().sessionKey===session)back();
  }catch(cause){if(active.current&&generation.current===version){setError(mobileMessage(cause));void assignment.refetch();void drivers.refetch();}}
  finally{lock.current=false;if(active.current)setBusy(false);}
 };
 const card=({item}:{item:Driver})=>{
  const unavailable=Boolean(vehicleId&&item.assigned&&item.vehicle_id!==vehicleId),chosen=selected===item.id;
  return <Pressable accessibilityRole={vehicleId?'radio':'button'} accessibilityState={{checked:chosen,disabled:busy||unavailable}} accessibilityLabel={vehicleId?`Select driver ${item.name}`:`Driver ${item.name}`} disabled={busy||unavailable||!vehicleId||!caps.editVehicle} onPress={()=>{setSelected(item.id);setError('');}} style={[styles.card,chosen&&styles.selected,unavailable&&{opacity:.6}]}>
   <DriverAvatar/><View style={styles.info}><Text style={styles.label}>Name</Text><Text style={styles.value}>{item.name}</Text><Text style={styles.label}>Mobile</Text><Text style={styles.value}>{item.mobile}</Text>{item.assigned?<Text style={styles.assigned}>{item.vehicle_id===vehicleId?'Current driver':`Assigned${item.vehicle_number?` · ${item.vehicle_number}`:' to another vehicle'}`}</Text>:null}</View>{chosen?<Text style={styles.check}>✓</Text>:null}
  </Pressable>;
 };
 return <View style={styles.page}><DriverHeader title="Driver List" onBack={back}/>
  {drivers.isError&&drivers.data?<Text accessibilityRole="alert" style={[styles.error,{padding:10}]}>Could not refresh drivers. Pull down to retry.</Text>:null}
  {drivers.isLoading&&!drivers.data?<View style={styles.state}><ActivityIndicator/><Text>Loading drivers…</Text></View>:drivers.isError&&!drivers.data?<View style={styles.state}><Text accessibilityRole="alert" style={styles.error}>{mobileMessage(drivers.error)}</Text><Pressable accessibilityRole="button" onPress={()=>void drivers.refetch()}><Text>Retry drivers</Text></Pressable></View>:<FlatList data={rows} renderItem={card} keyExtractor={item=>item.id} contentContainerStyle={styles.list} refreshing={drivers.isRefetching} onRefresh={()=>{void drivers.refetch();if(vehicleId)void assignment.refetch();}} onEndReached={()=>{if(drivers.hasNextPage&&!drivers.isFetchingNextPage)void drivers.fetchNextPage();}} onEndReachedThreshold={.3} ListFooterComponent={drivers.isFetchingNextPage?<ActivityIndicator/>:drivers.isFetchNextPageError?<Pressable onPress={()=>void drivers.fetchNextPage()}><Text>Could not load more drivers · Retry</Text></Pressable>:null} ListEmptyComponent={<Text style={styles.empty}>No drivers saved yet. Tap + to add a driver.</Text>}/>}
  {vehicleId?<View style={styles.assignment}><Text style={styles.context}>Assign to {vehicleNumber||'selected vehicle'}</Text>{assignment.isError?<Pressable accessibilityRole="button" onPress={()=>void assignment.refetch()}><Text style={styles.error}>Unable to load current assignment · Retry</Text></Pressable>:null}{error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}<Pressable accessibilityRole="button" accessibilityLabel="Confirm driver assignment" disabled={!canAssign} onPress={()=>void save()} style={[styles.confirm,!canAssign&&{opacity:.5}]}><Text style={styles.confirmText}>{busy?'ASSIGNING…':'ASSIGN DRIVER'}</Text></Pressable></View>:null}
  {caps.editVehicle?<Pressable accessibilityRole="button" accessibilityLabel="Add driver" disabled={busy} onPress={()=>router.push({pathname:'/(app)/add-driver',params:{vehicleId:vehicleId??'',vehicleNumber:vehicleNumber??''}})} style={[styles.plus,{bottom:vehicleId?138:44}]}><SvgXml xml={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M18 4v28M4 18h28" fill="none" stroke="#fff" stroke-width="5"/></svg>'} width={36} height={36}/></Pressable>:null}
 </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#f7f7f7'},list:{padding:9,paddingBottom:100,gap:10},card:{backgroundColor:'#fff',borderRadius:10,padding:12,flexDirection:'row',alignItems:'center',gap:18,minHeight:112,elevation:4,shadowOpacity:.14,shadowRadius:5,shadowOffset:{width:0,height:2},borderWidth:1,borderColor:'transparent'},selected:{borderColor:'#9229b4',backgroundColor:'#fdf7ff'},info:{flex:1},label:{fontSize:16,fontWeight:'700',color:'#111'},value:{fontSize:15,color:'#111',marginBottom:2},assigned:{fontSize:11,color:'#64748b',marginTop:4},plus:{position:'absolute',right:17,width:52,height:52,borderRadius:26,backgroundColor:'#f00000',alignItems:'center',justifyContent:'center',elevation:4,shadowOpacity:.2,shadowRadius:4,shadowOffset:{width:0,height:2}},check:{color:'#9229b4',fontSize:24},empty:{color:'#666',textAlign:'center',padding:30},state:{padding:24,gap:12,alignItems:'center'},error:{color:'#b91c1c',fontSize:12,lineHeight:18},assignment:{padding:12,borderTopWidth:1,borderColor:'#eee',backgroundColor:'#fff',gap:6},context:{fontSize:12,color:'#555'},confirm:{padding:13,backgroundColor:'#f00000',borderRadius:8,alignItems:'center'},confirmText:{color:'#fff',fontSize:15,fontWeight:'700'}});
