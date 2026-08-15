import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OrdersListScreen from '../screens/OrdersListScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import type { Order } from '../types';

export type OrdersStackParamList = {
  OrdersList: undefined;
  OrderDetail: { order: Order };
};

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export default function OrdersStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0b0f14' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="OrdersList" component={OrdersListScreen} options={{ title: 'Orders' }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
    </Stack.Navigator>
  );
}
