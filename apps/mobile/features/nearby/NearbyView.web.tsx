import {Text,View} from 'react-native';
export function NearbyView(_props:{vehicleId:string;vehicleNumber:string;category:string}){
 void _props;
 return <View style={{padding:24,gap:12}}><Text style={{fontSize:22,fontWeight:'700'}}>Nearby map available on Android and iOS</Text><Text>Open the mobile app on your phone to search around the selected vehicle’s recorded GPS position.</Text></View>;
}
