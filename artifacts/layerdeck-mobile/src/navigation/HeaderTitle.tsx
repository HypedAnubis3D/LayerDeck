import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

export default function HeaderTitle({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <Image
        source={require('../../assets/android-icon-foreground.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 26, height: 26 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
