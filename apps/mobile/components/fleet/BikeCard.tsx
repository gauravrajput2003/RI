import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Location, Vehicle } from '../../types/models';
import type { CardExtras } from '../../features/dashboard/model';
import { MetricIcon, type MetricIconKind } from './MetricIcon';
function Metric({ label, value, icon }: { label: string; value: string; icon: MetricIconKind }) {
  return <View style={styles.metric}><View style={styles.metricIcon}><MetricIcon kind={icon} /></View><View style={styles.metricText}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View></View>;
}
export const BikeCard = memo(function BikeCard({ vehicle, live, extra, onPress }: { vehicle: Vehicle; live?: Location; extra?: CardExtras; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={'Open actions for ' + vehicle.vehicle_number} onPress={onPress} style={styles.card}>
    <View style={styles.top}>
      <View style={styles.identity}><Text style={styles.bike}>{extra?.visual === 'scooter' ? '🛵' : '🏍️'}</Text><Text style={styles.number}>{vehicle.vehicle_number}</Text><Text numberOfLines={2} style={styles.alias}>({vehicle.alias ?? 'Vehicle'})</Text></View>
      <View style={styles.metrics}>
        <Metric label="KM" value={extra?.distance ?? '—'} icon="distance" />
        <Metric label="Fuel" value={extra?.fuel ?? '—'} icon="fuel" />
        <Metric label="Speed" value={live?.speed == null ? '—' : String(Math.round(live.speed))} icon="speed" />
        <Metric label="Max Speed" value={extra?.maxSpeed ?? '—'} icon="maxSpeed" />
        <Metric label="Since" value={extra?.since ?? '—'} icon="since" />
        <Metric label="Last Sync" value={extra?.lastSync ?? (live ? new Date(live.server_received_at).toLocaleString() : '—')} icon="lastSync" />
      </View>
    </View>
    <View style={styles.indicators}>
      <MaterialCommunityIcons name="snowflake" size={21} color="#c5c8ca" />
      <MaterialCommunityIcons name="key" size={24} color={live?.ignition ? '#23ad12' : '#ff123b'} />
      <View style={styles.gps}><MaterialCommunityIcons name="crosshairs-gps" size={23} color="#151515" /><Text style={styles.gpsCount}>{live?.satellites ?? '—'}</Text></View>
      <MaterialCommunityIcons name="battery" size={28} style={{ transform: [{ rotate: '90deg' }] }} color={live?.battery_percent == null ? '#c5c8ca' : '#5a9b5e'} />
      <MaterialCommunityIcons name="signal" size={24} color={live?.gsm_signal == null ? '#c5c8ca' : '#1ab400'} />
    </View>
    <View style={styles.address}><MaterialCommunityIcons name="sign-direction" size={25} color="#432568" /><Text style={styles.addressText}>{extra?.address ?? 'Address unavailable'}</Text></View>
  </Pressable>;
});
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', marginHorizontal: 9, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e7e7e7', elevation: 3, boxShadow: '0px 2px 4px #00000020', overflow: 'hidden' },
  top: { flexDirection: 'row', padding: 12, paddingBottom: 5, minHeight: 162, gap: 7 },
  identity: { width: '35%', alignItems: 'center' }, bike: { fontSize: 62, lineHeight: 69, marginBottom: 5 }, number: { fontSize: 16, fontWeight: '700', color: '#210c43', textAlign: 'center' }, alias: { fontSize: 12, color: '#28184b', textAlign: 'center', marginTop: 4, lineHeight: 16 },
  metrics: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', gap: 4 },
  metric: { width: '48%', minHeight: 39, flexDirection: 'row', borderWidth: 1, borderColor: '#f0f0f2', borderRadius: 4, paddingHorizontal: 3, paddingVertical: 4, gap: 4, alignItems: 'flex-start' },
  metricIcon: { borderWidth: 1, borderColor: '#efeff1', borderRadius: 4, padding: 1 }, metricText: { flex: 1 }, metricLabel: { fontSize: 10, fontWeight: '600', color: '#210c43', marginBottom: 2 }, metricValue: { fontSize: 10, color: '#444', lineHeight: 12 },
  indicators: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#eee', height: 31 },
  gps: { alignItems: 'center', justifyContent: 'center' }, gpsCount: { position: 'absolute', fontSize: 8, backgroundColor: '#fff', color: '#222' },
  address: { flexDirection: 'row', paddingHorizontal: 11, paddingTop: 4, paddingBottom: 12, alignItems: 'flex-start', gap: 3 }, addressText: { flex: 1, fontSize: 12, lineHeight: 16, color: '#4d4d4d' },
});
