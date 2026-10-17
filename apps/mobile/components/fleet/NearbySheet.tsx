import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Modal,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {FontAwesome6} from '@expo/vector-icons';
import {nearbyCategories,nearbyCategoryIds,handleOpenNearbyInGoogleMaps,type NearbyCategory,type NearbyCenter} from '../../features/nearby/service';
import {mobileMessage} from '../../services/api/mobile';
import type {StreetVehicle} from './StreetViewSheet';

export function NearbySheet({vehicle,onClose}:{vehicle:StreetVehicle|null;onClose():void}){
 const {height}=useWindowDimensions(),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const operation=useRef<{controller:AbortController|null;busy:boolean;cancelReview:(()=>void)|null}>({controller:null,busy:false,cancelReview:null});
 useEffect(()=>{setError('');setBusy(null);const op=operation.current;op.busy=false;return()=>{op.controller?.abort();op.cancelReview?.();op.busy=false;};},[vehicle?.id]);
 const reviewStale=(point:NearbyCenter)=>new Promise<boolean>(resolve=>{
  operation.current.cancelReview=()=>resolve(false);
  Alert.alert('Recorded vehicle position',`${point.timeUncertain?'GPS time cannot be confirmed.':'This GPS position is over 10 minutes old.'}\nRecorded: ${point.recordedAt?new Date(point.recordedAt).toLocaleString():'Time unavailable'}\nSearch around this recorded position?`,[
   {text:'Cancel',style:'cancel',onPress:()=>resolve(false)},{text:'Use recorded GPS',onPress:()=>resolve(true)},
  ],{cancelable:true,onDismiss:()=>resolve(false)});
 });
 const external=async(category:NearbyCategory)=>{
  if(!vehicle||operation.current.busy)return;
  const op=operation.current,controller=new AbortController();op.controller=controller;op.busy=true;setBusy(category);setError('');
  try{await handleOpenNearbyInGoogleMaps(category,vehicle.id,controller.signal,reviewStale);}
  catch(cause){if(!controller.signal.aborted)setError(mobileMessage(cause));}
  finally{if(op.controller===controller){op.busy=false;op.cancelReview=null;if(!controller.signal.aborted)setBusy(null);}}
 };
 if(!vehicle)return null;
 return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={styles.overlay}>
  <Pressable accessibilityLabel="Dismiss Nearby" onPress={onClose} style={StyleSheet.absoluteFill}/>
  <View accessibilityViewIsModal style={styles.modal}><View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Nearby</Text><Pressable accessibilityRole="button" accessibilityLabel="Close Nearby" onPress={onClose} hitSlop={10}><Text style={styles.close}>×</Text></Pressable></View>
   <ScrollView style={{maxHeight:height*.72}} contentContainerStyle={styles.categories}>
    {nearbyCategoryIds.map(category=><View key={category} style={styles.row}><Text style={styles.emoji}>{nearbyCategories[category].icon}</Text><Text style={styles.label}>{nearbyCategories[category].label}</Text>
     <Pressable accessibilityRole="button" accessibilityLabel={`Search ${nearbyCategories[category].label} in Google Maps`} disabled={Boolean(busy)} onPress={()=>void external(category)} style={styles.action}><FontAwesome6 name="arrows-up-down-left-right" size={19} color="#3b403d"/></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel={`Open ${nearbyCategories[category].label} in Google Maps`} disabled={Boolean(busy)} onPress={()=>void external(category)} style={styles.action}>{busy===category?<ActivityIndicator/>:<FontAwesome6 name="location-arrow" size={18} color="#111"/>}</Pressable>
    </View>)}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
   </ScrollView>
  </View>
 </View></Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'#0007',justifyContent:'center',alignItems:'center',padding:12},modal:{width:'100%',maxWidth:420,backgroundColor:'white',borderRadius:10,overflow:'hidden'},header:{backgroundColor:'#f00000',paddingHorizontal:14,height:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'white',fontSize:20,fontWeight:'700'},close:{fontSize:23,color:'#333',backgroundColor:'#eee',borderRadius:14,width:24,height:24,lineHeight:25,textAlign:'center'},categories:{paddingVertical:8,paddingHorizontal:14},row:{flexDirection:'row',alignItems:'center',minHeight:43},emoji:{fontSize:23,width:32},label:{flex:1,color:'#111',fontSize:16,fontWeight:'600'},action:{width:36,minHeight:43,alignItems:'center',justifyContent:'center'},error:{color:'#b91c1c',paddingVertical:10,lineHeight:20}});
