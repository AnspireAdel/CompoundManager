import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import PasswordInput from '@/components/PasswordInput';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const u = await login(username, password);
      const needsSetup = u.mustChangePassword || u.mustChangeUsername;
      router.replace(needsSetup ? '/force-change-password' : '/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>إدارة المجمع السكني</Text>
          <Text style={styles.subtitle}>تسجيل دخول الملاك</Text>
          <Text style={styles.hint}>المدير والمحاسب يستخدمان نسخة الويب</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>اسم المستخدم</Text>
          <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" textAlign="right" />

          <Text style={styles.label}>كلمة المرور</Text>
          <PasswordInput value={password} onChangeText={setPassword} />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>دخول</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/forgot-password')}>
            <Text style={styles.link}>نسيت كلمة المرور؟</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text style={styles.link}>تسجيل حساب جديد</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e293b' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { textAlign: 'center', color: '#64748b', marginBottom: 6 },
  hint: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginBottom: 20 },
  label: { fontWeight: '600', marginBottom: 6, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'center' },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 14, fontWeight: '600' },
});
