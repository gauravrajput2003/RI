import {MaterialCommunityIcons} from '@expo/vector-icons';
import {StyleSheet,View} from 'react-native';
import {vehicleAppearance,type VehicleVisualIcon,type VehicleVisualState} from '../../../../packages/shared-utils/src/index';

const names:Record<VehicleVisualIcon,'motorbike'|'car-outline'|'truck-outline'|'van-passenger'>={
  'two-wheeler':'motorbike',
  'directions-car':'car-outline',
  'local-shipping':'truck-outline',
  'airport-shuttle':'van-passenger',
};

export function VehicleIcon({type,state,size=42}:{type?:string|null;state?:VehicleVisualState;size?:number}){
  const appearance=vehicleAppearance(type,state);
  return <View accessibilityLabel={`${appearance.label} ${appearance.type}`} style={[styles.badge,{width:size*1.55,height:size*1.25,backgroundColor:appearance.background}]}><MaterialCommunityIcons name={names[appearance.icon]} size={size} color={appearance.color}/></View>;
}
const styles=StyleSheet.create({badge:{borderRadius:12,alignItems:'center',justifyContent:'center'}});
