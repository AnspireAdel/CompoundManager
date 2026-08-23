import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/client';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const result = await api.forgotPassword(email);
      if (result.resetToken) {
        if (Platform.OS === 'web') {
          window.alert(`رمز إعادة التعيين: ${result.resetToken}`);
          router.push({
            pathname: '/reset-password',
            params: { email, token: result.resetToken },
          });
        } else {
          Alert.alert('رمز إعادة التعيين', result.resetToken, [
            {
              text: 'متابعة',
              onPress: () =>
                router.push({
                  pathname: '/reset-password',
                  params: { email, token: result.resetToken },
                }),
            },
          ]);
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert(result.message);
        } else {
          Alert.alert('تم', result.message);
        }
      }
    } catch (err) {
      Alert.alert('خطأ', err instanceof Error ? err.message : 'فشل الطلب');
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

          <Text style={styles.title}>نسيت كلمة المرور</Text>
          <Text style={styles.subtitle}>أدخل بريدك الإلكتروني لإعادة تعيين كلمة المرور</Text>

          <Text style={styles.label}>البريد الإلكتروني</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textAlign="right"
            placeholder="example@domain.com"
            placeholderTextColor="#94A3B8"
          />

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>إرسال رمز التعيين</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>العودة لتسجيل الدخول</Text>
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
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 14,
    marginBottom: 24,
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
    marginBottom: 20,
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
  backLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  backLinkText: {
    color: '#024C59',
    fontWeight: '600',
    fontSize: 14,
  },
});

