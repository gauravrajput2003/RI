import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { FleetHeader } from '../../components/fleet/Header';
import { NoticeSheet } from '../../components/fleet/Sheet';
import { searchReports } from '../../features/reports/catalog';
import { config } from '../../constants/config';
export default function Reports() {
  const [search, setSearch] = useState(''); const [list, setList] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const { vehicleNumber } = useLocalSearchParams<{ vehicleNumber?: string }>();
  const reports = useMemo(() => searchReports(search), [search]);
  return <View style={styles.page}><FleetHeader title="Reports" />
    <View style={styles.searchRow}><View style={styles.searchBox}><Feather name="search" size={24} color="#555" /><TextInput accessibilityLabel="Search reports" value={search} onChangeText={setSearch} placeholder="Search" placeholderTextColor="#888" style={styles.input} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={list ? 'Show report grid' : 'Show report list'} onPress={() => setList(!list)}><MaterialCommunityIcons name={list ? 'view-grid' : 'format-list-bulleted'} size={39} color="#ef080c" /></Pressable>
    </View>
    {vehicleNumber ? <Text style={styles.context}>Reports for {vehicleNumber}</Text> : null}
    <FlatList key={list ? 'list' : 'grid'} data={reports} numColumns={list ? 1 : 2} keyExtractor={item => item.id} contentContainerStyle={styles.content} columnWrapperStyle={list ? undefined : styles.columns}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={() => setMessage((config.demoMode ? 'Demo preview: ' : '') + item.title + ' needs the reports API. No report has been generated.')} style={[styles.card, list && styles.listCard]}>
        {['distance','travel','idle','stoppage'].includes(item.id) ? <Text style={styles.emoji}>{item.id === 'distance' ? '📝' : item.icon}</Text> : <MaterialCommunityIcons name={item.symbol} size={55} color={item.color} />}
        <Text style={styles.label}>{item.title}</Text></Pressable>}
      ListEmptyComponent={<Text style={styles.empty}>No reports match your search.</Text>} />
    <NoticeSheet message={message} onClose={() => setMessage(null)} />
  </View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f7f7f7' }, searchRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 15, paddingBottom: 14, alignItems: 'center', gap: 7 }, searchBox: { flex: 1, height: 43, borderRadius: 8, borderWidth: 1, borderColor: '#b9b9b9', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 15 }, input: { flex: 1, fontSize: 16, paddingVertical: 6, color: '#333' }, content: { paddingHorizontal: 12, paddingBottom: 15 }, columns: { justifyContent: 'space-between' }, card: { width: '45.5%', minHeight: 157, marginBottom: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e6e6e6', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 12, elevation: 3, boxShadow: '0px 3px 4px #00000024' }, listCard: { width: '100%', minHeight: 84, flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 20, gap: 24 }, emoji: { fontSize: 49, lineHeight: 61 }, label: { fontSize: 16, color: '#111', textAlign: 'center' }, context: { paddingHorizontal: 14, marginBottom: 10, fontSize: 12, color: '#555' }, empty: { textAlign: 'center', padding: 30, color: '#555' } });
