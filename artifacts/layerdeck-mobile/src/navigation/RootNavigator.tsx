import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import SignInScreen from '../screens/SignInScreen';
import OrdersStackNavigator from './OrdersStackNavigator';
import QueueScreen from '../screens/QueueScreen';
import SpoolsScreen from '../screens/SpoolsScreen';
import PrintersScreen from '../screens/PrintersScreen';
import HeaderTitle from './HeaderTitle';
import { colors } from '../lib/theme';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    border: colors.border,
    primary: colors.accent,
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="OrdersTab"
        component={OrdersStackNavigator}
        options={{ title: 'Orders', headerShown: false }}
      />
      <Tab.Screen
        name="Queue"
        component={QueueScreen}
        options={{ title: 'Print Queue', headerTitle: () => <HeaderTitle title="Print Queue" /> }}
      />
      <Tab.Screen
        name="Spools"
        component={SpoolsScreen}
        options={{ title: 'Spools', headerTitle: () => <HeaderTitle title="Spools" /> }}
      />
      <Tab.Screen
        name="Printers"
        component={PrintersScreen}
        options={{ title: 'Printers', headerTitle: () => <HeaderTitle title="Printers" /> }}
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
