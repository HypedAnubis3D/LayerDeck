import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors } from '../lib/theme';
import {
  getAllStatus,
  sendControl,
  PiHubUnreachableError,
  type AllPrinterStatus,
  type ControlCommand,
} from '../lib/piHub';

export default function PrintersScreen() {
  const [status, setStatus] = useState<AllPrinterStatus>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = await getAllStatus();
      setStatus(data);
    } catch (err) {
      setStatus({});
      setError(
        err instanceof PiHubUnreachableError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Failed to load printer status'
      );
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(), 10000);
    return () => clearInterval(interval);
  }, [load]);

  const runControl = async (printer: string, command: ControlCommand) => {
    const key = `${printer}:${command}`;
    setPendingAction(key);
    try {
      await sendControl(printer, command);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Control command failed');
    } finally {
      setPendingAction(null);
    }
  };

  const printerNames = Object.keys(status);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
    >
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => load()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!error && printerNames.length === 0 && (
        <Text style={styles.empty}>No printers reported by Pi Hub.</Text>
      )}

      {printerNames.map((name) => {
        const p = status[name];
        const progress = typeof p.progress === 'number' ? p.progress : undefined;
        return (
          <View key={name} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.printerName}>{name}</Text>
              <View style={[styles.stateBadge, { backgroundColor: stateColor(p.state) + '33' }]}>
                <Text style={[styles.stateText, { color: stateColor(p.state) }]}>
                  {p.state ?? 'unknown'}
                </Text>
              </View>
            </View>

            {progress !== undefined && (
              <>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, progress)}%` }]} />
                </View>
                <Text style={styles.progressText}>{progress}%</Text>
              </>
            )}

            {p.temps && (
              <View style={styles.tempsRow}>
                {Object.entries(p.temps).map(([k, v]) => (
                  <Text key={k} style={styles.tempText}>
                    {k}: {v}°
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.actions}>
              <ControlButton
                label="Pause"
                pending={pendingAction === `${name}:pause`}
                onPress={() => runControl(name, 'pause')}
              />
              <ControlButton
                label="Resume"
                pending={pendingAction === `${name}:resume`}
                onPress={() => runControl(name, 'resume')}
              />
              <ControlButton
                label="Stop"
                danger
                pending={pendingAction === `${name}:stop`}
                onPress={() => runControl(name, 'stop')}
              />
              <ControlButton
                label="Skip"
                pending={pendingAction === `${name}:skip`}
                onPress={() => runControl(name, 'skip')}
              />
              <ControlButton
                label="Light On"
                pending={pendingAction === `${name}:light_on`}
                onPress={() => runControl(name, 'light_on')}
              />
              <ControlButton
                label="Light Off"
                pending={pendingAction === `${name}:light_off`}
                onPress={() => runControl(name, 'light_off')}
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function ControlButton({
  label,
  onPress,
  pending,
  danger,
}: {
  label: string;
  onPress: () => void;
  pending?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={[styles.controlButton, danger && styles.controlButtonDanger]}
      onPress={onPress}
      disabled={pending}
    >
      {pending ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.controlButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

function stateColor(state: unknown): string {
  const s = String(state ?? '').toLowerCase();
  if (s.includes('print') || s.includes('run')) return '#22c55e';
  if (s.includes('pause')) return '#f59e0b';
  if (s.includes('error') || s.includes('offline') || s.includes('fail')) return '#ef4444';
  return '#8a94a3';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 24 },
  errorBanner: {
    backgroundColor: '#ef444422',
    borderWidth: 1,
    borderColor: '#ef444455',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  errorText: { color: colors.danger, flex: 1, fontSize: 13 },
  retryButton: { backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  retryButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  printerName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  stateBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  stateText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: 10, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  progressText: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  tempsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  tempText: { color: colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  controlButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  controlButtonDanger: { backgroundColor: colors.danger },
  controlButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
