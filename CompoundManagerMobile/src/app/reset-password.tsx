import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Image
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/api/client';
import PasswordInput from '@/components/PasswordInput';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const [email, setEmail] = useState(params.email || '');
  const [token, setToken] = useState(params.token || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !token.trim() || !newPassword || !confirmPassword) {
      setError('برجاء ملء جميع الحقول المطلوبة');
      return;
    }
    if (newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    try {
      const result = await api.resetPassword(email.trim(), token.trim(), newPassword);
      if (Platform.OS === 'web') {
        window.alert(result.message);
        router.replace('/login');
      } else {
        Alert.alert('تم بنجاح', result.message, [{ text: 'حسناً', onPress: () => router.replace('/login') }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إعادة تعيين كلمة المرور');
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

          <Text style={styles.title}>تعيين كلمة مرور جديدة</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>البريد الإلكتروني</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textAlign="right"
            placeholder="أدخل بريدك الإلكتروني"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>رمز التحقق (الرمز)</Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            textAlign="right"
            placeholder="أدخل رمز التحقق المرسل إليك"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>كلمة المرور الجديدة</Text>
          <PasswordInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="أدخل كلمة المرور الجديدة"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            inputStyle={{ paddingLeft: 44 }}
          />

          <Text style={styles.label}>تأكيد كلمة المرور</Text>
          <PasswordInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="أعد إدخال كلمة المرور لتأكيدها"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            inputStyle={{ paddingLeft: 44 }}
          />

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>حفظ وتحديث</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={() => router.replace('/login')}>
            <Text style={styles.loginLinkText}>
              العودة إلى <Text style={styles.loginAction}>تسجيل الدخول</Text>
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
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 100,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#024C59',
    textAlign: 'center',
    marginBottom: 20,
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
    fontSize: 13,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 20,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#475569',
  },
  loginAction: {
    color: '#024C59',
    fontWeight: '700',
  },
});
