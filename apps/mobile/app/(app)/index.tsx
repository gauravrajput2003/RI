import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { FleetHeader } from '../../components/fleet/Header';
import { BikeCard } from '../../components/fleet/BikeCard';
import { BikeActions, type BikeAction } from '../../components/fleet/BikeActions';
import { NoticeSheet } from '../../components/fleet/Sheet';
import { demoCardExtras, fleetFilters, matchesFilter, visibleVehicles, type FleetFilter } from '../../features/dashboard/model';
import { useLatestLocation, useVehicles } from '../../features/vehicles/queries';
import { useLiveVehicleStore } from '../../store/liveVehicleStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { config } from '../../constants/config';
import { Loading, ErrorState } from '../../components/StateViews';
import type { Vehicle } from '../../types/models';
const DashboardRow = memo(function DashboardRow({ vehicle, select }: { vehicle: Vehicle; select(vehicle: Vehicle): void }) {
  useLatestLocation(vehicle.id);
  const live = useLiveVehicleStore(state => state.byVehicleId[vehicle.id]);
  const open = useCallback(() => select(vehicle), [vehicle, select]);
  return <BikeCard vehicle={vehicle} live={live} extra={config.demoMode ? demoCardExtras[vehicle.id] : undefined} onPress={open} />;
});
export default function Dashboard() {
  const query = useVehicles(); const vehicles = useMemo(() => query.data?.data ?? [], [query.data]);
  const [filter, setFilter] = useState<FleetFilter>('All'); const [search, setSearch] = useState(''); const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<Vehicle | null>(null); const [message, setMessage] = useState<string | null>(null);
  const ids = useLiveVehicleStore(useShallow(state => visibleVehicles(vehicles, state.byVehicleId, filter, search).map(vehicle => vehicle.id)));
  const counts = useLiveVehicleStore(useShallow(state => fleetFilters.map(item => vehicles.filter(vehicle => matchesFilter(state.byVehicleId[vehicle.id], item.label)).length)));
  const byId = useMemo(() => new Map(vehicles.map(vehicle => [vehicle.id, vehicle])), [vehicles]);
  const rows = useMemo(() => ids.map(id => byId.get(id)!).filter(Boolean), [ids, byId]);
  const select = useCallback((vehicle: Vehicle) => setSelected(vehicle), []);
  const renderRow = useCallback(({ item }: { item: Vehicle }) => <DashboardRow vehicle={item} select={select} />, [select]);
  const action = (name: BikeAction) => {
    if (!selected) return;
    const vehicle = selected; setSelected(null);
    if (name === 'Live Map') { useVehicleStore.getState().setSelected(vehicle.id); router.push('/(app)/map'); }
    else if (name === 'Report') router.push({ pathname: '/(app)/reports', params: { vehicleNumber: vehicle.vehicle_number, vehicleId: vehicle.id } });
    else setMessage((config.demoMode ? 'Demo preview: ' : '') + name + ' for ' + vehicle.vehicle_number + ' is not connected yet. No command was sent and no data was shared.');
  };
  return <View style={styles.page}><FleetHeader title="Dashboard" onSearch={() => setSearchOpen(!searchOpen)} />
    {searchOpen ? <TextInput autoFocus accessibilityLabel="Search dashboard vehicles" placeholder="Search vehicle or account" value={search} onChangeText={setSearch} style={styles.search} /> : null}
    <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{fleetFilters.map((item, index) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label + ' vehicles'} accessibilityState={{ selected: filter === item.label }} onPress={() => setFilter(item.label)} style={[styles.filter, { borderColor: item.color, backgroundColor: filter === item.label ? item.color : '#fff' }]}><Text style={[styles.count, { color: filter === item.label ? '#fff' : item.color }]}>{counts[index]}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.filterLabel, { color: filter === item.label ? '#fff' : item.color }]}>{item.label}</Text></Pressable>)}</ScrollView></View>
    {query.isLoading && !query.data ? <Loading /> : query.isError && !query.data ? <ErrorState message="Unable to load vehicles" retry={() => query.refetch()} /> :
      <FlatList data={rows} keyExtractor={vehicle => vehicle.id} renderItem={renderRow} initialNumToRender={5} maxToRenderPerBatch={5} windowSize={5} contentContainerStyle={styles.cards}
        ListEmptyComponent={<Text style={styles.empty}>No vehicles match this filter.</Text>}
        ListFooterComponent={query.hasNextPage ? <Pressable accessibilityRole="button" disabled={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }} style={styles.more}><Text>Load more vehicles</Text></Pressable> : null} />}
    <BikeActions vehicle={selected?.vehicle_number ?? null} onClose={() => setSelected(null)} onAction={action} />
    <NoticeSheet message={message} onClose={() => setMessage(null)} />
  </View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f7f7f7' }, filters: { paddingHorizontal: 5, paddingTop: 10, paddingBottom: 10, gap: 9 }, filter: { width: 54, flexShrink: 0, height: 49, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 3 }, count: { fontSize: 17 }, filterLabel: { fontSize: 9, textAlign: 'center', maxWidth: '100%', paddingHorizontal: 2 }, cards: { paddingBottom: 5 }, search: { marginHorizontal: 10, marginTop: 8, padding: 10, backgroundColor: '#fff', borderColor: '#ccc', borderWidth: 1, borderRadius: 8 }, empty: { textAlign: 'center', color: '#555', padding: 28 }, more: { padding: 16, alignItems: 'center' } });
