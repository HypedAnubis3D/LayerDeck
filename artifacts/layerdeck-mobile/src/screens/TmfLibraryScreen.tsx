import { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useCollection } from '../lib/useCollection';
import { getCollection, setCollection } from '../lib/userData';
import { colors } from '../lib/theme';
import type { CatalogItem, TmfLibItem } from '../types';

export default function TmfLibraryScreen() {
  const { items, loading } = useCollection<TmfLibItem>('tmfLib');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState<string | null>(null);

  useEffect(() => {
    getCollection<CatalogItem>('catalog').then(setCatalog).catch(() => {});
  }, []);

  const linkedTmfIds = useMemo(() => new Set(catalog.map((c) => c.tmfId).filter(Boolean)), [catalog]);

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return i.name?.toLowerCase().includes(q) || i.printer?.toLowerCase().includes(q);
      })
      .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
  }, [items, search]);

  const linkToProduct = async (tmf: TmfLibItem, productId: string) => {
    setSavingLink(tmf.id);
    try {
      const fresh = await getCollection<CatalogItem>('catalog');
      const next = fresh.map((c) => (c.id === productId ? { ...c, tmfId: tmf.id } : c));
      await setCollection('catalog', next);
      setCatalog(next);
      setLinkingId(null);
    } finally {
      setSavingLink(null);
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
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search 3MF name, printer..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No 3MF files yet — sync from Desktop Companion.</Text>}
        renderItem={({ item }) => {
          const isLinked = linkedTmfIds.has(item.id);
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {isLinked && (
                  <View style={styles.linkedBadge}>
                    <Text style={styles.linkedBadgeText}>Linked</Text>
                  </View>
                )}
              </View>
              <Text style={styles.meta}>
                {item.printer} · {item.hrs}h · {item.layerHeight}mm layer · {item.nozzleDiam}mm nozzle
              </Text>

              {!item.hasGcode && <Text style={styles.warning}>⚠ Unsliced — no time/gram data</Text>}

              {!!item.filamentColors?.length && (
                <View style={styles.colorRow}>
                  {item.filamentColors.map((c, idx) => (
                    <View key={idx} style={[styles.colorDot, { backgroundColor: c || colors.border }]} />
                  ))}
                </View>
              )}

              {!isLinked && (
                <Pressable
                  style={styles.linkButton}
                  onPress={() => setLinkingId(linkingId === item.id ? null : item.id)}
                >
                  <Text style={styles.linkButtonText}>Link to Product</Text>
                </Pressable>
              )}

              {linkingId === item.id && (
                <View style={styles.productPicker}>
                  {catalog.length === 0 && <Text style={styles.pickerEmpty}>No products in catalog yet.</Text>}
                  {catalog.map((c) => (
                    <Pressable
                      key={c.id}
                      style={styles.productOption}
                      disabled={savingLink === item.id}
                      onPress={() => linkToProduct(item, c.id)}
                    >
                      <Text style={styles.productOptionText} numberOfLines={1}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  search: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  warning: { color: colors.warning, fontSize: 11, marginTop: 6, fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
  linkedBadge: { backgroundColor: `${colors.success}33`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  linkedBadgeText: { color: colors.success, fontSize: 11, fontWeight: '600' },
  linkButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  linkButtonText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  productPicker: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  pickerEmpty: { color: colors.textMuted, fontSize: 12 },
  productOption: { paddingVertical: 8 },
  productOptionText: { color: colors.text, fontSize: 13 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
