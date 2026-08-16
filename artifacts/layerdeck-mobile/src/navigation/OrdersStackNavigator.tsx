import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OrdersListScreen from '../screens/OrdersListScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import HeaderTitle from './HeaderTitle';
import DrawerMenuButton from './DrawerMenuButton';
import { colors } from '../lib/theme';
import type { Order } from '../types';

export type OrdersStackParamList = {
  OrdersList: undefined;
  OrderDetail: { order?: Order } | undefined;
};

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export default function OrdersStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="OrdersList"
        component={OrdersListScreen}
        options={{ headerTitle: () => <HeaderTitle title="Orders" />, headerLeft: () => <DrawerMenuButton /> }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={({ route }) => ({ title: route.params?.order ? 'Order' : 'New Order' })}
      />
    </Stack.Navigator>
  );
}
