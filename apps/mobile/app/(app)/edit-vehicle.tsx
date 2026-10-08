import {useEffect,useState} from 'react';
import {Text} from 'react-native';
import {useLocalSearchParams,router} from 'expo-router';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Access,Screen,Field,Button,Options,form} from '../../components/MobileForm';
import {api} from '../../services/api/client';
import {getEditableVehicle,mobileMessage,requireOnline} from '../../services/api/mobile';
import {ErrorState,Loading} from '../../components/StateViews';
const vehicleTypes=['Bike','Car','EVCar','Scooty','Bus','Truck','Van','Jeep','Three Wheeler','E-Rickshaw','Tractor'];
export default function EditVehicle(){return <Access capability="editVehicle"><EditForm/></Access>}
function EditForm(){
 const {vehicleId}=useLocalSearchParams<{vehicleId:string}>(),cache=useQueryClient();
 const query=useQuery({queryKey:['mobile-vehicle',vehicleId],queryFn:()=>getEditableVehicle(vehicleId),enabled:Boolean(vehicleId)});
 const [values,setValues]=useState({vehicleNumber:'',vehicleType:'',mileage:'',odometer:'',alias:'',remark:'',overspeedLimit:'',gpsLocation:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const field=(key:keyof typeof values,value:string)=>setValues(previous=>({...previous,[key]:value}));
 useEffect(()=>{if(query.data){const v=query.data;setValues({vehicleNumber:v.vehicle_number,vehicleType:v.vehicle_type??'',mileage:v.mileage?.toString()??'',odometer:v.odometer?.toString()??'',alias:v.alias??'',remark:v.remark??'',overspeedLimit:v.overspeed_limit?.toString()??'',gpsLocation:v.gps_location??''})}},[query.data]);
 async function save(){
  if(busy)return;setBusy(true);setError('');
  try{
   requireOnline();
   if(!values.vehicleNumber.trim())throw new Error('Enter a vehicle number.');
   if(!values.vehicleType)throw new Error('Select a vehicle type.');
   const numeric=(key:'mileage'|'odometer'|'overspeedLimit',label:string,max:number)=>{
    const text=values[key].trim();if(!text)return null;const value=Number(text);
    if(!Number.isFinite(value)||value<0||value>max||(key==='overspeedLimit'&&value===0))throw new Error(`${label} must be ${key==='overspeedLimit'?'greater than zero':'zero or more'} and no more than ${max}.`);
    return value;
   };
   await api.patch(`/mobile/vehicles/${encodeURIComponent(vehicleId)}`,{...values,vehicleNumber:values.vehicleNumber.trim(),mileage:numeric('mileage','Mileage',1_000_000_000),odometer:numeric('odometer','Odometer',1_000_000_000_000),overspeedLimit:numeric('overspeedLimit','Overspeed',300)});
   await Promise.all(['vehicles','vehicle-detail','vehicle-details','mobile-vehicle'].map(key=>cache.invalidateQueries({queryKey:[key]})));
   router.replace('/(app)/vehicles');
  }catch(e){setError(mobileMessage(e))}finally{setBusy(false)}
 }
 if(query.isLoading)return <Loading/>;if(query.isError||!query.data)return <ErrorState message="Vehicle unavailable" retry={()=>query.refetch()}/>;
 const types=[...new Set([...vehicleTypes,...(values.vehicleType?[values.vehicleType]:[])])];
 return <Screen backTo="vehicles" title="Edit Vehicle">
  <Field label="Vehicle Number" value={values.vehicleNumber} onChangeText={value=>field('vehicleNumber',value)} maxLength={80}/>
  <Options label="Vehicle Type" value={values.vehicleType} options={types.map(id=>({id,label:id}))} onChange={value=>field('vehicleType',value)}/>
  <Field label="Mileage" value={values.mileage} onChangeText={value=>field('mileage',value)} keyboardType="decimal-pad"/>
  <Field label="Overspeed" value={values.overspeedLimit} onChangeText={value=>field('overspeedLimit',value)} keyboardType="decimal-pad"/>
  <Field label="Odometer" value={values.odometer} onChangeText={value=>field('odometer',value)} keyboardType="decimal-pad"/>
  <Field label="Alias" value={values.alias} onChangeText={value=>field('alias',value)} maxLength={120}/>
  <Field label="GPS Location" placeholder="Installation position, e.g. upper dashboard" value={values.gpsLocation} onChangeText={value=>field('gpsLocation',value)} maxLength={500}/>
  <Field label="Remark" value={values.remark} onChangeText={value=>field('remark',value)} maxLength={500} multiline/>
  {error?<Text accessibilityRole="alert" style={form.error}>{error}</Text>:null}<Button label={busy?'Saving…':'Save'} disabled={busy} onPress={()=>void save()}/>
 </Screen>;
}
