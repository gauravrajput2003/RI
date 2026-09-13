import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { demoSubscriptions } from '../../features/demo/data';
import type { SubscriptionRecord } from '../../features/profile/types';
import { useQuery } from '@tanstack/react-query';
import { config } from '../../constants/config';
import { getSubscriptions } from '../../services/api/subscriptions';
import { Loading, ErrorState } from '../../components/StateViews';

export default function SubscriptionScreen() {
  const query = useQuery({ queryKey: ['subscriptions'], queryFn: ({ signal }) => getSubscriptions(signal), enabled: !config.demoMode, retry: 1 });
  // Real subscriptions belong to the account; the API provides no vehicle link.
  const subscriptions: (SubscriptionRecord & { status?: string })[] = config.demoMode ? demoSubscriptions : (query.data ?? []).map((item, index) => ({
    id: item.id, badgeIndex: index + 1, vehicle_number: item.plan, status: item.status,
    subscriptionStart: item.starts_at ? new Date(item.starts_at).toLocaleDateString() : 'Unavailable',
    subscriptionDue: item.ends_at ? new Date(item.ends_at).toLocaleDateString() : 'Unavailable',
  }));

  const renderItem = ({ item }: { item: SubscriptionRecord & { status?: string } }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badgeIndex}</Text>
        </View>
        <View><Text style={styles.vehicleNumber}>{item.vehicle_number}</Text>{item.status ? <Text>{item.status}</Text> : null}</View>
      </View>
      <View style={styles.divider} />
      <View style={styles.cardBody}>
        <View style={styles.dateCol}>
          <Text style={styles.startLabel}>Subscription Start</Text>
          <Text style={styles.dateValue}>{item.subscriptionStart}</Text>
        </View>
        <View style={[styles.dateCol, styles.rightCol]}>
          <Text style={styles.dueLabel}>Subscription Due</Text>
          <Text style={[styles.dateValue, styles.rightText]}>{item.subscriptionDue}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Subscription</Text>
      </View>

      {!config.demoMode && query.isLoading ? <Loading message="Loading subscriptions…" /> : !config.demoMode && query.isError ? <ErrorState message="Subscriptions unavailable" retry={() => query.refetch()} /> : <FlatList
        data={subscriptions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text>No subscriptions available.</Text>}
      />}
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
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  badge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  badgeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  vehicleNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  dateCol: {
    flex: 1,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  startLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  dueLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 4,
    textAlign: 'right',
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  rightText: {
    textAlign: 'right',
  },
});
