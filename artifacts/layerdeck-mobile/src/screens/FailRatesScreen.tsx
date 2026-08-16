import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PrintsStackParamList } from '../navigation/PrintsStackNavigator';
import { useCollection } from '../lib/useCollection';
import { buildFailRateRows, sortFailRateRows, failRateColor, isHighFailRate, type FailRateSort } from '../lib/failRates';
import { colors, fonts } from '../lib/theme';
import type { Print } from '../types';

type Props = NativeStackScreenProps<PrintsStackParamList, 'FailRates'>;

const SORTS: { key: FailRateSort; label: string }[] = [
  { key: 'failRate', label: 'Fail rate' },
  { key: 'count', label: 'Print count' },
  { key: 'name', label: 'Name' },
];

export default function FailRatesScreen({ navigation }: Props) {
  const { items: prints, loading } = useCollection<Print>('prints');
  const [sort, setSort] = useState<FailRateSort>('failRate');

  const rows = useMemo(() => sortFailRateRows(buildFailRateRows(prints), sort), [prints, sort]);

  const summary = useMemo(() => {
    const totalPrints = rows.reduce((a, r) => a + r.total, 0);
    const totalFailed = rows.reduce((a, r) => a + r.failed, 0);
    const overallRate = totalPrints ? Math.round((totalFailed / totalPrints) * 1000) / 10 : 0;
    const highFailCount = rows.filter((r) => isHighFailRate(r.failRate)).length;
    return { totalPrints, totalFailed, overallRate, highFailCount };
  }, [rows]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!rows.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No fail-rate data yet</Text>
        <Text style={styles.emptySubtitle}>
          Mark prints as finished or failed on the Prints screen to start building this view.
        </Text>
        <Pressable style={styles.emptyButton} onPress={() => navigation.navigate('PrintsList')}>
          <Text style={styles.emptyButtonText}>Go to Prints</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryStrip}>
        <SummaryStat label="Overall fail rate" value={`${summary.overallRate}%`} color={failRateColor(summary.overallRate)} />
        <SummaryStat label="Total prints" value={String(summary.totalPrints)} />
        <SummaryStat label="Total failed" value={String(summary.totalFailed)} />
        <SummaryStat label="High-fail products" value={String(summary.highFailCount)} color={summary.highFailCount ? colors.danger : undefined} />
      </View>

      <View style={styles.sortRow}>
        {SORTS.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.sortChip, sort === s.key && styles.sortChipActive]}
            onPress={() => setSort(s.key)}
          >
            <Text style={[styles.sortChipText, sort === s.key && styles.sortChipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.name}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftColor: failRateColor(item.failRate), borderLeftWidth: 3 }]}>
            <View style={styles.cardTop}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.rate, { color: failRateColor(item.failRate) }]}>{item.failRate}%</Text>
            </View>
            <Text style={styles.meta}>
              {item.category ? `${item.category} · ` : ''}
              {item.done}/{item.total} done · {item.failed} failed
            </Text>
            {item.avgCancelPct != null && (
              <Text style={styles.meta}>Avg cancelled at: {item.avgCancelPct}% complete</Text>
            )}
            {isHighFailRate(item.failRate) && (
              <Text style={styles.warning}>⚠ High fail rate — check print settings</Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  emptyButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  emptyButtonText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  summaryStat: {
    flexBasis: '47%',
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  summaryValue: { color: colors.accent, fontSize: 22, fontFamily: fonts.display },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14, marginBottom: 6 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  sortChipText: { color: colors.textMuted, fontSize: 12 },
  sortChipTextActive: { color: colors.bg, fontWeight: '700' },
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
  name: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  rate: { fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  warning: { color: colors.warning, fontSize: 12, marginTop: 6, fontWeight: '600' },
});
