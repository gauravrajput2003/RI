import { useCallback,useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, FontAwesome6, MaterialCommunityIcons } from '@expo/vector-icons';
import { router,useFocusEffect } from 'expo-router';

import { useAccount } from '../../services/api/mobile';
import { config } from '../../constants/config';
import { Sheet } from './Sheet';
import type {MobileAnnouncement} from '../../services/api/announcements';
import {useAnnouncementInbox} from '../../features/announcements/inbox';
import {AnnouncementDialog} from './AnnouncementDialog';
export function FleetHeader({ title, onSearch }: { title: string; onSearch?(): void }) {
  const account=useAccount();
  const inbox=useAnnouncementInbox();
  const [focused,setFocused]=useState(false);
  useFocusEffect(useCallback(()=>{setFocused(true);return()=>setFocused(false)},[]));
  const [menu,setMenu]=useState(false),[current,setCurrent]=useState<MobileAnnouncement|null>(null);
  const shown=useRef(new Set<string>()),principal=useRef<string|undefined>(undefined);
  useEffect(()=>{if(principal.current!==account.data?.id){shown.current.clear();principal.current=account.data?.id;setCurrent(null)}},[account.data?.id]);
  useEffect(()=>{if(!focused||title!=='Dashboard'||current)return;const next=inbox.data?.data.find(item=>item.unread&&!item.dismissed&&!shown.current.has(`${item.id}:${item.updatedAt}`));if(next){shown.current.add(`${next.id}:${next.updatedAt}`);setCurrent(next)}},[focused,title,current,inbox.data]);
  return <><View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Open navigation menu" hitSlop={8} onPress={() => setMenu(true)}><Feather name="menu" size={28} color="#111" /></Pressable>
    <View style={styles.heading}><Text style={styles.title}>{title}</Text>{config.demoMode ? <Text style={styles.demo}>DEMO</Text> : null}</View>
    {onSearch ? <Pressable accessibilityRole="button" accessibilityLabel="Search vehicles" onPress={onSearch} style={styles.action}><FontAwesome6 name="magnifying-glass" size={17} color="#111" /></Pressable> : null}
    {account.data?<Pressable accessibilityRole="button" accessibilityLabel={`Announcements${inbox.data?.unreadCount?`, ${inbox.data.unreadCount} unread`:''}`} style={styles.action} onPress={()=>router.push('/(app)/announcement-center')}><MaterialCommunityIcons name="bullhorn-outline" size={21} color="#111"/>{inbox.data?.unreadCount?<View style={styles.badge}><Text style={styles.badgeText}>{inbox.data.unreadCount}</Text></View>:null}{inbox.isError?<Text style={{color:'#d71920'}}>!</Text>:null}</Pressable>:null}
    <Pressable accessibilityRole="button" accessibilityLabel="Support" style={styles.action} onPress={() => router.push('/(app)/contact')}><FontAwesome6 name="headset" size={18} color="#111" /></Pressable>
  </View>
  <Sheet visible={menu} onClose={() => setMenu(false)} title="Menu">
    {(['Home', 'Report', 'Profile'] as const).map(label => <Pressable key={label} accessibilityRole="button" style={styles.menuItem} onPress={() => { setMenu(false); router.push(label === 'Home' ? '/(app)' : label === 'Report' ? '/(app)/reports' : '/(app)/profile'); }}><Text style={{ fontSize: 17 }}>{label}</Text></Pressable>)}
  </Sheet><AnnouncementDialog item={focused?current:null} onClose={()=>setCurrent(null)}/></>;
}
const styles = StyleSheet.create({ header: { height: 47, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#dedede', gap: 10 }, heading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }, title: { fontSize: 18, fontWeight: '600', color: '#0a0a0a' }, demo: { fontSize: 8, color: '#986b18', fontWeight: '700' }, action: { width: 29, height: 40, justifyContent: 'center', alignItems: 'center' }, badge:{position:'absolute',right:-2,top:2,minWidth:15,height:15,borderRadius:8,backgroundColor:'#d71920',alignItems:'center',justifyContent:'center',paddingHorizontal:3},badgeText:{color:'#fff',fontSize:9,fontWeight:'800'}, menuItem: { padding: 16, borderBottomColor: '#eee', borderBottomWidth: 1 },announcementBody:{fontSize:16,lineHeight:24,color:'#27384a',padding:12,minHeight:90},announcementActions:{flexDirection:'row',justifyContent:'flex-end',gap:8,paddingVertical:12},secondary:{paddingVertical:11,paddingHorizontal:16,borderWidth:1,borderColor:'#ccd6de',borderRadius:8},closeAnnouncement:{paddingVertical:11,paddingHorizontal:20,backgroundColor:'#0a416c',borderRadius:8},closeText:{color:'#fff',fontWeight:'700'} });
