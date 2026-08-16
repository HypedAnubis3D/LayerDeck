import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PrintsListScreen from '../screens/PrintsListScreen';
import PrintFormScreen from '../screens/PrintFormScreen';
import FailRatesScreen from '../screens/FailRatesScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupMembersScreen from '../screens/GroupMembersScreen';
import WasteLogScreen from '../screens/WasteLogScreen';
import HeaderTitle from './HeaderTitle';
import DrawerMenuButton from './DrawerMenuButton';
import { colors } from '../lib/theme';
import type { Print, PrintGroup } from '../types';

export type PrintsStackParamList = {
  PrintsList: undefined;
  PrintForm: { print?: Print } | undefined;
  FailRates: undefined;
  Groups: undefined;
  GroupMembers: { group: PrintGroup };
  WasteLog: undefined;
};

const Stack = createNativeStackNavigator<PrintsStackParamList>();

export default function PrintsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="PrintsList"
        component={PrintsListScreen}
        options={{ headerTitle: () => <HeaderTitle title="Prints" />, headerLeft: () => <DrawerMenuButton /> }}
      />
      <Stack.Screen
        name="PrintForm"
        component={PrintFormScreen}
        options={({ route }) => ({ title: route.params?.print ? 'Edit Print' : 'Log Print' })}
      />
      <Stack.Screen name="FailRates" component={FailRatesScreen} options={{ title: 'Fail Rates' }} />
      <Stack.Screen name="Groups" component={GroupsScreen} options={{ title: 'Groups' }} />
      <Stack.Screen name="GroupMembers" component={GroupMembersScreen} options={{ title: 'Group Members' }} />
      <Stack.Screen name="WasteLog" component={WasteLogScreen} options={{ title: 'Fail Rates & Waste' }} />
    </Stack.Navigator>
  );
}
