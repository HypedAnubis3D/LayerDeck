import { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useCollection } from '../lib/useCollection';
import { getCollection } from '../lib/userData';
import { colors, fonts } from '../lib/theme';
import type { Spool, WasteLogEntry } from '../types';

export default function WasteLogScreen() {
  const { items, loading } = useCollection<WasteLogEntry>('wasteLog');
  const [spools, setSpools] = useState<Spool[]>([]);

  useEffect(() => {
    getCollection<Spool>('spools').then(setSpools).catch(() => {});
  }, []);

  const sorted = useMemo(() => [...items].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)), [items]);

  const avgCostPerGram = useMemo(() => {
    const withCost = spools.filter((s) => s.total > 0);
    if (!withCost.length) return 0;
    return withCost.reduce((a, s) => a + s.cost / s.total, 0) / withCost.length;
  }, [spools]);

  const totalWastedGrams = sorted.reduce((a, w) => a + (w.materialWasted || 0), 0);
  const hasAnyWasteData = sorted.some((w) => w.materialWasted > 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryStrip}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>{sorted.length}</Text>
          <Text style={styles.summaryLabel}>Failed Prints Logged</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryValue}>${(totalWastedGrams * avgCostPerGram).toFixed(2)}</Text>
          <Text style={styles.summaryLabel}>Est. Material Wasted</Text>
        </View>
      </View>

      {!hasAnyWasteData && sorted.length > 0 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Pi Hub is logging failures here, but never records how many grams were wasted —
            materialWasted is 0 on every entry, so cost can't be estimated yet. Worth checking
            whether that's meant to be populated on the Pi Hub side.
          </Text>
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No waste logged yet.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderLeftColor: colors.danger, borderLeftWidth: 3 }]}>
            <Text style={styles.job} numberOfLines={1}>{item.jobName}</Text>
            <Text style={styles.meta}>
              {item.printerName} · {item.date} · {item.reason}
            </Text>
            {item.materialWasted > 0 && (
              <Text style={styles.costText}>
                {item.materialWasted}g · ~${(item.materialWasted * avgCostPerGram).toFixed(2)}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  summaryStrip: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16 },
  summaryStat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  summaryValue: { color: colors.accent, fontSize: 22, fontFamily: fonts.display },
  summaryLabel: { color: colors.textMuted, fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  warningBanner: {
    backgroundColor: '#f59e0b22',
    borderWidth: 1,
    borderColor: '#f59e0b55',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  warningText: { color: colors.warning, fontSize: 12, lineHeight: 17 },
  listContent: { padding: 16, paddingTop: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  job: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  costText: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
