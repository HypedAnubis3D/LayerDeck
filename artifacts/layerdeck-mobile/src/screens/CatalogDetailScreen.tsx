import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CatalogStackParamList } from '../navigation/CatalogStackNavigator';
import { getCollection, setCollection, uid } from '../lib/userData';
import { colors } from '../lib/theme';
import type { CatalogItem } from '../types';

type Props = NativeStackScreenProps<CatalogStackParamList, 'CatalogDetail'>;

function blankItem(): CatalogItem {
  return {
    id: uid(),
    name: '',
    photo: '',
    price: 0,
    cost: 0,
    stockQty: 0,
    lowStockAt: 3,
    category: '',
    tags: [],
    description: '',
    variants: [],
    tmfId: null,
    createdAt: Date.now(),
  };
}

export default function CatalogDetailScreen({ route, navigation }: Props) {
  const existing = route.params?.item;
  const [item, setItem] = useState<CatalogItem>(existing ?? blankItem());
  const [saving, setSaving] = useState(false);
  const [tagsText, setTagsText] = useState((existing?.tags ?? []).join(', '));

  const update = (patch: Partial<CatalogItem>) => setItem((prev) => ({ ...prev, ...patch }));

  const onSave = async () => {
    if (!item.name.trim()) {
      Alert.alert('Name required', 'Give this product a name.');
      return;
    }
    setSaving(true);
    try {
      const all = await getCollection<CatalogItem>('catalog');
      const idx = all.findIndex((c) => c.id === item.id);
      const finalItem: CatalogItem = {
        ...item,
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const next = idx >= 0 ? all.map((c, i) => (i === idx ? finalItem : c)) : [...all, finalItem];
      await setCollection('catalog', next);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const photo = item.photo || item.shopifyImage;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.photoPreview} />
      ) : (
        <View style={[styles.photoPreview, styles.photoPlaceholder]}>
          <Text style={styles.photoPlaceholderText}>No photo</Text>
        </View>
      )}

      <Field label="Photo URL" value={item.photo} onChangeText={(v) => update({ photo: v })} />
      <Field label="Name" value={item.name} onChangeText={(v) => update({ name: v })} />
      <Field label="Category" value={item.category} onChangeText={(v) => update({ category: v })} />

      <View style={styles.row}>
        <View style={styles.half}>
          <Field
            label="Price"
            value={String(item.price ?? '')}
            onChangeText={(v) => update({ price: Number(v) || 0 })}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.half}>
          <Field
            label="Cost"
            value={String(item.cost ?? '')}
            onChangeText={(v) => update({ cost: Number(v) || 0 })}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Field
            label="Stock Qty"
            value={String(item.stockQty ?? '')}
            onChangeText={(v) => update({ stockQty: Number(v) || 0 })}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.half}>
          <Field
            label="Low Stock At"
            value={String(item.lowStockAt ?? '')}
            onChangeText={(v) => update({ lowStockAt: Number(v) || 3 })}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <Field label="Tags (comma separated)" value={tagsText} onChangeText={setTagsText} />
      <Field
        label="Description"
        value={item.description}
        onChangeText={(v) => update({ description: v })}
        multiline
      />

      {!!item.variants?.length && (
        <>
          <Text style={styles.sectionLabel}>Variants ({item.variants.length})</Text>
          {item.variants.map((v, idx) => (
            <View key={idx} style={styles.variantRow}>
              <Text style={styles.variantText}>
                {v.title} · ${v.price?.toFixed(2)}
              </Text>
            </View>
          ))}
        </>
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
  photoPreview: { width: '100%', height: 180, borderRadius: 12, marginBottom: 16, backgroundColor: colors.card },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  photoPlaceholderText: { color: colors.textMuted, fontSize: 13 },
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
  sectionLabel: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 10 },
  variantRow: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variantText: { color: colors.text, fontSize: 13 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
