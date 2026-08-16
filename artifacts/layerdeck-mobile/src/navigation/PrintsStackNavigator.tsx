import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PrintsListScreen from '../screens/PrintsListScreen';
import PrintFormScreen from '../screens/PrintFormScreen';
import HeaderTitle from './HeaderTitle';
import { colors } from '../lib/theme';
import type { Print } from '../types';

export type PrintsStackParamList = {
  PrintsList: undefined;
  PrintForm: { print?: Print } | undefined;
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
        options={{ headerTitle: () => <HeaderTitle title="Prints" /> }}
      />
      <Stack.Screen
        name="PrintForm"
        component={PrintFormScreen}
        options={({ route }) => ({ title: route.params?.print ? 'Edit Print' : 'Log Print' })}
      />
    </Stack.Navigator>
  );
}
