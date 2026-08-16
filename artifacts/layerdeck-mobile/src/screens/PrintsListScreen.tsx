import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PrintsStackParamList } from '../navigation/PrintsStackNavigator';
import { useCollection } from '../lib/useCollection';
import { getCollection, setCollection } from '../lib/userData';
import { estimateFilamentCost, computeFinish } from '../lib/prints';
import { findGroupForPrint, assignPrintToGroup } from '../lib/printGroups';
import { colors } from '../lib/theme';
import type { Print, PrintGroup, QueueItem, Spool, UsageHistEntry } from '../types';

type Props = NativeStackScreenProps<PrintsStackParamList, 'PrintsList'>;

const STATUS_FILTERS = ['all', 'printing', 'done', 'failed'];
const DATE_FILTERS = [
  { key: 'all', label: 'All time' },
  { key: '7', label: '7 days' },
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
];

function statusColor(status: string): string {
  if (status === 'printing') return '#3b82f6';
  if (status === 'failed') return '#ef4444';
  return '#22c55e';
}

export default function PrintsListScreen({ navigation }: Props) {
  const { items: prints, loading, refreshing, error, refresh, save } = useCollection<Print>('prints');
  const [spools, setSpools] = useState<Spool[]>([]);
  const [groups, setGroups] = useState<PrintGroup[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failingId, setFailingId] = useState<string | null>(null);
  const [failPctDraft, setFailPctDraft] = useState('');
  const [failNoteDraft, setFailNoteDraft] = useState('');
  const [groupPickerId, setGroupPickerId] = useState<string | null>(null);

  useEffect(() => {
    getCollection<Spool>('spools').then(setSpools).catch(() => {});
    getCollection<PrintGroup>('printGroups').then(setGroups).catch(() => {});
  }, [prints]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <Pressable onPress={() => navigation.navigate('Groups')} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Groups</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('FailRates')} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Fails</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('WasteLog')} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Waste</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation]);

  const categories = useMemo(() => {
    const set = new Set(prints.map((p) => p.category).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [prints]);

  const filtered = useMemo(() => {
    const cutoff =
      dateFilter === 'all' ? 0 : Date.now() - Number(dateFilter) * 24 * 60 * 60 * 1000;
    return prints
      .filter((p) => statusFilter === 'all' || (p.status || 'done') === statusFilter)
      .filter((p) => categoryFilter === 'all' || p.category === categoryFilter)
      .filter((p) => p.timestamp >= cutoff)
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.printer?.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [prints, search, statusFilter, categoryFilter, dateFilter]);

  const finish = async (print: Print, outcome: 'done' | 'failed', failPct?: number, failNote?: string) => {
    setBusyId(print.id);
    try {
      const [freshPrints, freshSpools, freshQueue, freshHist] = await Promise.all([
        getCollection<Print>('prints'),
        getCollection<Spool>('spools'),
        getCollection<QueueItem>('queueItems'),
        getCollection<UsageHistEntry>('usageHist'),
      ]);
      const freshPrint = freshPrints.find((p) => p.id === print.id) ?? print;

      const result = computeFinish(freshPrint, outcome, {
        failPct,
        failNote,
        spools: freshSpools,
        queueItems: freshQueue,
      });

      const nextPrints = freshPrints.map((p) => (p.id === print.id ? result.print : p));
      const writes: Promise<unknown>[] = [setCollection('prints', nextPrints)];
      if (result.spools) writes.push(setCollection('spools', result.spools));
      if (result.queueItems) writes.push(setCollection('queueItems', result.queueItems));
      if (result.usageHistEntries.length) {
        writes.push(setCollection('usageHist', [...freshHist, ...result.usageHistEntries]));
      }
      await Promise.all(writes);

      await refresh();
      if (result.spools) setSpools(result.spools);
      setFailingId(null);
      setFailPctDraft('');
      setFailNoteDraft('');
    } catch (err) {
      Alert.alert('Failed to update print', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmFail = (print: Print) => {
    const pct = Math.min(100, Math.max(0, Number(failPctDraft) || 0));
    finish(print, 'failed', pct, failNoteDraft.trim());
  };

  const setPrintGroup = async (printId: string, groupId: string | null) => {
    const next = assignPrintToGroup(groups, printId, groupId);
    setGroups(next);
    setGroupPickerId(null);
    await setCollection('printGroups', next);
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
      <View style={styles.topRow}>
        <TextInput
          style={styles.search}
          placeholder="Search name, category, printer, notes..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <Pressable style={styles.logButton} onPress={() => navigation.navigate('PrintForm', undefined)}>
          <Text style={styles.logButtonText}>+ Log Print</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.chip, statusFilter === f && styles.chipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.chipText, statusFilter === f && styles.chipTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.filterRow}>
        {DATE_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, dateFilter === f.key && styles.chipActive]}
            onPress={() => setDateFilter(f.key)}
          >
            <Text style={[styles.chipText, dateFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {categories.length > 1 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(c) => c}
          style={styles.categoryRow}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item: c }) => (
            <Pressable
              style={[styles.chip, categoryFilter === c && styles.chipActive]}
              onPress={() => setCategoryFilter(c)}
            >
              <Text style={[styles.chipText, categoryFilter === c && styles.chipTextActive]}>{c}</Text>
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
        ListEmptyComponent={<Text style={styles.empty}>No prints match.</Text>}
        renderItem={({ item }) => {
          const status = item.status || 'done';
          const cost = estimateFilamentCost(item.filaments || [], item.qty || 1, spools);
          const group = findGroupForPrint(groups, item.id);
          const isBusy = busyId === item.id;
          const isFailing = failingId === item.id;

          return (
            <Pressable
              style={[styles.card, { borderLeftColor: statusColor(status), borderLeftWidth: 3 }]}
              onPress={() => navigation.navigate('PrintForm', { print: item })}
            >
              <View style={styles.cardTop}>
                <Text style={styles.name}>{item.name || 'Untitled print'}</Text>
                <View style={[styles.badge, { backgroundColor: `${statusColor(status)}33` }]}>
                  <Text style={[styles.badgeText, { color: statusColor(status) }]}>{status}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {item.category} · {item.printer} · {item.hrs}h
                {item.qty > 1 ? ` · qty ${item.qty}` : ''} · {new Date(item.timestamp).toLocaleDateString()}
              </Text>

              {!!item.filaments?.length && (
                <View style={styles.filamentRow}>
                  {item.filaments.map((f, idx) => {
                    const spool = spools.find((s) => s.id === f.spoolId);
                    return (
                      <View key={idx} style={styles.filamentChip}>
                        <View
                          style={[styles.filamentDot, { backgroundColor: spool?.color || colors.border }]}
                        />
                        <Text style={styles.filamentText}>
                          {spool?.name || 'Unassigned'} ·{' '}
                          {f.actualGrams != null ? (
                            <>
                              {f.actualGrams.toFixed(1)}g{' '}
                              <Text style={styles.strike}>{f.grams.toFixed(1)}g</Text>
                            </>
                          ) : (
                            `${f.grams.toFixed(1)}g`
                          )}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {cost > 0 && <Text style={styles.costText}>Est. filament cost: ${cost.toFixed(2)}</Text>}
              {item.failPct != null && (
                <Text style={styles.costText}>
                  Failed at {item.failPct}% complete{item.failNote ? ` · ${item.failNote}` : ''}
                </Text>
              )}

              <Pressable
                style={styles.groupRow}
                onPress={(e) => {
                  e.stopPropagation();
                  setGroupPickerId(groupPickerId === item.id ? null : item.id);
                }}
              >
                <Text style={styles.groupRowText}>
                  📁 {group ? group.name : 'No group'}
                </Text>
              </Pressable>

              {groupPickerId === item.id && (
                <View style={styles.groupPicker}>
                  <Pressable style={styles.groupOption} onPress={(e) => { e.stopPropagation(); setPrintGroup(item.id, null); }}>
                    <Text style={styles.groupOptionText}>No group</Text>
                  </Pressable>
                  {groups.map((g) => (
                    <Pressable
                      key={g.id}
                      style={styles.groupOption}
                      onPress={(e) => {
                        e.stopPropagation();
                        setPrintGroup(item.id, g.id);
                      }}
                    >
                      <Text style={styles.groupOptionText}>{g.name}</Text>
                    </Pressable>
                  ))}
                  {!groups.length && <Text style={styles.groupOptionText}>No groups yet — create one first.</Text>}
                </View>
              )}

              {status === 'printing' && !isFailing && (
                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.finishButton}
                    onPress={(e) => { e.stopPropagation(); finish(item, 'done'); }}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color={colors.bg} />
                    ) : (
                      <Text style={styles.finishButtonText}>Mark as Finished</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={styles.failButton}
                    onPress={(e) => { e.stopPropagation(); setFailingId(item.id); }}
                    disabled={isBusy}
                  >
                    <Text style={styles.failButtonText}>Mark as Failed</Text>
                  </Pressable>
                </View>
              )}

              {isFailing && (
                <View style={styles.failForm}>
                  <Text style={styles.failFormLabel}>% complete when it failed</Text>
                  <TextInput
                    style={styles.failInput}
                    placeholder="e.g. 62"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    value={failPctDraft}
                    onChangeText={setFailPctDraft}
                  />
                  <TextInput
                    style={styles.failInput}
                    placeholder="Note (optional)"
                    placeholderTextColor={colors.textMuted}
                    value={failNoteDraft}
                    onChangeText={setFailNoteDraft}
                  />
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={styles.failButton}
                      onPress={(e) => { e.stopPropagation(); confirmFail(item); }}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.failButtonText}>Confirm Failed</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={styles.cancelButton}
                      onPress={(e) => { e.stopPropagation(); setFailingId(null); }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  headerButtons: { flexDirection: 'row', gap: 12, marginRight: 8 },
  headerButton: {},
  headerButtonText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
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
  logButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  logButtonText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  categoryRow: { marginBottom: 8, flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13, textTransform: 'capitalize' },
  chipTextActive: { color: colors.bg, fontWeight: '700' },
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
  name: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  filamentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  filamentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  filamentDot: { width: 10, height: 10, borderRadius: 5 },
  filamentText: { color: colors.textMuted, fontSize: 11 },
  strike: { textDecorationLine: 'line-through', opacity: 0.6 },
  costText: { color: colors.textMuted, fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  groupRow: { marginTop: 8 },
  groupRowText: { color: colors.textMuted, fontSize: 12 },
  groupPicker: {
    marginTop: 6,
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 6,
  },
  groupOption: { paddingVertical: 8, paddingHorizontal: 8 },
  groupOptionText: { color: colors.text, fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  finishButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  finishButtonText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  failButton: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  failButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelButtonText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  failForm: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 8,
  },
  failFormLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase' },
  failInput: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.danger, marginHorizontal: 16, marginBottom: 8 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
