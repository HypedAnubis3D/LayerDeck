import { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../navigation/OrdersStackNavigator';
import { useCollection } from '../lib/useCollection';
import { colors } from '../lib/theme';
import type { Order } from '../types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrdersList'>;

const STATUS_FILTERS = ['all', 'pending', 'shipped', 'cancelled'];

export default function OrdersListScreen({ navigation }: Props) {
  const { items: orders, loading, refreshing, error, refresh } = useCollection<Order>('orders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');

  const platforms = useMemo(() => {
    const set = new Set(orders.map((o) => o.platform).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [orders]);

  const filtered = useMemo(() => {
    return orders
      .filter((o) => statusFilter === 'all' || o.status === statusFilter)
      .filter((o) => platformFilter === 'all' || o.platform === platformFilter)
      .filter((o) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          o.customer?.toLowerCase().includes(q) ||
          o.orderId?.toLowerCase().includes(q) ||
          o.trackingNumber?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [orders, search, statusFilter, platformFilter]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TextInput
          style={styles.search}
          placeholder="Search customer, order ID, tracking..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <Pressable style={styles.newButton} onPress={() => navigation.navigate('OrderDetail', undefined)}>
          <Text style={styles.newButtonText}>+ New</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      {platforms.length > 1 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={platforms}
          keyExtractor={(p) => p}
          style={styles.platformRow}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item: p }) => (
            <Pressable
              style={[styles.filterChip, platformFilter === p && styles.filterChipActive]}
              onPress={() => setPlatformFilter(p)}
            >
              <Text style={[styles.filterText, platformFilter === p && styles.filterTextActive]}>{p}</Text>
            </Pressable>
          )}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No orders match.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { borderLeftColor: statusAccent(item.status), borderLeftWidth: 3 }]}
            onPress={() => navigation.navigate('OrderDetail', { order: item })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.customer}>{item.customer || 'Unnamed customer'}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.meta}>
              {item.orderId} · {item.platform} · {item.items?.length ?? 0} item(s)
            </Text>
            {!!item.trackingNumber && (
              <Text style={styles.tracking}>Tracking: {item.trackingNumber}</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

function statusAccent(status: string): string {
  if (status === 'shipped') return '#22c55e';
  if (status === 'cancelled') return '#ef4444';
  return '#f59e0b';
}

function StatusBadge({ status }: { status: string }) {
  const fg = statusAccent(status);
  return (
    <View style={[styles.badge, { backgroundColor: `${fg}33` }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{status || 'pending'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  search: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  newButtonText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  platformRow: { marginBottom: 8, flexGrow: 0 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: 13, textTransform: 'capitalize' },
  filterTextActive: { color: colors.bg, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customer: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  tracking: { color: colors.accent, fontSize: 13, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  error: { color: colors.danger, marginHorizontal: 16, marginBottom: 8 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
