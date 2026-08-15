import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useAuth } from '../lib/AuthContext';
import { colors } from '../lib/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setLoading(false);
    if (signInError) setError(signInError);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <Image
          source={require('../../assets/android-icon-foreground.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>LAYERDECK</Text>
        <Text style={styles.subtitle}>Sign in to your Studio Manager account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          onSubmitEditing={onSubmit}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.bg,
  },
  logo: { width: 180, height: 94, alignSelf: 'center', marginBottom: 8 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.danger, marginBottom: 12, fontSize: 14 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
