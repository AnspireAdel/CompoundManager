import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import PasswordInput from '@/components/PasswordInput';
import { Brand } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const u = await login(email, password);
      router.replace(u.mustChangePassword ? '/force-change-password' : '/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.hero}>
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
        <Text style={styles.brand}>الياسمين</Text>
        <Text style={styles.brandSub}>إدارة المجمع السكني</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <Text style={styles.hint}>للملاك والتابعين · الإدارة عبر الويب</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>البريد الإلكتروني</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textAlign="right"
            placeholder="name@email.com"
            placeholderTextColor={Brand.muted}
          />

          <Text style={styles.label}>كلمة المرور</Text>
          <PasswordInput value={password} onChangeText={setPassword} />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>دخول</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/forgot-password')}>
            <Text style={styles.link}>نسيت كلمة المرور؟</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.linkSecondary}>تسجيل حساب جديد</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.primaryDark },
  hero: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 72 : 48,
    paddingBottom: 20,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  brand: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  brandSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
  },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: Brand.text, marginBottom: 4 },
  hint: { textAlign: 'center', color: Brand.muted, fontSize: 12, marginBottom: 18 },
  label: { fontWeight: '600', marginBottom: 6, textAlign: 'right', color: Brand.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    fontSize: 16,
    backgroundColor: '#FAFCFA',
    color: Brand.text,
  },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: {
    backgroundColor: '#FEE2E2',
    color: Brand.danger,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    textAlign: 'center',
  },
  link: { color: Brand.primary, textAlign: 'center', marginTop: 16, fontWeight: '700' },
  linkSecondary: { color: Brand.textSecondary, textAlign: 'center', marginTop: 12, fontWeight: '600' },
});
