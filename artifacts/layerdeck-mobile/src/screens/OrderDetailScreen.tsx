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
import type { OrdersStackParamList } from '../navigation/OrdersStackNavigator';
import { getCollection, setCollection, uid } from '../lib/userData';
import { colors } from '../lib/theme';
import type { Order, OrderItem } from '../types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderDetail'>;

const STATUS_OPTIONS = ['pending', 'processing', 'printing', 'ready', 'shipped', 'cancelled'];

function blankOrder(): Order {
  return {
    id: uid(),
    customer: '',
    orderId: '',
    platform: 'manual',
    date: new Date().toISOString().slice(0, 10),
    customerEmail: '',
    customerPhone: '',
    shippingAddress: '',
    items: [],
    status: 'pending',
    shipping: 0,
    notes: '',
    trackingNumber: '',
    timestamp: Date.now(),
    linkedPrintIds: [],
    miscCost: 0,
  };
}

export default function OrderDetailScreen({ route, navigation }: Props) {
  const existing = route.params?.order;
  const isNew = !existing;
  const [order, setOrder] = useState<Order>(existing ?? blankOrder());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew || !existing) return;
    (async () => {
      try {
        const all = await getCollection<Order>('orders');
        const fresh = all.find((o) => o.id === existing.id);
        if (fresh) setOrder(fresh);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<Order>) => setOrder((prev) => ({ ...prev, ...patch }));

  const addItem = () => update({ items: [...(order.items ?? []), { name: '', qty: 1, price: 0 }] });
  const updateItem = (idx: number, patch: Partial<OrderItem>) =>
    update({ items: (order.items ?? []).map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  const removeItem = (idx: number) => update({ items: (order.items ?? []).filter((_, i) => i !== idx) });

  const onSave = async () => {
    if (isNew && !order.customer.trim()) {
      Alert.alert('Customer required', 'Give this order a customer name.');
      return;
    }
    setSaving(true);
    try {
      const all = await getCollection<Order>('orders');
      const idx = all.findIndex((o) => o.id === order.id);

      // Mirrors studio-manager: entering a tracking number auto-upgrades
      // status to 'shipped', unless the order is already shipped/cancelled.
      let finalOrder = order;
      if (order.trackingNumber?.trim() && order.status !== 'shipped' && order.status !== 'cancelled') {
        finalOrder = { ...order, status: 'shipped' };
        setOrder(finalOrder);
      }

      const next = idx >= 0 ? all.map((o, i) => (i === idx ? finalOrder : o)) : [...all, finalOrder];
      await setCollection('orders', next);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="Customer" value={order.customer ?? ''} onChangeText={(v) => update({ customer: v })} />
      <Field label="Order ID" value={order.orderId ?? ''} onChangeText={(v) => update({ orderId: v })} />
      <Field label="Platform" value={order.platform ?? ''} onChangeText={(v) => update({ platform: v })} />
      <Field
        label="Customer Email"
        value={order.customerEmail ?? ''}
        onChangeText={(v) => update({ customerEmail: v })}
        keyboardType="email-address"
      />
      <Field
        label="Customer Phone"
        value={order.customerPhone ?? ''}
        onChangeText={(v) => update({ customerPhone: v })}
        keyboardType="phone-pad"
      />
      <Field
        label="Shipping Address"
        value={order.shippingAddress ?? ''}
        onChangeText={(v) => update({ shippingAddress: v })}
        multiline
      />

      <Text style={styles.sectionLabel}>
        Status{!STATUS_OPTIONS.includes(order.status) ? ` (current: ${order.status || 'none'})` : ''}
      </Text>
      <View style={styles.chipRow}>
        {STATUS_OPTIONS.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, order.status === s && styles.chipActive]}
            onPress={() => update({ status: s })}
          >
            <Text style={[styles.chipText, order.status === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Field
        label="Tracking Number"
        value={order.trackingNumber ?? ''}
        onChangeText={(v) => update({ trackingNumber: v })}
        hint="Entering a tracking number marks this order shipped."
      />
      <Field
        label="Shipping Cost"
        value={String(order.shipping ?? '')}
        onChangeText={(v) => update({ shipping: Number(v) || 0 })}
        keyboardType="decimal-pad"
      />
      <Field
        label="Misc Cost"
        value={String(order.miscCost ?? '')}
        onChangeText={(v) => update({ miscCost: Number(v) || 0 })}
        keyboardType="decimal-pad"
      />
      <Field
        label="Discount Code"
        value={order.discountCode ?? ''}
        onChangeText={(v) => update({ discountCode: v })}
      />
      <Field label="Notes" value={order.notes ?? ''} onChangeText={(v) => update({ notes: v })} multiline />

      <View style={styles.filamentHeader}>
        <Text style={styles.sectionLabel}>Items ({order.items?.length ?? 0})</Text>
        <Pressable onPress={addItem}>
          <Text style={styles.addLink}>+ Add</Text>
        </Pressable>
      </View>
      {(order.items ?? []).map((item, idx) => (
        <View key={idx} style={styles.itemRow}>
          <TextInput
            style={styles.itemNameInput}
            placeholder="Item name"
            placeholderTextColor={colors.textMuted}
            value={item.name}
            onChangeText={(v) => updateItem(idx, { name: v })}
          />
          <View style={styles.itemNumbersRow}>
            <TextInput
              style={styles.itemNumberInput}
              placeholder="qty"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={String(item.qty ?? '')}
              onChangeText={(v) => updateItem(idx, { qty: Number(v) || 1 })}
            />
            <TextInput
              style={styles.itemNumberInput}
              placeholder="price"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={item.price != null ? String(item.price) : ''}
              onChangeText={(v) => updateItem(idx, { price: Number(v) || 0 })}
            />
            <Pressable onPress={() => removeItem(idx)} style={styles.removeItemButton}>
              <Text style={styles.removeItemText}>×</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {!!order.linkedPrintIds?.length && (
        <>
          <Text style={styles.sectionLabel}>Linked Queue Items</Text>
          <Text style={styles.itemMeta}>{order.linkedPrintIds.join(', ')}</Text>
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
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'decimal-pad';
  multiline?: boolean;
  hint?: string;
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
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
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
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  sectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13, textTransform: 'capitalize' },
  chipTextActive: { color: colors.bg, fontWeight: '700' },
  filamentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addLink: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  itemRow: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemNameInput: { color: colors.text, fontSize: 14, fontWeight: '600', paddingVertical: 2 },
  itemNumbersRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  itemNumberInput: {
    flex: 1,
    backgroundColor: colors.bg,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeItemButton: { paddingHorizontal: 6 },
  removeItemText: { color: colors.danger, fontSize: 20, lineHeight: 20 },
  itemMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
