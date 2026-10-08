import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, FontAwesome6 } from '@expo/vector-icons';
import { VehicleActions } from '../../components/fleet/VehicleActions';
import { ShareSheet } from '../../components/fleet/ShareSheet';
import { useAccount } from '../../services/api/mobile';
import { capabilities } from '../../features/account/capabilities';
import { useLiveVehicleStore } from '../../store/liveVehicleStore';
import { router } from 'expo-router';
import { VehicleVisual } from '../../components/fleet/VehicleVisual';
import { vehicleDetails } from '../../features/profile/vehicle-details';
import { Loading, ErrorState } from '../../components/StateViews';
import { useVehicles } from '../../features/vehicles/queries';
import { config } from '../../constants/config';
import type { VehicleCardDetail } from '../../features/profile/types';

export default function VehiclesScreen() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const account=useAccount(),caps=capabilities(account.data);
  const [selected,setSelected]=useState<VehicleCardDetail|null>(null),[share,setShare]=useState<VehicleCardDetail|null>(null);

  const query = useVehicles();

  const live=useLiveVehicleStore(state=>state.byVehicleId);
  const vehicles = useMemo(() => vehicleDetails(query.data?.data.map(vehicle=>({...vehicle,latestLocation:live[vehicle.id]??vehicle.latestLocation})), config.demoMode), [query.data,live]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return vehicles;
    return vehicles.filter(
      (v) =>
        v.vehicle_number.toLowerCase().includes(term) ||
        v.alias.toLowerCase().includes(term)
    );
  }, [vehicles, search]);

  const renderCard = ({ item }: { item: VehicleCardDetail }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${item.vehicle_number}`} onPress={()=>setSelected(item)} style={styles.card}>
      <View style={styles.cardHeader}>
        <VehicleVisual visual={item.visual} />
        <View style={styles.headerRight}>
          <Text style={styles.plateText}>{item.vehicle_number}</Text>
          <Text style={styles.timestampText}>{item.timestamp}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Speed</Text>
            <Text style={styles.value}>{item.speed ?? '—'}</Text>
          </View>
          <View style={[styles.col, styles.rightAlign]}>
            <Text style={styles.label}>Overspeed</Text>
            <Text style={styles.value}>{item.overspeed ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Mileage</Text>
            <Text style={styles.value}>{item.mileage ?? '—'}</Text>
          </View>
          <View style={[styles.col, styles.rightAlign]}>
            <Text style={styles.label}>Odometer</Text>
            <Text style={styles.value}>{item.odometer ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Alias</Text>
            <Text style={styles.value} numberOfLines={1}>{item.alias || '—'}</Text>
          </View>
          <View style={[styles.col, styles.rightAlign]}>
            <Text style={styles.label}>Remark</Text>
            <Text style={styles.value}>{item.remark || '—'}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Subscription Start</Text>
            <Text style={styles.value}>{item.subscriptionStart}</Text>
          </View>
          <View style={[styles.col, styles.rightAlign]}>
            <Text style={styles.label}>Subscription Due</Text>
            <Text style={styles.value}>{item.subscriptionDue}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.replace('/(app)')}
          hitSlop={10}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Vehicle List</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle search"
          onPress={() => setSearchOpen(!searchOpen)}
          hitSlop={10}
          style={styles.searchButton}
        >
          <Feather name="search" size={22} color="#111" />
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={styles.searchContainer}>
          <TextInput
            autoFocus
            accessibilityLabel="Search vehicles"
            placeholder="Search vehicle number or alias..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
      ) : null}

      {!config.demoMode && query.isLoading && !query.data ? <Loading /> : !config.demoMode && query.isError && !query.data ? <ErrorState message="Unable to load vehicles" retry={() => query.refetch()} /> : <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{search.trim() ? 'No vehicles match your search.' : 'No vehicles available.'}</Text>}
        ListFooterComponent={query.hasNextPage?<Pressable accessibilityRole="button" disabled={query.isFetchingNextPage} onPress={()=>void query.fetchNextPage()} style={{padding:16,alignItems:'center'}}><Text>Load more vehicles</Text></Pressable>:null}
      />}
      {caps.addVehicle?<Pressable accessibilityRole="button" accessibilityLabel="Add Vehicle" onPress={()=>router.push('/(app)/add-vehicle')} style={{position:'absolute',bottom:28,right:20,minWidth:52,minHeight:52,alignItems:'center',justifyContent:'center',backgroundColor:'#fff',borderRadius:28,elevation:4}}><FontAwesome6 name="circle-plus" size={48} color="#ee0509"/></Pressable>:null}
      <VehicleActions vehicle={selected} onClose={()=>setSelected(null)} onShare={()=>{setShare(selected);setSelected(null)}}/>
      <ShareSheet vehicleNumber={share?.vehicle_number??null} vehicleId={share?.id} onClose={()=>setShare(null)}/>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    height: 52,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  searchButton: {
    padding: 6,
  },
  searchContainer: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  list: {
    padding: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  plateText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: 0.5,
  },
  timestampText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0891b2',
    marginTop: 3,
  },
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    flex: 1,
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    padding: 32,
    fontSize: 15,
  },
});
