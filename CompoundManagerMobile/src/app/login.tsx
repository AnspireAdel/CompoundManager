import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Image,
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/logo-only.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>اسم المستخدم</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            textAlign="right"
            placeholder="أدخل اسم المستخدم الخاص بك"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>كلمة المرور</Text>
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••••••"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            inputStyle={{ paddingLeft: 44 }}
          />

          <TouchableOpacity style={styles.forgotPasswordLink} onPress={() => router.push('/forgot-password')}>
            <Text style={styles.forgotPasswordText}>نسيت كلمة المرور؟</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>تسجيل الدخول</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerLink} onPress={() => router.push('/register')}>
            <Text style={styles.registerText}>
              مستخدم جديد؟ <Text style={styles.registerAction}>سجل الآن</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFD',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 100,
    height: 120,
  },
  label: {
    fontWeight: '600',
    color: '#334155',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    textAlign: 'right',
  },
  forgotPasswordLink: {
    alignSelf: 'flex-start',
    marginTop: -8,
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#024C59',
    fontWeight: '600',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#024C59',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  error: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  registerLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  registerText: {
    color: '#64748B',
    fontSize: 14,
  },
  registerAction: {
    color: '#024C59',
    fontWeight: '700',
  },
});

