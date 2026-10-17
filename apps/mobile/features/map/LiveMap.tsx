import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {NearbySheet} from '../../components/fleet/NearbySheet';
import {StreetViewSheet,type StreetVehicle} from '../../components/fleet/StreetViewSheet';
import MapView, { type Region,type MapHandle } from './LeafletMap';
import {VehicleMarker} from '../../components/VehicleMarker';
import type {Vehicle} from '../../types/models';
import {stateForVehicle,currentSpeedForVehicle} from '../vehicles/status';
import { useShallow } from 'zustand/react/shallow';
import { useLatestLocation, useVehicles } from '../../features/vehicles/queries';
import { useLiveVehicleStore } from '../../store/liveVehicleStore';
import { useVehicleStore } from '../../store/vehicleStore';
import { Loading, EmptyState } from '../../components/StateViews';
import { followRegion, hasPosition, visibleIds } from './viewport';

const LiveVehicleMarker = memo(function LiveVehicleMarker({ id, vehicle, selected }: { id: string; vehicle?:Vehicle; selected: boolean }) {
  const point = useLiveVehicleStore(state => state.byVehicleId[id]);
  const select = useCallback(() => useVehicleStore.getState().setSelected(id), [id]);
  if (!hasPosition(point)) return null;
  return <VehicleMarker vehicle={{id,vehicle_number:vehicle?.vehicle_number,vehicle_type:vehicle?.vehicle_type,latitude:point.latitude,longitude:point.longitude,course:point.course,state:vehicle?stateForVehicle(vehicle,point):point.state,speed:(vehicle?currentSpeedForVehicle(vehicle,point):point.current_speed)??point.speed,ignition:point.ignition,lastSeen:point.last_seen_at??vehicle?.last_seen_at??point.server_received_at}} onPress={select} selected={selected}/>;
});
export default function LiveMap() {
  const [nearbyVehicle,setNearbyVehicle]=useState<StreetVehicle|null>(null);
  const [streetVehicle,setStreetVehicle]=useState<StreetVehicle|null>(null);
  const map = useRef<MapHandle>(null);
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
  const records = useMemo(() => new Map(vehicles.data?.data.map(vehicle => [vehicle.id, vehicle]) ?? []), [vehicles.data]);
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
    {markerIds.map(id => <LiveVehicleMarker key={id} id={id} vehicle={records.get(id)} selected={selected === id} />)}
  </MapView><View style={styles.panel}><Text>{markerIds.length} visible/selected last-known positions</Text>
    {selected ? <Pressable accessibilityRole="button" accessibilityLabel="Toggle follow selected vehicle" onPress={() => useVehicleStore.getState().setFollow(!follow)}><Text style={styles.follow}>{follow ? 'Following selected vehicle' : 'Follow selected vehicle'}</Text></Pressable> : <Text>Select a marker to follow it</Text>}
    {selected&&records.get(selected)?<Pressable accessibilityRole="button" accessibilityLabel="Selected vehicle Street View" onPress={()=>setStreetVehicle(records.get(selected!)!)}><Text style={styles.follow}>Street View · {records.get(selected)?.vehicle_number}</Text></Pressable>:null}
    {selected&&records.get(selected)?<Pressable accessibilityRole="button" accessibilityLabel="Selected vehicle Nearby" onPress={()=>setNearbyVehicle(records.get(selected!)!)}><Text style={styles.follow}>Nearby · {records.get(selected)?.vehicle_number}</Text></Pressable>:null}
  </View><NearbySheet vehicle={nearbyVehicle} onClose={()=>setNearbyVehicle(null)}/><StreetViewSheet vehicle={streetVehicle} onClose={()=>setStreetVehicle(null)}/></View>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, map: { flex: 1 }, panel: { padding: 12, backgroundColor: '#fff', gap: 6 }, follow: { color: '#0f766e', fontWeight: '800' } });
