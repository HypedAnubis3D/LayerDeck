import { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useCollection } from '../lib/useCollection';
import { colors, statusColors } from '../lib/theme';
import type { Spool } from '../types';
import { groupSpools, normalizeSpoolsForSave, pctForSpool, type SpoolStatus } from '../lib/spools';

const FILTERS: Array<SpoolStatus | 'all'> = ['all', 'critical', 'low', 'ok', 'full'];

export default function SpoolsScreen() {
  const { items, loading, refreshing, error, refresh, save } = useCollection<Spool>('spools');
  const [filter, setFilter] = useState<SpoolStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [usageDraft, setUsageDraft] = useState<Record<string, string>>({});

  const groups = useMemo(() => {
    const all = groupSpools(items);
    const filtered = filter === 'all' ? all : all.filter((g) => g.status === filter);
    return filtered.sort((a, b) => a.pct - b.pct);
  }, [items, filter]);

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const logUsage = async (spoolId: string) => {
    const grams = Number(usageDraft[spoolId]);
    if (!grams || grams <= 0) return;

    const updated = items.map((s) =>
      s.id === spoolId ? { ...s, remaining: (s.remaining || 0) - grams } : s
    );
    const { spools: normalized, depleted } = normalizeSpoolsForSave(updated);
    await save(normalized);
    setUsageDraft((prev) => ({ ...prev, [spoolId]: '' }));
    if (depleted.length) {
      // Depleted spools were dropped from the array on write, matching the
      // web app's saveSpools() behavior.
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={groups}
        keyExtractor={(g) => g.key}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={<Text style={styles.empty}>No spools match.</Text>}
        renderItem={({ item: group }) => {
          const isOpen = expanded.has(group.key);
          return (
            <View style={styles.card}>
              <Pressable style={styles.cardTop} onPress={() => toggleExpanded(group.key)}>
                <View style={[styles.colorDot, { backgroundColor: group.color || '#888' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupName}>{group.name || 'Unnamed'}</Text>
                  <Text style={styles.groupMeta}>
                    {group.material} · {group.spools.length} spool{group.spools.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={styles.groupRight}>
                  <Text style={[styles.pct, { color: statusColors[group.status] }]}>{group.pct}%</Text>
                  <Text style={styles.grams}>
                    {group.totalRemaining.toFixed(0)}g / {group.totalCapacity.toFixed(0)}g
                  </Text>
                </View>
              </Pressable>

              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, group.pct)}%`, backgroundColor: statusColors[group.status] },
                  ]}
                />
              </View>

              {isOpen && (
                <View style={styles.expandedArea}>
                  {group.spools.map((s) => (
                    <View key={s.id} style={styles.spoolRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.spoolMeta}>
                          {s.printer || 'unassigned'}{s.amsSlot ? ` · slot ${s.amsSlot}` : ''}
                        </Text>
                        <Text style={styles.spoolMeta}>
                          {s.remaining.toFixed(2)}g / {s.total.toFixed(2)}g ({pctForSpool(s)}%) · {s.brand || 'Bambu Lab'}
                        </Text>
                      </View>
                      <TextInput
                        style={styles.usageInput}
                        placeholder="g used"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        value={usageDraft[s.id] ?? ''}
                        onChangeText={(v) => setUsageDraft((prev) => ({ ...prev, [s.id]: v }))}
                      />
                      <Pressable style={styles.logButton} onPress={() => logUsage(s.id)}>
                        <Text style={styles.logButtonText}>Log</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
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
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8 },
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
  filterTextActive: { color: '#fff', fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colorDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  groupName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  groupMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  groupRight: { alignItems: 'flex-end' },
  pct: { fontSize: 16, fontWeight: '700' },
  grams: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginTop: 10,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  expandedArea: { marginTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  spoolRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spoolMeta: { color: colors.textMuted, fontSize: 12 },
  usageInput: {
    width: 70,
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 13,
  },
  logButton: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  logButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, marginHorizontal: 16, marginTop: 8 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
