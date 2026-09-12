import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useVehicles } from '../../features/vehicles/queries';
import { LiveVehicleRow } from '../../components/LiveVehicleRow';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';
import type { Vehicle } from '../../types/models';
export default function Vehicles() {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim().toLowerCase()), 250); return () => clearTimeout(timer); }, [search]);
  const query = useVehicles();
  const rows = useMemo(() => (query.data?.data ?? []).filter(vehicle => !term || vehicle.vehicle_number.toLowerCase().includes(term) || vehicle.alias?.toLowerCase().includes(term)), [query.data?.data, term]);
  const renderItem = useCallback(({ item }: { item: Vehicle }) => <LiveVehicleRow vehicle={item} />, []);
  if (query.isLoading && !query.data) return <Loading />;
  if (query.isError && !query.data) return <ErrorState message="Unable to load vehicles" retry={() => query.refetch()} />;
  return <View style={styles.page}>
    <TextInput accessibilityLabel="Search loaded vehicles" onChangeText={setSearch} placeholder="Search loaded vehicles or alias" style={styles.search} value={search} />
    {query.isError ? <Text>Refresh failed. Showing last-known vehicles.</Text> : null}
    <FlatList data={rows} keyExtractor={vehicle => vehicle.id} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7} removeClippedSubviews renderItem={renderItem}
      ListEmptyComponent={<EmptyState message={term ? 'No matching loaded vehicles' : 'No vehicle snapshot available'} />}
      ListFooterComponent={query.hasNextPage ? <Pressable accessibilityRole="button" disabled={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }} style={styles.search}><Text>{query.isFetchingNextPage ? 'Loading…' : 'Load more vehicles'}</Text></Pressable> : null} />
  </View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f8fafc' }, search: { margin: 16, backgroundColor: '#fff', borderRadius: 10, padding: 13, borderWidth: 1, borderColor: '#cbd5e1' } });
