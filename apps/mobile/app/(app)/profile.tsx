import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather, FontAwesome6, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { logout } from '../../services/api/auth';
import { api } from '../../services/api/client';
import { useAccount, mobileMessage, requireOnline } from '../../services/api/mobile';
import { capabilities } from '../../features/account/capabilities';
import { demoUserProfile } from '../../features/demo/data';
import { NoticeSheet } from '../../components/fleet/Sheet';
import { config } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
type Entry={label:string;icon:React.ComponentProps<typeof MaterialCommunityIcons>['name'];path?:Href;notice?:string};
export default function Profile(){
 const account=useAccount(),caps=capabilities(account.data),[error,setError]=useState(''),[notice,setNotice]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const demo=config.demoMode?demoUserProfile:null;
 const name=demo?.name??account.data?.name??account.data?.username??(account.isLoading?'Loading profile…':'Profile unavailable');
 const entries:Entry[]=[
  ...(caps.dashboard||demo?[{label:'Dashboard',icon:'monitor-dashboard' as const,path:'/(app)' as Href}]:[]),
  ...(caps.playback||demo?[{label:'Playback',icon:'map-marker-path' as const,path:'/(app)/vehicles' as Href}]:[]),
  ...(caps.announcements?[{label:'Announcement',icon:'bullhorn-outline' as const,path:'/(app)/announcements' as Href}]:[]),
  {label:'Privacy Policy',icon:'shield-check',notice:'Privacy policy unavailable.'},
  {label:'Change Password',icon:'lock',path:'/(app)/change-password'},
 ];
 async function signOut(all=false){if(busy)return;setBusy(true);setError('');try{if(all){requireOnline();await api.post('/mobile/logout-all');await useAuthStore.getState().setTokens(null)}else await logout();router.replace('/(auth)/login')}catch(e){setError(mobileMessage(e))}finally{setBusy(false)}}
 return <View style={styles.page}><ScrollView contentContainerStyle={{paddingBottom:12}}>
  <View style={styles.header}><View style={styles.avatar}><Text style={styles.letter}>{demo?.avatarLetter??account.data?.name?.trim().charAt(0).toUpperCase()??account.data?.username?.charAt(0).toUpperCase()??'—'}</Text></View><View style={{flex:1,gap:5}}><Text style={styles.name}>{name}</Text><Text style={styles.contact}>{demo?.email??account.data?.email??'Email unavailable'}</Text><Text style={styles.contact}>{demo?.phone??account.data?.mobile??'Phone unavailable'}</Text></View>
  {caps.coins?<Pressable accessibilityRole="button" accessibilityLabel="Coin balance" onPress={()=>router.push('/(app)/coins')} style={styles.coin}><FontAwesome6 name="hand-holding-dollar" size={20} color="#ee0509"/><Text style={styles.coinText}>{account.isFetching?'…':account.isError?'Unavailable':account.data?.coins??'Unavailable'}</Text></Pressable>:null}</View>
  {account.isError&&!demo?<Pressable accessibilityRole="button" onPress={()=>void account.refetch()} style={styles.retry}><Text>Profile unavailable · Retry</Text></Pressable>:null}
  <View style={styles.quick}>{(caps.vehicles||demo)?<Quick label="Vehicle" icon="car" color="#ef4444" path="/(app)/vehicles"/>:null}<Quick label="Subscription" icon="calendar-clock" color="#2563eb" path="/(app)/subscription"/><Quick label="Settings" icon="cog" color="#d4a017" path="/(app)/settings"/></View>
  {caps.addVehicle?<Pressable accessibilityRole="button" accessibilityLabel="Add Vehicle" onPress={()=>router.push('/(app)/add-vehicle')} style={styles.add}><FontAwesome6 name="circle-plus" size={23} color="#ee0509"/><Text style={styles.menuText}>Add Vehicle</Text><Feather name="chevron-right" size={20} color="#999"/></Pressable>:null}
  <View style={styles.menu}>{entries.map(entry=><Pressable key={entry.label} accessibilityRole="button" onPress={()=>entry.path?router.push(entry.path):setNotice(entry.notice??null)} style={styles.row}><MaterialCommunityIcons name={entry.icon} size={27} color={entry.label==='Announcement'?'#ef4444':'#5794bd'}/><Text style={styles.menuText}>{entry.label}</Text><Feather name="chevron-right" size={20} color="#aaa"/></Pressable>)}<Pressable accessibilityRole="button" onPress={()=>setNotice('logout-all')} style={styles.row}><MaterialCommunityIcons name="cellphone-arrow-down" size={27} color="#e8a521"/><Text style={styles.menuText}>Logout All Devices</Text><Feather name="chevron-right" size={20} color="#aaa"/></Pressable></View>
  <Pressable accessibilityRole="button" accessibilityLabel="Sign out of account" disabled={busy} onPress={()=>void signOut()} style={styles.logout}><MaterialCommunityIcons name="power" size={20} color="#fff"/><Text style={styles.logoutText}>{busy?'Signing out…':'Logout'}</Text></Pressable>{error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
  {notice==='logout-all'?<View style={styles.menu}><Text>Sign out all refresh sessions? Other devices will need to sign in when their current access expires.</Text><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void signOut(true)} style={styles.row}><Text style={styles.error}>Confirm Logout All Devices</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>setNotice(null)} style={styles.row}><Text>Cancel</Text></Pressable></View>:null}
 </ScrollView><NoticeSheet message={notice==='logout-all'?null:notice} onClose={()=>setNotice(null)}/></View>;
}
function Quick({label,icon,color,path}:{label:string;icon:React.ComponentProps<typeof MaterialCommunityIcons>['name'];color:string;path:Href}){return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={()=>router.push(path)} style={styles.quickItem}><MaterialCommunityIcons name={icon} size={27} color={color}/><Text style={styles.quickText}>{label}</Text></Pressable>}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#f3f4f6'},header:{backgroundColor:'#ee0509',padding:16,flexDirection:'row',alignItems:'center',gap:14,minHeight:110},avatar:{width:62,height:62,borderRadius:31,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},letter:{fontSize:36,fontWeight:'800',color:'#ee0509'},name:{fontSize:20,fontWeight:'800',color:'#fff'},contact:{fontSize:13,color:'#fff'},coin:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:4,padding:7,borderRadius:7,backgroundColor:'#fff',minHeight:44},coinText:{color:'#ee0509',fontSize:13,fontWeight:'700'},quick:{marginHorizontal:14,marginTop:10,borderRadius:14,backgroundColor:'#fff',flexDirection:'row',padding:10,elevation:2},quickItem:{flex:1,alignItems:'center',gap:4,minHeight:48},quickText:{fontWeight:'700',color:'#444'},menu:{marginHorizontal:14,marginTop:10,paddingHorizontal:16,backgroundColor:'#fff',borderRadius:14,elevation:2},row:{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:14,minHeight:54,borderBottomWidth:1,borderColor:'#eee'},menuText:{flex:1,fontSize:16,fontWeight:'600',color:'#444'},add:{marginHorizontal:14,marginTop:10,flexDirection:'row',alignItems:'center',gap:14,padding:16,backgroundColor:'#fff',borderRadius:14},logout:{backgroundColor:'#ee0509',margin:14,borderRadius:13,padding:14,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:6},logoutText:{color:'#fff',fontWeight:'700'},error:{color:'#b91c1c',padding:12},retry:{padding:14,alignItems:'center'}});
