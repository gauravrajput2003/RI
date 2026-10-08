import { useState } from 'react';
import { Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Access, Screen, Button, form } from '../../components/MobileForm';
import { api } from '../../services/api/client';
import { mobileMessage, requireOnline } from '../../services/api/mobile';
import { ErrorState, Loading } from '../../components/StateViews';
type Feed={muted:boolean;items:{id:string;message:string;occurred_at:string}[]};
export default function Notifications(){return <Access capability="notifications"><FeedScreen/></Access>}
function FeedScreen(){const {vehicleId}=useLocalSearchParams<{vehicleId:string}>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const path=`/mobile/vehicles/${encodeURIComponent(vehicleId??'')}/notifications`;
 const q=useQuery({queryKey:['mobile-notifications',vehicleId],enabled:Boolean(vehicleId),queryFn:async()=>(await api.get<{data:Feed}>(path)).data.data});
 async function toggle(){if(busy||!q.data)return;setBusy(true);try{requireOnline();await api.patch(path,{muted:!q.data.muted});await q.refetch();setError('')}catch(e){setError(mobileMessage(e))}finally{setBusy(false)}}
 if(q.isLoading)return <Loading/>;if(q.isError)return <ErrorState message="Notifications unavailable" retry={()=>q.refetch()}/>;
 return <Screen backTo="vehicles" title="Notification"><View style={form.card}><FontAwesome6 name="bell-slash" size={26} color={q.data?.muted?'#ee0509':'#777'}/><Text>Mobile notification feed: {q.data?.muted?'Muted':'On'}</Text><Button label={busy?'Saving…':q.data?.muted?'Unmute notifications':'Mute notifications'} disabled={busy||!q.data} onPress={()=>void toggle()}/><Text style={form.muted}>Applies to this vehicle in your mobile account. Server alert rules and other users are unchanged.</Text></View>{error?<Text style={form.error}>{error}</Text>:null}{q.data?.items.map(item=><View key={item.id} style={form.card}><Text>{item.message}</Text><Text style={form.muted}>{new Date(item.occurred_at).toLocaleString()}</Text></View>)}{!q.data?.items.length?<Text style={form.muted}>{q.data?.muted?'Unmute to view vehicle notifications.':'No notifications found.'}</Text>:null}</Screen>;
}
