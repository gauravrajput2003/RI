import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export function ReportDots() {
  return <View style={styles.dots}>{['#e31947','#22a349','#009cda','#ffbd00'].map(color => <View key={color} style={[styles.dot, { backgroundColor: color }]} />)}</View>;
}
export function FleetBottomTabs({ selected, navigate }: { selected: string; navigate(name: string): void }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 5) }]}>
    <Pressable accessibilityRole="tab" accessibilityLabel="Report" accessibilityState={{ selected: selected === 'reports' }} style={styles.tab} onPress={() => navigate('reports')}><ReportDots /><Text style={[styles.label, selected === 'reports' && styles.active]}>Report</Text></Pressable>
    <Pressable accessibilityRole="tab" accessibilityLabel="Home" accessibilityState={{ selected: selected === 'index' }} style={styles.tab} onPress={() => navigate('index')}><View style={styles.home}><MaterialCommunityIcons name="home-outline" size={27} color="#fff" /></View></Pressable>
    <Pressable accessibilityRole="tab" accessibilityLabel="Profile" accessibilityState={{ selected: selected === 'profile' }} style={styles.tab} onPress={() => navigate('profile')}><MaterialCommunityIcons name="account-tie-outline" size={29} color={selected === 'profile' ? '#ed0508' : '#111'} /><Text style={[styles.label, selected === 'profile' && styles.active]}>Profile</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ bar: { flexDirection: 'row', backgroundColor: '#fff', borderTopColor: '#ededed', borderTopWidth: 1, paddingTop: 6 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46 }, label: { fontSize: 11, color: '#111', lineHeight: 14 }, active: { color: '#ed0508' }, home: { width: 42, height: 42, borderRadius: 23, backgroundColor: '#ee0509', alignItems: 'center', justifyContent: 'center' }, dots: { width: 24, height: 26, flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingTop: 2 }, dot: { width: 9, height: 9, borderRadius: 5 } });
