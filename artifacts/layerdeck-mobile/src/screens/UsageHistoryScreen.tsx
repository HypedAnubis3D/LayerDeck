import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useCollection } from '../lib/useCollection';
import { colors } from '../lib/theme';
import type { UsageHistEntry } from '../types';

export default function UsageHistoryScreen() {
  const { items, loading } = useCollection<UsageHistEntry>('usageHist');
  const [spoolFilter, setSpoolFilter] = useState('all');

  const spoolNames = useMemo(() => {
    const set = new Set(items.map((i) => i.spoolName).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    return items
      .filter((i) => spoolFilter === 'all' || i.spoolName === spoolFilter)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [items, spoolFilter]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={spoolNames}
        keyExtractor={(s) => s}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item: s }) => (
          <Pressable
            style={[styles.chip, spoolFilter === s && styles.chipActive]}
            onPress={() => setSpoolFilter(s)}
          >
            <Text style={[styles.chipText, spoolFilter === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No usage history yet.</Text>}
        renderItem={({ item }) => {
          const isRefund = item.amount < 0;
          return (
            <View
              style={[styles.card, { borderLeftColor: isRefund ? colors.success : colors.accent, borderLeftWidth: 3 }]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.job} numberOfLines={1}>{item.job}</Text>
                <Text style={[styles.amount, { color: isRefund ? colors.success : colors.text }]}>
                  {isRefund ? '+' : '-'}
                  {Math.abs(item.amount).toFixed(1)}g
                </Text>
              </View>
              <Text style={styles.meta}>
                {item.spoolName} ({item.material}) · {new Date(item.timestamp).toLocaleString()}
              </Text>
              {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  filterRow: { marginTop: 16, marginBottom: 8, flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 12 },
  chipTextActive: { color: colors.bg, fontWeight: '700' },
  listContent: { padding: 16, paddingTop: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  job: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  amount: { fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  notes: { color: colors.textMuted, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
