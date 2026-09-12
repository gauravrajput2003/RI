import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useShallow } from 'zustand/react/shallow';
import { useLatestLocation, useVehicles } from '../../features/vehicles/queries';
import { useLiveVehicleStore } from '../../store/liveVehicleStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { Loading, EmptyState } from '../../components/StateViews';
import { followRegion, hasPosition, visibleIds } from './viewport';

const VehicleMarker = memo(function VehicleMarker({ id, title, selected }: { id: string; title?: string; selected: boolean }) {
  const point = useLiveVehicleStore(state => state.byVehicleId[id]);
  const select = useCallback(() => useVehicleStore.getState().setSelected(id), [id]);
  if (!hasPosition(point)) return null;
  return <Marker coordinate={{ latitude: point.latitude, longitude: point.longitude }} rotation={point.course ?? 0} title={title} onPress={select} pinColor={selected ? '#0f766e' : undefined} tracksViewChanges={false} />;
});
export default function LiveMap() {
  const map = useRef<MapView>(null);
  const vehicles = useVehicles();
  const selected = useVehicleStore(state => state.selectedVehicleId);
  useLatestLocation(selected ?? vehicles.data?.data[0]?.id ?? '');
  const follow = useVehicleStore(state => state.followSelected);
  const point = useLiveVehicleStore(state => selected ? state.byVehicleId[selected] : undefined);
  const firstId = useLiveVehicleStore(state => Object.keys(state.byVehicleId).find(id => hasPosition(state.byVehicleId[id])));
  const initialRegion = useRef<Region | null>(null);
  if (!initialRegion.current && firstId) {
    const position = useLiveVehicleStore.getState().byVehicleId[firstId];
    if (hasPosition(position)) initialRegion.current = { latitude: position.latitude, longitude: position.longitude, latitudeDelta: .2, longitudeDelta: .2 };
  }
  const [region, setRegion] = useState<Region>();
  const regionRef = useRef(region);
  const markerIds = useLiveVehicleStore(useShallow(state => visibleIds(state.byVehicleId, region ?? initialRegion.current ?? undefined, selected)));
  const titles = useMemo(() => new Map(vehicles.data?.data.map(vehicle => [vehicle.id, vehicle.vehicle_number]) ?? []), [vehicles.data]);
  useEffect(() => {
    const next = followRegion(point, follow, regionRef.current);
    if (next) map.current?.animateToRegion(next, 250);
  }, [selected, follow, point?.latitude, point?.longitude]);
  const moved = useCallback((next: Region) => { regionRef.current = next; setRegion(next); }, []);
  const pan = useCallback(() => useVehicleStore.getState().setFollow(false), []);
  if (vehicles.isLoading && !vehicles.data) return <Loading />;
  if (!firstId || !initialRegion.current) return <EmptyState message="No last-known vehicle positions available. Open the vehicle list to load latest states." />;
  return <View style={styles.page}><MapView ref={map} style={styles.map}
    initialRegion={initialRegion.current} onRegionChangeComplete={moved} onPanDrag={pan}>
    {markerIds.map(id => <VehicleMarker key={id} id={id} title={titles.get(id)} selected={selected === id} />)}
  </MapView><View style={styles.panel}><Text>{markerIds.length} visible/selected last-known positions</Text>
    {selected ? <Pressable accessibilityRole="button" onPress={() => useVehicleStore.getState().setFollow(!follow)}><Text style={styles.follow}>{follow ? 'Following selected vehicle' : 'Follow selected vehicle'}</Text></Pressable> : <Text>Select a marker to follow it</Text>}
  </View></View>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, map: { flex: 1 }, panel: { padding: 12, backgroundColor: '#fff', gap: 6 }, follow: { color: '#0f766e', fontWeight: '800' } });
