import {useCallback,useRef,useState} from 'react';
import {KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import {useQueryClient} from '@tanstack/react-query';
import {DriverHeader} from './DriverUI';
import {driverKeys,saveDriver,validateDriver,type DriverInput} from './service';
import {useAccount,mobileMessage} from '../../services/api/mobile';
import {capabilities} from '../account/capabilities';
import {useAuthStore} from '../../store/authStore';

export function AddDriverView({vehicleId,vehicleNumber}:{vehicleId?:string;vehicleNumber?:string}){
 const cache=useQueryClient(),account=useAccount(),session=useAuthStore(state=>state.sessionKey),caps=capabilities(account.data);
 const [input,setInput]=useState<DriverInput>({name:'',mobile:'',licenceNumber:''}),[errors,setErrors]=useState<Partial<Record<keyof DriverInput,string>>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false),active=useRef(false),generation=useRef(0);
 useFocusEffect(useCallback(()=>{active.current=true;generation.current++;if(!lock.current)setBusy(false);return()=>{active.current=false;generation.current++;};},[]));
 const back=()=>router.replace({pathname:'/(app)/drivers',params:{vehicleId:vehicleId??'',vehicleNumber:vehicleNumber??''}});
 const submit=async()=>{
  if(lock.current)return;const checked=validateDriver(input);setErrors(checked.errors);setError('');if(!checked.valid)return;
  if(!caps.editVehicle){setError('Vehicle edit permission is required to add drivers.');return;}
  lock.current=true;setBusy(true);const version=generation.current;
  try{
   await saveDriver(checked.data,vehicleId);await cache.invalidateQueries({queryKey:driverKeys.all});
   if(active.current&&generation.current===version&&useAuthStore.getState().sessionKey===session){setInput({name:'',mobile:'',licenceNumber:''});back();}
  }catch(cause){if(active.current&&generation.current===version)setError(mobileMessage(cause));}
  finally{lock.current=false;if(active.current)setBusy(false);}
 };
 return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS==='ios'?'padding':undefined}><DriverHeader title="Add Driver" onBack={back}/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
  {([{key:'name',label:'Name'},{key:'mobile',label:'Mobile'},{key:'licenceNumber',label:'Licence Number'}] as const).map(field=><View key={field.key} style={styles.field}><Text style={styles.label}>{field.label}</Text><TextInput accessibilityLabel={field.label} placeholder={field.label} placeholderTextColor="#888" style={styles.input} value={input[field.key]} onChangeText={value=>setInput(previous=>({...previous,[field.key]:value}))} editable={!busy} maxLength={field.key==='name'?120:field.key==='mobile'?20:40} keyboardType={field.key==='mobile'?'phone-pad':'default'} autoCapitalize={field.key==='licenceNumber'?'characters':field.key==='name'?'words':'none'}/>{errors[field.key]?<Text accessibilityRole="alert" style={styles.error}>{errors[field.key]}</Text>:null}</View>)}
  {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
  {account.isError?<Pressable accessibilityRole="button" onPress={()=>void account.refetch()}><Text style={styles.error}>Unable to verify access · Retry</Text></Pressable>:null}
  <Pressable accessibilityRole="button" accessibilityLabel="Save driver" disabled={busy||account.isLoading||!caps.editVehicle} onPress={()=>void submit()} style={[styles.save,(busy||!caps.editVehicle)&&{opacity:.5}]}><Text style={styles.saveText}>{busy?'SAVING…':'SAVE'}</Text></Pressable>
 </ScrollView></KeyboardAvoidingView>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#f7f7f7'},form:{paddingHorizontal:17,paddingTop:18,paddingBottom:30},field:{marginBottom:32,gap:4},label:{fontSize:16,fontWeight:'700',color:'#111'},input:{height:42,borderWidth:1,borderColor:'#333',borderRadius:8,paddingHorizontal:13,fontSize:15,color:'#111',backgroundColor:'#f7f7f7'},save:{height:43,backgroundColor:'#f00000',borderRadius:8,justifyContent:'center',alignItems:'center',marginTop:2},saveText:{fontWeight:'700',color:'#fff',fontSize:16},error:{fontSize:12,lineHeight:17,color:'#b91c1c',paddingVertical:4}});
