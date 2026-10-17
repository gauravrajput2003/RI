import {useLocalSearchParams} from 'expo-router';
import {NearbyView} from '../../features/nearby/NearbyView';
export default function Nearby(){
 const params=useLocalSearchParams<{vehicleId?:string;vehicleNumber?:string;category?:string}>();
 return <NearbyView vehicleId={typeof params.vehicleId==='string'?params.vehicleId:''} vehicleNumber={typeof params.vehicleNumber==='string'?params.vehicleNumber:''} category={typeof params.category==='string'?params.category:''}/>;
}
