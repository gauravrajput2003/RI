import {useLocalSearchParams} from 'expo-router';
import {AddDriverView} from '../../features/drivers/AddDriverView';
export default function AddDriver(){const params=useLocalSearchParams<{vehicleId?:string;vehicleNumber?:string}>();return <AddDriverView key={params.vehicleId??'all'} vehicleId={typeof params.vehicleId==='string'&&params.vehicleId?params.vehicleId:undefined} vehicleNumber={typeof params.vehicleNumber==='string'?params.vehicleNumber:undefined}/>;}
