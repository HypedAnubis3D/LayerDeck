import { useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PrintsStackParamList } from '../navigation/PrintsStackNavigator';
import { useCollection } from '../lib/useCollection';
import { assignPrintToGroup } from '../lib/printGroups';
import { colors } from '../lib/theme';
import type { Print, PrintGroup } from '../types';

type Props = NativeStackScreenProps<PrintsStackParamList, 'GroupMembers'>;

export default function GroupMembersScreen({ route }: Props) {
  const groupId = route.params.group.id;
  const { items: groups, loading: loadingGroups, save: saveGroups } = useCollection<PrintGroup>('printGroups');
  const { items: prints, loading: loadingPrints } = useCollection<Print>('prints');
  const [search, setSearch] = useState('');

  const group = groups.find((g) => g.id === groupId) ?? route.params.group;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prints
      .filter((p) =>
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.printer?.toLowerCase().includes(q) ||
        String(p.hrs).includes(q)
      )
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [prints, search]);

  // A print belongs to at most one group — checking it here moves it out of
  // whichever group (if any) currently holds it, matching assignPrintToGroup.
  const toggle = (printId: string) => {
    const isMember = group.printIds.includes(printId);
    saveGroups(assignPrintToGroup(groups, printId, isMember ? null : groupId));
  };

  if (loadingGroups || loadingPrints) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{group.name}</Text>
      <Text style={styles.subtitle}>{group.printIds.length} print{group.printIds.length === 1 ? '' : 's'} in this group</Text>

      <TextInput
        style={styles.search}
        placeholder="Search name, printer, hours..."
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No prints match.</Text>}
        renderItem={({ item }) => {
          const checked = group.printIds.includes(item.id);
          return (
            <Pressable style={styles.row} onPress={() => toggle(item.id)}>
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name || 'Untitled print'}</Text>
                <Text style={styles.meta}>
                  {item.printer} · {item.hrs}h · {new Date(item.timestamp).toLocaleDateString()}
                </Text>
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
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 16, marginHorizontal: 16 },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2, marginHorizontal: 16, marginBottom: 12 },
  search: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: { padding: 16, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
