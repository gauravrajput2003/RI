import {useLocalSearchParams} from 'expo-router';
import {DriverListView} from '../../features/drivers/DriverListView';
export default function Drivers(){const params=useLocalSearchParams<{vehicleId?:string;vehicleNumber?:string}>();return <DriverListView vehicleId={typeof params.vehicleId==='string'&&params.vehicleId?params.vehicleId:undefined} vehicleNumber={typeof params.vehicleNumber==='string'?params.vehicleNumber:undefined}/>;}
