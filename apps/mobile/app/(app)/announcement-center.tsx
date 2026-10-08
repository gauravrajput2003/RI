import {useState} from 'react';
import {FlatList,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {Feather} from '@expo/vector-icons';
import {router} from 'expo-router';
import {useAnnouncementInbox} from '../../features/announcements/inbox';
import {AnnouncementDialog,announcementText} from '../../components/fleet/AnnouncementDialog';
import type {MobileAnnouncement} from '../../services/api/announcements';

export default function AnnouncementCenter(){
 const q=useAnnouncementInbox(),[search,setSearch]=useState(''),[selected,setSelected]=useState<MobileAnnouncement|null>(null);
 const rows=(q.data?.data??[]).filter(item=>`${item.title} ${announcementText(item.bodyHtml)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 return <View style={styles.page}><View style={styles.header}><Text accessibilityRole="header" style={styles.heading}>Announcement</Text><Pressable accessibilityRole="button" accessibilityLabel="Close Announcement Center" onPress={()=>router.replace('/(app)')} style={styles.close}><Feather name="x" size={27}/></Pressable></View>
 <TextInput accessibilityLabel="Search announcements" placeholder="Search announcements…" value={search} onChangeText={setSearch} style={styles.search}/>
 {q.isError?<Pressable accessibilityRole="button" onPress={()=>void q.refetch()} style={styles.search}><Text>Unable to load announcements. Tap to retry.</Text></Pressable>:null}
 <FlatList data={rows} keyExtractor={item=>item.id} refreshing={q.isFetching} onRefresh={()=>void q.refetch()} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>{q.isLoading?'Loading announcements…':'No announcements found.'}</Text>} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`Read announcement: ${item.title}`} onPress={()=>setSelected(item)} style={styles.card}><View style={styles.row}><Text numberOfLines={1} style={styles.title}>{item.title}</Text>{item.unread?<Text style={styles.unread}>New</Text>:null}</View><Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text><Text numberOfLines={2} style={styles.body}>{item.messageType==='IMAGE'?'Image announcement':announcementText(item.bodyHtml)}</Text><Text style={styles.more}>Tap to read more ›</Text></Pressable>}/>
 <AnnouncementDialog item={selected} onClose={()=>setSelected(null)}/></View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#f6f6f6'},header:{height:54,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',borderBottomWidth:1,borderColor:'#eee'},heading:{fontSize:18,fontWeight:'700'},close:{position:'absolute',right:10,padding:8},search:{backgroundColor:'#fff',borderWidth:1,borderColor:'#e3e3e3',margin:10,borderRadius:8,padding:13,fontSize:15},list:{paddingHorizontal:10,paddingBottom:20,gap:10},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#ddd',borderRadius:9,padding:13,gap:8},row:{flexDirection:'row',gap:10,alignItems:'center'},title:{color:'#ed0509',fontSize:17,fontWeight:'700',flex:1},unread:{color:'#ed0509',fontSize:12,fontWeight:'700'},date:{color:'#888',fontSize:12},body:{fontSize:16,lineHeight:23,color:'#666'},more:{color:'#ed0509',fontWeight:'600',textAlign:'right',borderTopWidth:1,borderColor:'#eee',paddingTop:9},empty:{padding:24,textAlign:'center',color:'#777'}});
