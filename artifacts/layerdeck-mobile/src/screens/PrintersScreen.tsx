import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../lib/theme';
import { getConfigObject } from '../lib/userData';
import {
  getAllStatus,
  sendControl,
  getTapoDevices,
  setTapoPower,
  scheduleTapoOff,
  cancelTapoOff,
  matchTapoDevice,
  setPiHubPublicUrl,
  PiHubUnreachableError,
  type AllPrinterStatus,
  type ControlCommand,
  type TapoDevice,
} from '../lib/piHub';

interface PiHubConfig {
  publicUrl?: string;
}

const AUTO_OFF_DELAY_MS = 10 * 60 * 1000;
const AUTO_OFF_STORAGE_PREFIX = 'layerdeck:autoOff:';
const TAPO_POLL_MS = 20000; // steady-state, once at least one fetch has succeeded
const TAPO_RETRY_MS = 3000; // fast retry until the first successful fetch

interface AutoOffCountdown {
  alias: string;
  endsAt: number;
}

export default function PrintersScreen() {
  const [status, setStatus] = useState<AllPrinterStatus>({});
  const [tapoDevices, setTapoDevices] = useState<TapoDevice[]>([]);
  const [tapoLoading, setTapoLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [autoOffEnabled, setAutoOffEnabled] = useState<Record<string, boolean>>({});
  const [countdowns, setCountdowns] = useState<Record<string, AutoOffCountdown>>({});
  const [, forceTick] = useState(0);

  const lastGcodeState = useRef<Record<string, string>>({});
  // `load` and `loadTapo` are set up once and polled on stable intervals, but
  // still need to see the latest autoOffEnabled/tapoDevices without being
  // redefined every render — so they read through these refs instead of
  // closing over state.
  const autoOffEnabledRef = useRef<Record<string, boolean>>({});
  const tapoDevicesRef = useRef<TapoDevice[]>([]);
  const tapoLoadedOnce = useRef(false);
  const tapoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    autoOffEnabledRef.current = autoOffEnabled;
  }, [autoOffEnabled]);

  useEffect(() => {
    tapoDevicesRef.current = tapoDevices;
  }, [tapoDevices]);

  useEffect(() => {
    AsyncStorage.getAllKeys()
      .then(async (keys) => {
        const ownKeys = keys.filter((k) => k.startsWith(AUTO_OFF_STORAGE_PREFIX));
        if (!ownKeys.length) return;
        const pairs = await AsyncStorage.multiGet(ownKeys);
        const next: Record<string, boolean> = {};
        for (const [key, value] of pairs) {
          next[key.slice(AUTO_OFF_STORAGE_PREFIX.length)] = value === 'true';
        }
        setAutoOffEnabled(next);
      })
      .catch(() => {});
  }, []);

  // Prefer the Tailscale Funnel publicUrl from the same printerHub config
  // the web app uses (getPiUrl()) — a real public HTTPS endpoint, so the
  // Printers tab works off the home WiFi too. Falls back to the LAN IP
  // (EXPO_PUBLIC_PI_HUB_URL) if unset. In-flight/queued requests made
  // before this resolves just use the LAN fallback and self-correct on
  // the next poll.
  useEffect(() => {
    getConfigObject<PiHubConfig>('printerHub')
      .then((config) => setPiHubPublicUrl(config?.publicUrl))
      .catch(() => {});
  }, []);

  // Countdown banners tick every second while any auto-off is pending.
  useEffect(() => {
    if (!Object.keys(countdowns).length) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [countdowns]);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = await getAllStatus();
      setStatus(data);

      // Detect RUNNING/PAUSE -> FINISH transitions to trigger auto-off.
      for (const [name, p] of Object.entries(data)) {
        const prevState = lastGcodeState.current[name];
        const curState = p.gcode_state || 'IDLE';
        if (prevState && prevState !== 'FINISH' && curState === 'FINISH' && autoOffEnabledRef.current[name]) {
          const plug = matchTapoDevice(name, tapoDevicesRef.current);
          if (plug) {
            scheduleTapoOff(plug.alias, AUTO_OFF_DELAY_MS).catch(() => {});
            setCountdowns((prev) => ({
              ...prev,
              [name]: { alias: plug.alias, endsAt: Date.now() + AUTO_OFF_DELAY_MS },
            }));
          }
        }
        lastGcodeState.current[name] = curState;
      }
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

  // Smart plugs are a separate, optional subsystem (needs tp-link-tapo-connect
  // installed on the Pi, and the local Tapo login re-authenticates fresh on
  // every single request — so the very first fetch after opening the app is
  // prone to failing). Retry quickly until the first successful load, then
  // settle into a slower steady-state poll and keep the last-known device
  // list on any later failure rather than blanking the plug row.
  const loadTapo = useCallback(async () => {
    if (tapoRetryTimer.current) {
      clearTimeout(tapoRetryTimer.current);
      tapoRetryTimer.current = null;
    }
    try {
      const devices = await getTapoDevices();
      setTapoDevices(devices);
      tapoLoadedOnce.current = true;
      setTapoLoading(false);
    } catch {
      if (!tapoLoadedOnce.current) {
        setTapoLoading(true);
        tapoRetryTimer.current = setTimeout(loadTapo, TAPO_RETRY_MS);
      }
      // else: already have last-known-good data — skip this cycle silently
    }
  }, []);

  useEffect(() => {
    loadTapo();
    const interval = setInterval(loadTapo, TAPO_POLL_MS);
    return () => {
      clearInterval(interval);
      if (tapoRetryTimer.current) clearTimeout(tapoRetryTimer.current);
    };
  }, [loadTapo]);

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

  const runTapoPower = async (alias: string, on: boolean) => {
    const key = `tapo:${alias}`;
    setPendingAction(key);
    try {
      await setTapoPower(alias, on);
      await loadTapo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plug command failed');
    } finally {
      setPendingAction(null);
    }
  };

  const toggleAutoOff = async (printerName: string, value: boolean) => {
    setAutoOffEnabled((prev) => ({ ...prev, [printerName]: value }));
    await AsyncStorage.setItem(`${AUTO_OFF_STORAGE_PREFIX}${printerName}`, value ? 'true' : 'false');
  };

  const keepOn = async (printerName: string) => {
    const c = countdowns[printerName];
    if (!c) return;
    setCountdowns((prev) => {
      const next = { ...prev };
      delete next[printerName];
      return next;
    });
    cancelTapoOff(c.alias).catch(() => {});
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            load(true);
            loadTapo();
          }}
          tintColor={colors.accent}
        />
      }
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
        const state = p.online === false ? 'OFFLINE' : (p.gcode_state || 'IDLE');
        const progress = p.mc_percent ?? 0;
        const isPrinting = state === 'RUNNING' || state === 'PAUSE';
        const plug = matchTapoDevice(name, tapoDevices);
        const countdown = countdowns[name];
        const secsLeft = countdown ? Math.max(0, Math.round((countdown.endsAt - Date.now()) / 1000)) : 0;

        return (
          <View key={name} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.printerName}>{name}</Text>
              <View style={[styles.stateBadge, { backgroundColor: stateColor(state) + '33' }]}>
                <Text style={[styles.stateText, { color: stateColor(state) }]}>{state}</Text>
              </View>
            </View>

            {!!p.subtask_name && <Text style={styles.jobName}>{p.subtask_name}</Text>}

            {isPrinting && (
              <>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, progress)}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {progress}%
                  {p.layer_num != null && p.total_layer_num ? ` · layer ${p.layer_num}/${p.total_layer_num}` : ''}
                  {p.mc_remaining_time != null ? ` · ${Math.round(p.mc_remaining_time)}m left` : ''}
                  {p.mc_remaining_time != null ? ` · ETA ${fmtEta(p.mc_remaining_time)}` : ''}
                </Text>
              </>
            )}

            <View style={styles.tempsRow}>
              <Text style={styles.tempText}>Nozzle: {fmtTemp(p.nozzle_temper)}</Text>
              <Text style={styles.tempText}>Bed: {fmtTemp(p.bed_temper)}</Text>
            </View>

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
                label="Calibrate"
                pending={pendingAction === `${name}:calibration`}
                onPress={() => runControl(name, 'calibration')}
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

            {plug ? (
              <View style={styles.plugSection}>
                <View style={styles.plugRow}>
                  <View style={styles.plugInfo}>
                    <Text style={styles.plugAlias}>⚡ {plug.alias}</Text>
                    <Text style={styles.plugMeta}>
                      {plug.error
                        ? plug.error
                        : plug.on == null
                        ? 'unknown'
                        : plug.on
                        ? `On${plug.power_mw != null ? ` · ${Math.round(plug.power_mw / 1000)}W` : ''}`
                        : 'Off'}
                    </Text>
                  </View>
                  <View style={styles.plugButtons}>
                    <Pressable
                      style={[styles.plugButton, plug.on === true && styles.plugButtonOn]}
                      disabled={pendingAction === `tapo:${plug.alias}`}
                      onPress={() => runTapoPower(plug.alias, true)}
                    >
                      {pendingAction === `tapo:${plug.alias}` ? (
                        <ActivityIndicator size="small" color={colors.bg} />
                      ) : (
                        <Text style={styles.plugButtonText}>ON</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.plugButton, plug.on === false && styles.plugButtonOff]}
                      disabled={pendingAction === `tapo:${plug.alias}`}
                      onPress={() => runTapoPower(plug.alias, false)}
                    >
                      <Text style={styles.plugButtonText}>OFF</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.autoOffRow}>
                  <Text style={styles.autoOffLabel}>Auto OFF 10 min after print finishes</Text>
                  <Switch
                    value={!!autoOffEnabled[name]}
                    onValueChange={(v) => toggleAutoOff(name, v)}
                    trackColor={{ false: colors.border, true: colors.accentMuted }}
                    thumbColor={autoOffEnabled[name] ? colors.accent : colors.textMuted}
                  />
                </View>

                {countdown && secsLeft > 0 && (
                  <View style={styles.countdownBanner}>
                    <Text style={styles.countdownText}>
                      {plug.alias} turns off in {Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, '0')}
                    </Text>
                    <Pressable style={styles.keepOnButton} onPress={() => keepOn(name)}>
                      <Text style={styles.keepOnButtonText}>Keep ON</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : (
              tapoLoading && (
                <View style={styles.plugSection}>
                  <Text style={styles.plugLoadingText}>Connecting to smart plug…</Text>
                </View>
              )
            )}
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
        <ActivityIndicator size="small" color={danger ? '#fff' : colors.bg} />
      ) : (
        <Text style={[styles.controlButtonText, danger && styles.controlButtonTextDanger]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function stateColor(state: string): string {
  const s = state.toLowerCase();
  if (s === 'running') return '#22c55e';
  if (s === 'pause') return '#f59e0b';
  if (s === 'offline' || s === 'failed') return '#ef4444';
  return '#8a94a3';
}

function fmtTemp(t: number | undefined): string {
  return t ? `${Math.round(t)}°` : '—';
}

// mc_remaining_time is minutes-from-now; format as e.g. "8/15 8:19pm".
function fmtEta(remainingMinutes: number): string {
  const d = new Date(Date.now() + remainingMinutes * 60000);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}${ampm}`;
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
  jobName: { color: colors.textMuted, fontSize: 13, marginTop: 8 },
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
  controlButtonText: { color: colors.bg, fontSize: 12, fontWeight: '700' },
  controlButtonTextDanger: { color: '#fff' },
  plugSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  plugLoadingText: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  plugRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plugInfo: { flex: 1 },
  plugAlias: { color: colors.text, fontSize: 13, fontWeight: '600' },
  plugMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  plugButtons: { flexDirection: 'row', gap: 6 },
  plugButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 52,
    alignItems: 'center',
  },
  plugButtonOn: { backgroundColor: colors.success, borderColor: colors.success },
  plugButtonOff: { backgroundColor: colors.danger, borderColor: colors.danger },
  plugButtonText: { color: colors.bg, fontSize: 12, fontWeight: '700' },
  autoOffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  autoOffLabel: { color: colors.textMuted, fontSize: 12, flex: 1, marginRight: 8 },
  countdownBanner: {
    marginTop: 10,
    backgroundColor: `${colors.accent}1a`,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  countdownText: { color: colors.text, fontSize: 12, flex: 1 },
  keepOnButton: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  keepOnButtonText: { color: colors.bg, fontSize: 11, fontWeight: '700' },
});
