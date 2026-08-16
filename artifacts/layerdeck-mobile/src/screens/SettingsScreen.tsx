import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/AuthContext';
import { colors } from '../lib/theme';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();

  const confirmSignOut = () => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="cloud-done-outline" size={18} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Connected</Text>
              <Text style={styles.rowSub}>{session?.user?.email ?? '—'}</Text>
            </View>
          </View>
        </View>
        <Pressable style={styles.signOutButton} onPress={confirmSignOut}>
          <Ionicons name="log-out-outline" size={16} color={colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <Text style={styles.rowSub}>
            LayerDeck Mobile replicates the Studio Manager web app. Orders, Print Queue, Spools,
            Prints, Printers, Dashboard, Product Catalog, and 3MF Library are live and synced to
            the same Supabase account as the web app.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.rowSub}>
            Not yet built: Convention POS (Square payments), Camera feeds &amp; AI vision, real
            Shopify/Etsy/Discord integrations, Labels &amp; Shipping, Backup &amp; Restore, and
            push notifications. These need either a payment SDK, native camera/WebRTC work, or
            server-side credentials that don't belong in a public mobile client.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 20 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingVertical: 8 },
  signOutText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
