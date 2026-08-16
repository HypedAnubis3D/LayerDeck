import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts as usePlusJakartaSans,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts as useOrbitron, Orbitron_700Bold, Orbitron_900Black } from '@expo-google-fonts/orbitron';
import { useFonts as useShareTechMono, ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import { AuthProvider } from './src/lib/AuthContext';
import { DrawerProvider } from './src/lib/DrawerContext';
import RootNavigator from './src/navigation/RootNavigator';
import DrawerMenu from './src/navigation/DrawerMenu';
import { colors } from './src/lib/theme';

export default function App() {
  const [jakartaLoaded] = usePlusJakartaSans({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [orbitronLoaded] = useOrbitron({ Orbitron_700Bold, Orbitron_900Black });
  const [monoLoaded] = useShareTechMono({ ShareTechMono_400Regular });

  if (!jakartaLoaded || !orbitronLoaded || !monoLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DrawerProvider>
          <RootNavigator />
          <DrawerMenu />
        </DrawerProvider>
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
