import { Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Access, Screen, Button, form } from '../../components/MobileForm';
import { useAccount } from '../../services/api/mobile';
export default function Coins(){const account=useAccount();return <Access capability="coins"><Screen backTo="profile" title="Coin"><View style={form.card}><FontAwesome6 name="hand-holding-dollar" size={28} color="#ee0509"/><Text style={form.heading}>Available balance</Text><Text style={{fontSize:28,fontWeight:'700'}}>{account.isFetching?'Loading…':account.isError?'Unavailable':account.data?.coins??'Unavailable'}</Text><Button label="Refresh balance" onPress={()=>void account.refetch()}/><Text style={form.muted}>Balance reflects unexpired coins returned by your account.</Text></View></Screen></Access>}
