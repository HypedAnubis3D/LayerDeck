import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import PrintersScreen from '../screens/PrintersScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import HeaderTitle from './HeaderTitle';
import { colors } from '../lib/theme';

export type PrintersStackParamList = {
  PrintersMain: undefined;
  Maintenance: undefined;
};

const Stack = createNativeStackNavigator<PrintersStackParamList>();

export default function PrintersStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="PrintersMain"
        component={PrintersScreen}
        options={({ navigation }) => ({
          headerTitle: () => <HeaderTitle title="Printers" />,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => navigation.navigate('Maintenance')} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>Maintenance</Text>
              </Pressable>
            </View>
          ),
        })}
      />
      <Stack.Screen name="Maintenance" component={MaintenanceScreen} options={{ title: 'Maintenance & Nozzles' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: 12, marginRight: 8 },
  headerButton: {},
  headerButtonText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
});
