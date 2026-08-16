import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/AuthContext';
import SignInScreen from '../screens/SignInScreen';
import OrdersStackNavigator from './OrdersStackNavigator';
import PrintsStackNavigator from './PrintsStackNavigator';
import QueueScreen from '../screens/QueueScreen';
import SpoolsStackNavigator from './SpoolsStackNavigator';
import PrintersStackNavigator from './PrintersStackNavigator';
import HeaderTitle from './HeaderTitle';
import { colors } from '../lib/theme';

const Tab = createBottomTabNavigator();

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
    <NavigationContainer theme={navTheme}>
      {session ? <MainTabs /> : <SignInScreen />}
    </NavigationContainer>
  );
}
