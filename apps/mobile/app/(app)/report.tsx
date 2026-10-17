import {useLocalSearchParams} from 'expo-router';
import {ReportView} from '../../features/reports/ReportView';
export default function MobileReportScreen(){
 const params=useLocalSearchParams<{kind?:string;vehicleId?:string;vehicleNumber?:string}>();
 const kind=params.kind==='travel-summary'?'travel-summary':'distance',vehicleId=typeof params.vehicleId==='string'?params.vehicleId:'';
 return <ReportView key={`${kind}:${vehicleId}`} kind={kind} vehicleId={vehicleId} vehicleNumber={typeof params.vehicleNumber==='string'?params.vehicleNumber:''}/>;
}
