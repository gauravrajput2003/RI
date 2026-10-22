import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { FleetHeader } from '../../components/fleet/Header';
import { BikeCard } from '../../components/fleet/BikeCard';
import { BikeActions, type BikeAction } from '../../components/fleet/BikeActions';
import { NoticeSheet } from '../../components/fleet/Sheet';
import {ReportSheet} from '../../components/fleet/ReportSheet';
import {DriverSheet} from '../../components/fleet/DriverSheet';
import {ParkingSheet} from '../../components/fleet/ParkingSheet';
import {RelaySheet} from '../../components/fleet/RelaySheet';
import {NearbySheet} from '../../components/fleet/NearbySheet';
import {StreetViewSheet,type StreetVehicle} from '../../components/fleet/StreetViewSheet';
import { ShareSheet } from '../../components/fleet/ShareSheet';
import { demoCardExtras, liveCardExtras, fleetFilters, matchesFilter, visibleVehicles, type FleetFilter } from '../../features/dashboard/model';
import { useLatestLocation, useVehicles } from '../../features/vehicles/queries';
import { useLiveVehicleStore } from '../../store/liveVehicleStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { config } from '../../constants/config';
import { stateForVehicle } from '../../features/vehicles/status';
import { Loading, ErrorState } from '../../components/StateViews';
import type { Vehicle } from '../../types/models';
import {useQueryClient} from '@tanstack/react-query';
import {announcementInboxKey} from '../../services/api/announcements';
const DashboardRow = memo(function DashboardRow({ vehicle, select }: { vehicle: Vehicle; select(vehicle: Vehicle): void }) {
  const latest = useLatestLocation(vehicle.id);
  const live = useLiveVehicleStore(state => state.byVehicleId[vehicle.id]);
  const open = useCallback(() => select(vehicle), [vehicle, select]);
  return <BikeCard vehicle={vehicle} live={live} extra={config.demoMode ? demoCardExtras[vehicle.id] : liveCardExtras(vehicle, latest.data, live)} onPress={open} />;
});
export default function Dashboard() {
  const cache=useQueryClient();
  const query = useVehicles(); const vehicles = useMemo(() => query.data?.data ?? [], [query.data]);
  const [filter, setFilter] = useState<FleetFilter>('All'); const [search, setSearch] = useState(''); const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<Vehicle | null>(null); const [message, setMessage] = useState<string | null>(null);
  const [reportVehicle,setReportVehicle]=useState<Vehicle|null>(null);
  const [driverVehicle,setDriverVehicle]=useState<StreetVehicle|null>(null);
  const [parkingVehicle,setParkingVehicle]=useState<StreetVehicle|null>(null);
  const [relayVehicle,setRelayVehicle]=useState<StreetVehicle|null>(null);
  const [nearbyVehicle,setNearbyVehicle]=useState<StreetVehicle|null>(null);
  const [streetVehicle,setStreetVehicle]=useState<StreetVehicle|null>(null);
  const [shareVehicle, setShareVehicle] = useState<Vehicle | null>(null);
  const ids = useLiveVehicleStore(useShallow(state => visibleVehicles(vehicles, state.byVehicleId, filter, search).map(vehicle => vehicle.id)));
  const counts = useLiveVehicleStore(useShallow(state => fleetFilters.map(item => vehicles.filter(vehicle => matchesFilter(state.byVehicleId[vehicle.id], item.label, stateForVehicle(vehicle, state.byVehicleId[vehicle.id]))).length)));
  const byId = useMemo(() => new Map(vehicles.map(vehicle => [vehicle.id, vehicle])), [vehicles]);
  const rows = useMemo(() => ids.map(id => byId.get(id)!).filter(Boolean), [ids, byId]);
  const select = useCallback((vehicle: Vehicle) => setSelected(vehicle), []);
  const renderRow = useCallback(({ item }: { item: Vehicle }) => <DashboardRow vehicle={item} select={select} />, [select]);
  const action = (name: BikeAction) => {
    if (!selected) return;
    const vehicle = selected; setSelected(null);
    if (name === 'Live Map') { useVehicleStore.getState().setSelected(vehicle.id); router.push('/(app)/map'); }
    else if (name === 'Play Back') { router.push({ pathname: '/(app)/playback' as never, params: { vehicleId: vehicle.id, vehicleNumber: vehicle.vehicle_number } }); }
    else if (name === 'Driver') { setDriverVehicle(vehicle); }
    else if (name === 'Parking') { setParkingVehicle(vehicle); }
    else if (name === 'Lock') { setRelayVehicle(vehicle); }
    else if (name === 'NearBy') { setNearbyVehicle(vehicle); }
    else if (name === 'Street View') { setStreetVehicle(vehicle); }
    else if (name === 'Share') { setShareVehicle(vehicle); }
    else if (name === 'Edit') router.push({pathname:'/(app)/edit-vehicle',params:{vehicleId:vehicle.id}});
    else if (name === 'Notification') router.push({pathname:'/(app)/notifications',params:{vehicleId:vehicle.id}});
    else if (name === 'Report') setReportVehicle(vehicle);
    else setMessage((config.demoMode ? 'Demo preview: ' : '') + name + ' for ' + vehicle.vehicle_number + ' is not connected yet. No command was sent and no data was shared.');
  };
  return <View style={styles.page}><FleetHeader title="Dashboard" onSearch={() => setSearchOpen(!searchOpen)} />
    {searchOpen ? <TextInput autoFocus accessibilityLabel="Search dashboard vehicles" placeholder="Search vehicle or account" value={search} onChangeText={setSearch} style={styles.search} /> : null}
    <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{fleetFilters.map((item, index) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label + ' vehicles'} accessibilityState={{ selected: filter === item.label }} onPress={() => setFilter(item.label)} style={[styles.filter, { borderColor: item.color, backgroundColor: filter === item.label ? item.color : '#fff' }]}><Text style={[styles.count, { color: filter === item.label ? '#fff' : item.color }]}>{counts[index]}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.filterLabel, { color: filter === item.label ? '#fff' : item.color }]}>{item.label}</Text></Pressable>)}</ScrollView></View>
    {query.isLoading && !query.data ? <Loading /> : query.isError && !query.data ? <ErrorState message="Unable to load vehicles" retry={() => query.refetch()} /> :
      <FlatList data={rows} keyExtractor={vehicle => vehicle.id} renderItem={renderRow} initialNumToRender={5} maxToRenderPerBatch={5} windowSize={5} contentContainerStyle={styles.cards}
        refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); void cache.invalidateQueries({queryKey:announcementInboxKey}); }}
        ListEmptyComponent={<Text style={styles.empty}>{vehicles.length ? 'No vehicles match this filter.' : 'No vehicles assigned to your account yet.'}</Text>}
        ListFooterComponent={query.hasNextPage ? <Pressable accessibilityRole="button" disabled={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }} style={styles.more}><Text>Load more vehicles</Text></Pressable> : null} />}
    <BikeActions vehicle={selected?.vehicle_number ?? null} onClose={() => setSelected(null)} onAction={action} />
    <ShareSheet vehicleNumber={shareVehicle?.vehicle_number??null} vehicleId={shareVehicle?.id} onClose={() => setShareVehicle(null)} />
    <ReportSheet visible={Boolean(reportVehicle)} onClose={()=>setReportVehicle(null)} onSelect={kind=>{if(!reportVehicle)return;const vehicle=reportVehicle;setReportVehicle(null);router.push({pathname:'/(app)/report',params:{kind,vehicleId:vehicle.id,vehicleNumber:vehicle.vehicle_number}});}}/>
    <DriverSheet vehicle={driverVehicle} onClose={()=>setDriverVehicle(null)}/>
    <ParkingSheet vehicle={parkingVehicle} onClose={()=>setParkingVehicle(null)}/>
    <RelaySheet vehicle={relayVehicle} onClose={()=>setRelayVehicle(null)}/>
    <NearbySheet vehicle={nearbyVehicle} onClose={()=>setNearbyVehicle(null)}/>
    <StreetViewSheet vehicle={streetVehicle} onClose={()=>setStreetVehicle(null)} />
    <NoticeSheet message={message} onClose={() => setMessage(null)} />
  </View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f7f7f7' }, filters: { paddingHorizontal: 5, paddingTop: 10, paddingBottom: 10, gap: 9 }, filter: { width: 54, flexShrink: 0, height: 49, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 3 }, count: { fontSize: 17 }, filterLabel: { fontSize: 9, textAlign: 'center', maxWidth: '100%', paddingHorizontal: 2 }, cards: { paddingBottom: 5 }, search: { marginHorizontal: 10, marginTop: 8, padding: 10, backgroundColor: '#fff', borderColor: '#ccc', borderWidth: 1, borderRadius: 8 }, empty: { textAlign: 'center', color: '#555', padding: 28 }, more: { padding: 16, alignItems: 'center' } });
