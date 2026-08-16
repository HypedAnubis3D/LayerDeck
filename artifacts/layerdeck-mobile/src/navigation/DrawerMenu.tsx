import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrawer } from '../lib/DrawerContext';
import { useAuth } from '../lib/AuthContext';
import { navigate } from './navigationRef';
import { colors, fonts } from '../lib/theme';

const DRAWER_WIDTH = Math.min(300, Dimensions.get('window').width * 0.8);

interface MenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const SECTIONS: MenuSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', icon: 'home-outline', screen: 'Dashboard' }],
  },
  {
    title: 'Business',
    items: [
      { label: 'Product Catalog', icon: 'pricetags-outline', screen: 'Catalog' },
      { label: '3MF Library', icon: 'cube-outline', screen: 'TmfLibrary' },
    ],
  },
  {
    title: 'System',
    items: [{ label: 'Settings', icon: 'settings-outline', screen: 'Settings' }],
  },
];

export default function DrawerMenu() {
  const { isOpen, close } = useDrawer();
  const { session, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  // Driven via `left` (a layout property, not `transform`) specifically so
  // this can't use the native driver — transform + useNativeDriver has
  // inconsistent behavior across RN Web vs. native Android for a drawer
  // that must render correctly hidden on first mount, and getting that
  // wrong means the drawer showing open by default. JS-driven animation
  // is a little less smooth but reliable everywhere.
  const left = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(left, {
        toValue: isOpen ? 0 : -DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isOpen, left, backdropOpacity]);

  const go = (screen: string) => {
    close();
    navigate(screen);
  };

  return (
    <>
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View
        style={[styles.drawer, { width: DRAWER_WIDTH, paddingTop: insets.top + 16, left }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <Text style={styles.brandTitle}>LAYERDECK</Text>
            <Text style={styles.brandSubtitle}>powered by HypedAnubis3D</Text>
          </View>

          {SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item) => (
                <Pressable key={item.screen} style={styles.item} onPress={() => go(item.screen)}>
                  <Ionicons name={item.icon} size={18} color={colors.textMuted} />
                  <Text style={styles.itemLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ))}

          <View style={styles.footer}>
            {!!session?.user?.email && <Text style={styles.email}>{session.user.email}</Text>}
            <Pressable style={styles.signOutButton} onPress={() => { close(); signOut(); }}>
              <Ionicons name="log-out-outline" size={16} color={colors.danger} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 20,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.navBg,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    zIndex: 21,
    paddingHorizontal: 16,
  },
  brand: { marginBottom: 20 },
  brandTitle: { color: colors.accent, fontSize: 18, fontFamily: fonts.display, letterSpacing: 2 },
  brandSubtitle: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  section: { marginBottom: 18 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  itemLabel: { color: colors.text, fontSize: 14 },
  footer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 24,
  },
  email: { color: colors.textMuted, fontSize: 11, marginBottom: 12 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signOutText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
