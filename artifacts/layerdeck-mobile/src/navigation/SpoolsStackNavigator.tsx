import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import SpoolsScreen from '../screens/SpoolsScreen';
import UsageHistoryScreen from '../screens/UsageHistoryScreen';
import HeaderTitle from './HeaderTitle';
import { colors } from '../lib/theme';

export type SpoolsStackParamList = {
  SpoolsMain: undefined;
  UsageHistory: undefined;
};

const Stack = createNativeStackNavigator<SpoolsStackParamList>();

export default function SpoolsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.accent,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="SpoolsMain"
        component={SpoolsScreen}
        options={({ navigation }) => ({
          headerTitle: () => <HeaderTitle title="Spools" />,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => navigation.navigate('UsageHistory')} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>History</Text>
              </Pressable>
            </View>
          ),
        })}
      />
      <Stack.Screen name="UsageHistory" component={UsageHistoryScreen} options={{ title: 'Usage History' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: 12, marginRight: 8 },
  headerButton: {},
  headerButtonText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
});
