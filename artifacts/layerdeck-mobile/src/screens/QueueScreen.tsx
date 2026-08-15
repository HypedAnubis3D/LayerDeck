import { useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useCollection } from '../lib/useCollection';
import { colors } from '../lib/theme';
import type { QueueItem, QueueStage } from '../types';

const STAGE_ORDER: QueueStage[] = ['queued', 'inprogress', 'done'];
const STAGE_LABELS: Record<QueueStage, string> = {
  queued: 'Queued',
  inprogress: 'In Progress',
  done: 'Done',
};
const NEXT_STAGE: Record<QueueStage, QueueStage | null> = {
  queued: 'inprogress',
  inprogress: 'done',
  done: null,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  normal: '#3b82f6',
  low: '#6b7280',
};

export default function QueueScreen() {
  const { items, loading, refreshing, error, refresh, save } = useCollection<QueueItem>('queueItems');

  const sections = useMemo(() => {
    return STAGE_ORDER.map((stage) => ({
      title: STAGE_LABELS[stage],
      stage,
      data: items
        .filter((i) => (i.stage || 'queued') === stage)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
    }));
  }, [items]);

  const moveToNextStage = (item: QueueItem) => {
    const next = NEXT_STAGE[item.stage || 'queued'];
    if (!next) return;
    save(items.map((i) => (i.id === item.id ? { ...i, stage: next } : i)));
  };

  const moveBack = (item: QueueItem) => {
    const idx = STAGE_ORDER.indexOf(item.stage || 'queued');
    if (idx <= 0) return;
    const prev = STAGE_ORDER[idx - 1];
    save(items.map((i) => (i.id === item.id ? { ...i, stage: prev } : i)));
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
      {error && <Text style={styles.error}>{error}</Text>}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>
            {section.title} ({section.data.length})
          </Text>
        )}
        renderItem={({ item }) => {
          const next = NEXT_STAGE[item.stage || 'queued'];
          const priorityColor = PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.normal;
          return (
            <View style={[styles.card, { borderLeftColor: priorityColor, borderLeftWidth: 3 }]}>
              <View style={styles.cardTop}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}33` }]}>
                  <Text style={[styles.priorityText, { color: priorityColor }]}>{item.priority}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {item.category} · {item.printer || 'unassigned'} · {item.hrs}h · qty {item.qty}
              </Text>
              {item.noTmf && <Text style={styles.warning}>No 3MF on file</Text>}
              {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}

              <View style={styles.actions}>
                {STAGE_ORDER.indexOf(item.stage || 'queued') > 0 && (
                  <Pressable style={styles.secondaryButton} onPress={() => moveBack(item)}>
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </Pressable>
                )}
                {next && (
                  <Pressable style={styles.primaryButton} onPress={() => moveToNextStage(item)}>
                    <Text style={styles.primaryButtonText}>Move to {STAGE_LABELS[next]}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Queue is empty.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 24 },
  sectionHeader: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
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
  warning: { color: colors.warning, fontSize: 12, marginTop: 4, fontWeight: '600' },
  notes: { color: colors.textMuted, fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priorityText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  primaryButtonText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  secondaryButtonText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, marginHorizontal: 16, marginTop: 8 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
