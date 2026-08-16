import { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CatalogStackParamList } from '../navigation/CatalogStackNavigator';
import { useCollection } from '../lib/useCollection';
import { colors } from '../lib/theme';
import type { CatalogItem } from '../types';

type Props = NativeStackScreenProps<CatalogStackParamList, 'CatalogList'>;

export default function CatalogListScreen({ navigation }: Props) {
  const { items, loading, refreshing, error, refresh, save } = useCollection<CatalogItem>('catalog');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    return items
      .filter((i) => categoryFilter === 'all' || i.category === categoryFilter)
      .filter((i) => !lowStockOnly || (i.stockQty != null && i.stockQty <= (i.lowStockAt ?? 3)))
      .filter((i) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q);
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [items, search, categoryFilter, lowStockOnly]);

  const adjustStock = (item: CatalogItem, delta: number) => {
    const next = items.map((i) =>
      i.id === item.id ? { ...i, stockQty: Math.max(0, (i.stockQty ?? 0) + delta) } : i
    );
    save(next);
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
          placeholder="Search products..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <Pressable style={styles.newButton} onPress={() => navigation.navigate('CatalogDetail', undefined)}>
          <Text style={styles.newButtonText}>+ New</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.chip, lowStockOnly && styles.chipActive]}
          onPress={() => setLowStockOnly((v) => !v)}
        >
          <Text style={[styles.chipText, lowStockOnly && styles.chipTextActive]}>Low stock</Text>
        </Pressable>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        ListEmptyComponent={<Text style={styles.empty}>No products match.</Text>}
        renderItem={({ item }) => {
          const isLow = item.stockQty != null && item.stockQty <= (item.lowStockAt ?? 3);
          const photo = item.photo || item.shopifyImage;
          return (
            <Pressable style={styles.card} onPress={() => navigation.navigate('CatalogDetail', { item })}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]} />
              )}
              <View style={styles.cardBody}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.meta}>
                  ${item.price?.toFixed(2)} · {item.category}
                  {item.fromShopify ? ' · Shopify' : ''}
                </Text>
                <View style={styles.stockRow}>
                  <Pressable style={styles.stockButton} onPress={() => adjustStock(item, -1)}>
                    <Text style={styles.stockButtonText}>−</Text>
                  </Pressable>
                  <Text style={[styles.stockValue, isLow && { color: colors.danger }]}>
                    {item.stockQty ?? 0} in stock
                  </Text>
                  <Pressable style={styles.stockButton} onPress={() => adjustStock(item, 1)}>
                    <Text style={styles.stockButtonText}>+</Text>
                  </Pressable>
                </View>
                {isLow && <Text style={styles.lowStockText}>⚠ Low stock</Text>}
              </View>
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
  newButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  newButtonText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
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
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: colors.bg, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photo: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.bg },
  photoPlaceholder: { borderWidth: 1, borderColor: colors.border },
  cardBody: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  stockButton: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockButtonText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  stockValue: { color: colors.textMuted, fontSize: 12, flex: 1 },
  lowStockText: { color: colors.danger, fontSize: 11, marginTop: 4, fontWeight: '600' },
  error: { color: colors.danger, marginHorizontal: 16, marginBottom: 8 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
