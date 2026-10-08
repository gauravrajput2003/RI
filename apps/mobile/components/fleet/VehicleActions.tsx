import { Pressable, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Sheet } from './Sheet';
import { useAccount } from '../../services/api/mobile';
import { capabilities } from '../../features/account/capabilities';
export function VehicleActions({vehicle,onClose,onShare}:{vehicle:{id:string;vehicle_number:string}|null;onClose():void;onShare():void}){
 const account=useAccount(),caps=capabilities(account.data);
 const actions=[...(caps.editVehicle?[{label:'Edit',icon:'file-pen' as const,press:()=>{onClose();router.push({pathname:'/(app)/edit-vehicle',params:{vehicleId:vehicle?.id}})}}]:[]),...(caps.share?[{label:'Share',icon:'share-nodes' as const,press:onShare}]:[]),...(caps.notifications?[{label:'Notification',icon:'bell-slash' as const,press:()=>{onClose();router.push({pathname:'/(app)/notifications',params:{vehicleId:vehicle?.id}})}}]:[])];
 return <Sheet visible={Boolean(vehicle)} onClose={onClose}><View style={{alignSelf:'center',width:34,height:4,borderRadius:4,backgroundColor:'#ddd',marginBottom:8}}/><View style={{flexDirection:'row',paddingBottom:12}}>{actions.map(action=><Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.press} style={{flex:1,minHeight:56,alignItems:'center',justifyContent:'center',gap:7}}><FontAwesome6 name={action.icon} size={23} color={action.label==='Edit'?'#218cd1':action.label==='Share'?'#55aa65':'#555'}/><Text style={{fontSize:13,color:'#111'}}>{action.label}</Text></Pressable>)}</View></Sheet>;
}
