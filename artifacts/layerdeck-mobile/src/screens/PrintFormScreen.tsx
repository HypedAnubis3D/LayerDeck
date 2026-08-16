import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PrintsStackParamList } from '../navigation/PrintsStackNavigator';
import { getCollection, setCollection, uid } from '../lib/userData';
import { applyFilamentDelta } from '../lib/prints';
import { colors } from '../lib/theme';
import type { Print, PrintFilament, Spool } from '../types';

type Props = NativeStackScreenProps<PrintsStackParamList, 'PrintForm'>;

export default function PrintFormScreen({ route, navigation }: Props) {
  const existing = route.params?.print;
  const isEdit = !!existing;

  const [spools, setSpools] = useState<Spool[]>([]);
  const [loadingSpools, setLoadingSpools] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerRow, setPickerRow] = useState<number | null>(null);

  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [printer, setPrinter] = useState(existing?.printer ?? '');
  const [hrs, setHrs] = useState(String(existing?.hrs ?? ''));
  const [qty, setQty] = useState(String(existing?.qty ?? 1));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [filaments, setFilaments] = useState<PrintFilament[]>(existing?.filaments ?? []);

  useEffect(() => {
    getCollection<Spool>('spools')
      .then(setSpools)
      .finally(() => setLoadingSpools(false));
  }, []);

  const addFilamentRow = () => setFilaments((prev) => [...prev, { spoolId: '', grams: 0 }]);

  const updateFilament = (idx: number, patch: Partial<PrintFilament>) =>
    setFilaments((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const removeFilament = (idx: number) => {
    setFilaments((prev) => prev.filter((_, i) => i !== idx));
    setPickerRow(null);
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give this print a name.');
      return;
    }
    const parsedQty = Number(qty) || 1;
    const parsedHrs = Number(hrs) || 0;
    const validFilaments = filaments.filter((f) => f.spoolId && f.grams > 0);

    setSaving(true);
    try {
      const [freshPrints, freshSpools] = await Promise.all([
        getCollection<Print>('prints'),
        getCollection<Spool>('spools'),
      ]);

      const { spools: nextSpools } = applyFilamentDelta(
        freshSpools,
        existing?.filaments ?? [],
        existing?.qty ?? 0,
        validFilaments,
        parsedQty
      );

      const printRecord: Print = {
        id: existing?.id ?? uid(),
        name: name.trim(),
        category: category.trim(),
        printer: printer.trim(),
        hrs: parsedHrs,
        qty: parsedQty,
        filaments: validFilaments,
        notes,
        tmfName: existing?.tmfName ?? null,
        tmfId: existing?.tmfId ?? null,
        timestamp: existing?.timestamp ?? Date.now(),
        status: existing?.status ?? 'done',
        finishedAt: existing?.finishedAt,
        fromQueueItemId: existing?.fromQueueItemId,
        linkedOrderId: existing?.linkedOrderId,
        autoFromPi: existing?.autoFromPi,
      };

      const idx = freshPrints.findIndex((p) => p.id === printRecord.id);
      const nextPrints = idx >= 0 ? freshPrints.map((p, i) => (i === idx ? printRecord : p)) : [...freshPrints, printRecord];

      await Promise.all([setCollection('prints', nextPrints), setCollection('spools', nextSpools)]);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Category" value={category} onChangeText={setCategory} />
      <Field label="Printer" value={printer} onChangeText={setPrinter} />
      <View style={styles.row}>
        <View style={styles.half}>
          <Field label="Hours" value={hrs} onChangeText={setHrs} keyboardType="decimal-pad" />
        </View>
        <View style={styles.half}>
          <Field label="Qty" value={qty} onChangeText={setQty} keyboardType="number-pad" />
        </View>
      </View>
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />

      <View style={styles.filamentHeader}>
        <Text style={styles.sectionLabel}>Filament Used</Text>
        <Pressable onPress={addFilamentRow}>
          <Text style={styles.addLink}>+ Add</Text>
        </Pressable>
      </View>

      {loadingSpools ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
      ) : (
        filaments.map((f, idx) => {
          const spool = spools.find((s) => s.id === f.spoolId);
          return (
            <View key={idx} style={styles.filamentRow}>
              <View style={styles.filamentRowTop}>
                <Pressable
                  style={styles.spoolPicker}
                  onPress={() => setPickerRow(pickerRow === idx ? null : idx)}
                >
                  <View style={[styles.colorDot, { backgroundColor: spool?.color || colors.border }]} />
                  <Text style={styles.spoolPickerText} numberOfLines={1}>
                    {spool ? `${spool.name} (${spool.material})` : 'Select spool'}
                  </Text>
                </Pressable>
                <TextInput
                  style={styles.gramsInput}
                  placeholder="grams"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={f.grams ? String(f.grams) : ''}
                  onChangeText={(v) => updateFilament(idx, { grams: Number(v) || 0 })}
                />
                <Pressable onPress={() => removeFilament(idx)} style={styles.removeButton}>
                  <Text style={styles.removeButtonText}>×</Text>
                </Pressable>
              </View>

              {pickerRow === idx && (
                <ScrollView style={styles.spoolList} nestedScrollEnabled>
                  {spools.map((s) => (
                    <Pressable
                      key={s.id}
                      style={styles.spoolOption}
                      onPress={() => {
                        updateFilament(idx, { spoolId: s.id });
                        setPickerRow(null);
                      }}
                    >
                      <View style={[styles.colorDot, { backgroundColor: s.color || colors.border }]} />
                      <Text style={styles.spoolOptionText}>
                        {s.name} ({s.material}) · {s.remaining.toFixed(0)}g left
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          );
        })
      )}

      {isEdit && (
        <Text style={styles.hint}>
          Editing filament grams only applies the difference to spool inventory — it won't double-deduct.
        </Text>
      )}

      <Pressable style={styles.saveButton} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.saveButtonText}>Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  field: { marginBottom: 14 },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  filamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  sectionLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  addLink: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  filamentRow: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 8,
  },
  filamentRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spoolPicker: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  spoolPickerText: { color: colors.text, fontSize: 13, flexShrink: 1 },
  gramsInput: {
    width: 70,
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  removeButton: { paddingHorizontal: 6 },
  removeButtonText: { color: colors.danger, fontSize: 20, lineHeight: 20 },
  spoolList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    maxHeight: 220,
  },
  spoolOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  spoolOptionText: { color: colors.textMuted, fontSize: 12 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: 8, fontStyle: 'italic' },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
