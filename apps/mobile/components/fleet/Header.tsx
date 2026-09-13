import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { config } from '../../constants/config';
import { NoticeSheet, Sheet } from './Sheet';
export function FleetHeader({ title, onSearch }: { title: string; onSearch?(): void }) {
  const [menu, setMenu] = useState(false); const [message, setMessage] = useState<string | null>(null);
  return <><View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Open navigation menu" hitSlop={8} onPress={() => setMenu(true)}><Feather name="menu" size={28} color="#111" /></Pressable>
    <View style={styles.heading}><Text style={styles.title}>{title}</Text>{config.demoMode ? <Text style={styles.demo}>DEMO</Text> : null}</View>
    {onSearch ? <Pressable accessibilityRole="button" accessibilityLabel="Search vehicles" onPress={onSearch} style={styles.action}><Feather name="search" size={21} /></Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Announcements" style={styles.action} onPress={() => setMessage('Announcements are unavailable until a backend is connected.')}><Feather name="volume-2" size={20} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Support" style={styles.action} onPress={() => setMessage('Support contact details have not been configured.')}><Feather name="headphones" size={21} /></Pressable>
  </View>
  <Sheet visible={menu} onClose={() => setMenu(false)} title="Menu">
    {(['Home', 'Report', 'Profile'] as const).map(label => <Pressable key={label} accessibilityRole="button" style={styles.menuItem} onPress={() => { setMenu(false); router.push(label === 'Home' ? '/(app)' : label === 'Report' ? '/(app)/reports' : '/(app)/profile'); }}><Text style={{ fontSize: 17 }}>{label}</Text></Pressable>)}
  </Sheet><NoticeSheet message={message} onClose={() => setMessage(null)} /></>;
}
const styles = StyleSheet.create({ header: { height: 47, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#dedede', gap: 10 }, heading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }, title: { fontSize: 18, fontWeight: '600', color: '#0a0a0a' }, demo: { fontSize: 8, color: '#986b18', fontWeight: '700' }, action: { width: 29, height: 40, justifyContent: 'center', alignItems: 'center' }, menuItem: { padding: 16, borderBottomColor: '#eee', borderBottomWidth: 1 } });
