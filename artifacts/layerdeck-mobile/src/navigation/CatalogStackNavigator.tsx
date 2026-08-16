import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CatalogListScreen from '../screens/CatalogListScreen';
import CatalogDetailScreen from '../screens/CatalogDetailScreen';
import HeaderTitle from './HeaderTitle';
import DrawerMenuButton from './DrawerMenuButton';
import { colors } from '../lib/theme';
import type { CatalogItem } from '../types';

export type CatalogStackParamList = {
  CatalogList: undefined;
  CatalogDetail: { item?: CatalogItem } | undefined;
};

const Stack = createNativeStackNavigator<CatalogStackParamList>();

export default function CatalogStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="CatalogList"
        component={CatalogListScreen}
        options={{ headerTitle: () => <HeaderTitle title="Catalog" />, headerLeft: () => <DrawerMenuButton /> }}
      />
      <Stack.Screen
        name="CatalogDetail"
        component={CatalogDetailScreen}
        options={({ route }) => ({ title: route.params?.item ? 'Edit Product' : 'New Product' })}
      />
    </Stack.Navigator>
  );
}
