import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/AuthContext';
import SignInScreen from '../screens/SignInScreen';
import OrdersStackNavigator from './OrdersStackNavigator';
import PrintsStackNavigator from './PrintsStackNavigator';
import QueueScreen from '../screens/QueueScreen';
import SpoolsStackNavigator from './SpoolsStackNavigator';
import PrintersStackNavigator from './PrintersStackNavigator';
import CatalogStackNavigator from './CatalogStackNavigator';
import DashboardScreen from '../screens/DashboardScreen';
import TmfLibraryScreen from '../screens/TmfLibraryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HeaderTitle from './HeaderTitle';
import DrawerMenuButton from './DrawerMenuButton';
import { navigationRef } from './navigationRef';
import { colors } from '../lib/theme';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.navBg,
    border: colors.border,
    primary: colors.accent,
  },
};

type IoniconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IoniconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
        headerLeft: () => <DrawerMenuButton />,
        tabBarStyle: { backgroundColor: colors.navBg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="OrdersTab"
        component={OrdersStackNavigator}
        options={{ title: 'Orders', headerShown: false, tabBarIcon: tabIcon('mail-outline') }}
      />
      <Tab.Screen
        name="PrintsTab"
        component={PrintsStackNavigator}
        options={{ title: 'Prints', headerShown: false, tabBarIcon: tabIcon('print-outline') }}
      />
      <Tab.Screen
        name="Queue"
        component={QueueScreen}
        options={{
          title: 'Print Queue',
          headerTitle: () => <HeaderTitle title="Print Queue" />,
          tabBarIcon: tabIcon('clipboard-outline'),
        }}
      />
      <Tab.Screen
        name="SpoolsTab"
        component={SpoolsStackNavigator}
        options={{ title: 'Spools', headerShown: false, tabBarIcon: tabIcon('disc-outline') }}
      />
      <Tab.Screen
        name="PrintersTab"
        component={PrintersStackNavigator}
        options={{ title: 'Printers', headerShown: false, tabBarIcon: tabIcon('hardware-chip-outline') }}
      />
    </Tab.Navigator>
  );
}

// Sits above the tabs so the hidden drawer nav can reach screens that
// aren't one of the 5 main tabs (those stay as-is — most-used, so they
// keep their dedicated bottom-tab slots).
function AppStack() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
      }}
    >
      <RootStack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <RootStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerTitle: () => <HeaderTitle title="Dashboard" />, headerLeft: () => <DrawerMenuButton /> }}
      />
      <RootStack.Screen name="Catalog" component={CatalogStackNavigator} options={{ headerShown: false }} />
      <RootStack.Screen
        name="TmfLibrary"
        component={TmfLibraryScreen}
        options={{ headerTitle: () => <HeaderTitle title="3MF Library" />, headerLeft: () => <DrawerMenuButton /> }}
      />
      <RootStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerTitle: () => <HeaderTitle title="Settings" />, headerLeft: () => <DrawerMenuButton /> }}
      />
    </RootStack.Navigator>
  );
}

export default function RootNavigator() {
  const { session, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {session ? <AppStack /> : <SignInScreen />}
    </NavigationContainer>
  );
}
