import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDrawer } from '../lib/DrawerContext';
import { colors } from '../lib/theme';

export default function DrawerMenuButton() {
  const { open } = useDrawer();
  return (
    <Pressable onPress={open} style={styles.button} hitSlop={8}>
      <Ionicons name="menu-outline" size={24} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { marginLeft: 12 },
});
