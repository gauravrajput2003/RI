import {useEffect,useState} from 'react';
import {Image,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useQueryClient} from '@tanstack/react-query';
import {Check} from '../MobileForm';
import {announcementInboxKey,hideAnnouncementPopup,readAnnouncement,type MobileAnnouncement} from '../../services/api/announcements';
import {mobileMessage,requireOnline} from '../../services/api/mobile';

export const announcementText=(html:string|null)=> (html??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|li)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/[ \t]+/g,' ').trim();

export function AnnouncementDialog({item,onClose}:{item:MobileAnnouncement|null;onClose():void}){
 const cache=useQueryClient(),[hide,setHide]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[imageFailed,setImageFailed]=useState(false);
 useEffect(()=>{setHide(false);setError('');setImageFailed(false);if(item){void readAnnouncement(item.id).then(()=>cache.invalidateQueries({queryKey:announcementInboxKey})).catch(e=>setError(mobileMessage(e)))}},[item,cache]);
 async function close(){if(!item||busy)return;setBusy(true);try{requireOnline();await readAnnouncement(item.id);if(hide)await hideAnnouncementPopup(item.id);await cache.invalidateQueries({queryKey:announcementInboxKey});onClose()}catch(e){setError(mobileMessage(e))}finally{setBusy(false)}}
 return <Modal visible={Boolean(item)} transparent animationType="fade" onRequestClose={()=>void close()}><View style={styles.overlay}><View accessibilityViewIsModal style={styles.dialog}>
 <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{item?.title}</Text></View>
 <ScrollView style={styles.body}>{item?.messageType==='IMAGE'?(item.imageUrl&&!imageFailed?<Image source={{uri:item.imageUrl}} accessibilityLabel={item.title} resizeMode="contain" style={styles.image} onError={()=>setImageFailed(true)}/>:<Text>Image unavailable</Text>):<Text style={styles.text}>{announcementText(item?.bodyHtml??null)}</Text>}</ScrollView>
 <View style={styles.footer}><Check label="Don't Show Again" checked={hide} onPress={()=>setHide(!hide)}/>{error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}<Pressable accessibilityRole="button" accessibilityLabel="Close announcement" disabled={busy} onPress={()=>void close()} style={styles.close}><Text style={styles.closeText}>{busy?'Saving…':'Close'}</Text></Pressable></View>
 </View></View></Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,backgroundColor:'#0009',alignItems:'center',justifyContent:'center',padding:24},dialog:{width:'100%',maxWidth:440,maxHeight:'80%',backgroundColor:'#fff',borderRadius:5,overflow:'hidden'},header:{backgroundColor:'#ed0509',padding:17},title:{fontSize:18,fontWeight:'700',color:'#fff',textAlign:'center'},body:{flexGrow:0,padding:16},text:{fontSize:16,lineHeight:25,color:'#111'},image:{height:260,width:'100%'},footer:{padding:14,borderTopWidth:1,borderColor:'#ddd'},close:{alignSelf:'center',backgroundColor:'#ed0509',paddingVertical:9,paddingHorizontal:19,borderRadius:5,marginTop:10},closeText:{color:'#fff',fontWeight:'700'},error:{color:'#b00020',marginTop:6}});
