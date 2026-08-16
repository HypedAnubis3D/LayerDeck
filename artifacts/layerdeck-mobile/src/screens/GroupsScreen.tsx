import { useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PrintsStackParamList } from '../navigation/PrintsStackNavigator';
import { useCollection } from '../lib/useCollection';
import { uid } from '../lib/userData';
import { colors } from '../lib/theme';
import type { PrintGroup } from '../types';

type Props = NativeStackScreenProps<PrintsStackParamList, 'Groups'>;

export default function GroupsScreen({ navigation }: Props) {
  const { items: groups, loading, save } = useCollection<PrintGroup>('printGroups');
  const [newName, setNewName] = useState('');

  const createGroup = async () => {
    const name = newName.trim();
    if (!name) return;
    await save([...groups, { id: uid(), name, printIds: [] }]);
    setNewName('');
  };

  const deleteGroup = (group: PrintGroup) => {
    Alert.alert('Delete group?', `"${group.name}" will be removed. The prints in it are not affected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => save(groups.filter((g) => g.id !== group.id)),
      },
    ]);
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
      <View style={styles.newRow}>
        <TextInput
          style={styles.input}
          placeholder="New group name..."
          placeholderTextColor={colors.textMuted}
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={createGroup}
        />
        <Pressable style={styles.addButton} onPress={createGroup}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No groups yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('GroupMembers', { group: item })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{item.printIds.length} print{item.printIds.length === 1 ? '' : 's'}</Text>
            </View>
            <Pressable style={styles.deleteButton} onPress={() => deleteGroup(item)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  newRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addButtonText: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  listContent: { padding: 16, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  deleteButton: { paddingHorizontal: 10, paddingVertical: 6 },
  deleteButtonText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
});
