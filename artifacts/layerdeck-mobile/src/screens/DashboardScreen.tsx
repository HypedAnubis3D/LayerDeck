import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCollection } from '../lib/useCollection';
import { getConfigObject } from '../lib/userData';
import { getAllStatus, setPiHubPublicUrl, type AllPrinterStatus } from '../lib/piHub';
import { colors, fonts } from '../lib/theme';
import type { Order, Print, QueueItem, Spool } from '../types';

const REVENUE_GOAL_KEY = 'layerdeck:revenueGoal';
const DEFAULT_GOAL = 750;

interface PiHubConfig {
  publicUrl?: string;
}

function isThisMonth(timestamp: number): boolean {
  const now = new Date();
  const d = new Date(timestamp);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function orderTotal(o: Order): number {
  const itemsTotal = (o.items ?? []).reduce((a, it) => a + (it.price ?? 0) * (it.qty ?? 1), 0);
  return itemsTotal + (o.shipping ?? 0) + (o.miscCost ?? 0);
}

export default function DashboardScreen() {
  const { items: orders, loading: loadingOrders } = useCollection<Order>('orders');
  const { items: prints, loading: loadingPrints } = useCollection<Print>('prints');
  const { items: spools, loading: loadingSpools } = useCollection<Spool>('spools');
  const { items: queueItems, loading: loadingQueue } = useCollection<QueueItem>('queueItems');
  const [printerStatus, setPrinterStatus] = useState<AllPrinterStatus>({});
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(DEFAULT_GOAL));

  useEffect(() => {
    AsyncStorage.getItem(REVENUE_GOAL_KEY).then((v) => {
      if (v) {
        setGoal(Number(v));
        setGoalDraft(v);
      }
    });
  }, []);

  useEffect(() => {
    getConfigObject<PiHubConfig>('printerHub')
      .then((config) => setPiHubPublicUrl(config?.publicUrl))
      .then(() => getAllStatus())
      .then(setPrinterStatus)
      .catch(() => {});
  }, []);

  const loading = loadingOrders || loadingPrints || loadingSpools || loadingQueue;

  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((a, o) => a + orderTotal(o), 0);
    const thisMonthOrders = orders.filter((o) => isThisMonth(o.timestamp));
    const thisMonthRevenue = thisMonthOrders.reduce((a, o) => a + orderTotal(o), 0);
    const stockGrams = spools.reduce((a, s) => a + (s.remaining || 0), 0);
    const activePrints = prints.filter((p) => (p.status || 'done') === 'printing').length;
    const pendingOrders = orders.filter((o) => o.status === 'pending').length;
    const shippedOrders = orders.filter((o) => o.status === 'shipped').length;
    const queuedCount = queueItems.filter((q) => q.stage !== 'done').length;
    return {
      totalRevenue,
      thisMonthRevenue,
      thisMonthTransactions: thisMonthOrders.length,
      stockGrams,
      activePrints,
      pendingOrders,
      shippedOrders,
      queuedCount,
    };
  }, [orders, prints, spools, queueItems]);

  const saveGoal = async () => {
    const n = Number(goalDraft) || DEFAULT_GOAL;
    setGoal(n);
    setEditingGoal(false);
    await AsyncStorage.setItem(REVENUE_GOAL_KEY, String(n));
  };

  const goalPct = goal > 0 ? Math.min(100, Math.round((stats.thisMonthRevenue / goal) * 100)) : 0;
  const printerNames = Object.keys(printerStatus);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statStrip}>
        <Stat label="Spools" value={String(spools.length)} />
        <Stat label="Stock" value={`${(stats.stockGrams / 1000).toFixed(1)}kg`} />
        <Stat label="Prints" value={String(prints.length)} />
        <Stat label="Queued" value={String(stats.queuedCount)} color={colors.accent} />
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Revenue" value={`$${stats.totalRevenue.toFixed(0)}`} color={colors.success} />
      </View>

      <View style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalLabel}>🎯 Monthly Revenue Goal</Text>
          {editingGoal ? (
            <Pressable onPress={saveGoal}>
              <Text style={styles.goalEditLink}>Save</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setEditingGoal(true)}>
              <Text style={styles.goalEditLink}>Edit</Text>
            </Pressable>
          )}
        </View>
        {editingGoal ? (
          <TextInput
            style={styles.goalInput}
            keyboardType="decimal-pad"
            value={goalDraft}
            onChangeText={setGoalDraft}
            autoFocus
          />
        ) : (
          <Text style={styles.goalValue}>
            ${stats.thisMonthRevenue.toFixed(0)} <Text style={styles.goalOf}>/ ${goal} goal</Text>
          </Text>
        )}
        <View style={styles.goalBarTrack}>
          <View style={[styles.goalBarFill, { width: `${goalPct}%` }]} />
        </View>
        <Text style={styles.goalMeta}>
          {goalPct}% complete · ${Math.max(0, goal - stats.thisMonthRevenue).toFixed(0)} to go
        </Text>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>This Month Revenue</Text>
          <Text style={[styles.miniValue, { color: colors.success }]}>${stats.thisMonthRevenue.toFixed(2)}</Text>
          <Text style={styles.miniSub}>
            {stats.thisMonthTransactions} transaction{stats.thisMonthTransactions === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>Active Prints</Text>
          <Text style={[styles.miniValue, { color: colors.accent }]}>{stats.activePrints}</Text>
          <Text style={styles.miniSub}>{stats.queuedCount} in queue</Text>
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>Pending Orders</Text>
          <Text style={styles.miniValue}>{stats.pendingOrders}</Text>
          <Text style={styles.miniSub}>{stats.shippedOrders} shipped total</Text>
        </View>
      </View>

      {printerNames.length > 0 && (
        <View style={styles.printerSection}>
          <Text style={styles.sectionLabel}>Printer Status</Text>
          <View style={styles.cardRow}>
            {printerNames.map((name) => {
              const p = printerStatus[name];
              const state = p.online === false ? 'OFFLINE' : (p.gcode_state || 'IDLE');
              const isPrinting = state === 'RUNNING' || state === 'PAUSE';
              return (
                <View key={name} style={styles.printerCard}>
                  <Text style={styles.printerName} numberOfLines={1}>{name}</Text>
                  <Text style={[styles.printerState, { color: isPrinting ? colors.success : colors.textMuted }]}>
                    {isPrinting ? `● ${state}` : `— ${state}`}
                  </Text>
                  {isPrinting && <Text style={styles.printerJob} numberOfLines={1}>{p.subtask_name || ''}</Text>}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  statStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    flexBasis: '31%',
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: { color: colors.accent, fontSize: 18, fontFamily: fonts.display },
  statLabel: { color: colors.textMuted, fontSize: 9, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  goalCard: {
    backgroundColor: colors.accentDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 14,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalLabel: { color: colors.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  goalEditLink: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  goalValue: { color: colors.text, fontSize: 26, fontFamily: fonts.display, marginBottom: 8 },
  goalOf: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.body },
  goalInput: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalBarTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  goalBarFill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  goalMeta: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  cardRow: { flexDirection: 'row', gap: 10 },
  miniCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  miniLabel: { color: colors.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  miniValue: { color: colors.text, fontSize: 24, fontWeight: '700', marginTop: 6 },
  miniSub: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  printerSection: { gap: 8 },
  sectionLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  printerCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  printerName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  printerState: { fontSize: 11, marginTop: 4 },
  printerJob: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
});
