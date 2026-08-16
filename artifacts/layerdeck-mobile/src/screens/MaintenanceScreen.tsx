import { useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useCollection } from '../lib/useCollection';
import { uid } from '../lib/userData';
import { colors } from '../lib/theme';
import type { MaintLogEntry } from '../types';

const MAINT_TYPES = ['Lubrication', 'Nozzle Change', 'Bed Cleaning', 'Full Service'];

export default function MaintenanceScreen() {
  const { items, loading, save } = useCollection<MaintLogEntry>('maintLog');
  const [printerFilter, setPrinterFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [printer, setPrinter] = useState('');
  const [type, setType] = useState(MAINT_TYPES[0]);
  const [interval, setInterval_] = useState('30');
  const [notes, setNotes] = useState('');

  const printers = useMemo(() => {
    const set = new Set(items.map((i) => i.printer).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    return items
      .filter((i) => printerFilter === 'all' || i.printer === printerFilter)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [items, printerFilter]);

  const addEntry = async () => {
    if (!printer.trim()) return;
    const entry: MaintLogEntry = {
      id: uid(),
      printer: printer.trim(),
      type,
      date: new Date().toISOString().slice(0, 10),
      interval: Number(interval) || 30,
      notes,
      timestamp: Date.now(),
    };
    await save([...items, entry]);
    setPrinter('');
    setNotes('');
    setShowForm(false);
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
        <Pressable style={styles.addButton} onPress={() => setShowForm((v) => !v)}>
          <Text style={styles.addButtonText}>{showForm ? 'Cancel' : '+ Log Maintenance'}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Printer name"
            placeholderTextColor={colors.textMuted}
            value={printer}
            onChangeText={setPrinter}
          />
          <View style={styles.typeRow}>
            {MAINT_TYPES.map((t) => (
              <Pressable key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
                <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Interval (days between service)"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={interval}
            onChangeText={setInterval_}
          />
          <TextInput
            style={styles.input}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
          />
          <Pressable style={styles.saveButton} onPress={addEntry}>
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={printers}
        keyExtractor={(p) => p}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item: p }) => (
          <Pressable
            style={[styles.chip, printerFilter === p && styles.chipActive]}
            onPress={() => setPrinterFilter(p)}
          >
            <Text style={[styles.chipText, printerFilter === p && styles.chipTextActive]}>{p}</Text>
          </Pressable>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No maintenance logged yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.type}>{item.type}</Text>
              <Text style={styles.date}>{item.date}</Text>
            </View>
            <Text style={styles.meta}>
              {item.printer} · every {item.interval}d
            </Text>
            {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  topRow: { paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  addButton: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  addButtonText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  form: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  input: {
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  saveButton: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  saveButtonText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  filterRow: { marginBottom: 8, flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 12, textTransform: 'capitalize' },
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  type: { color: colors.text, fontSize: 15, fontWeight: '600' },
  date: { color: colors.textMuted, fontSize: 12 },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  notes: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
