import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
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
      } else {
        Alert.alert('تم', result.message);
      }
    } catch (err) {
      Alert.alert('خطأ', err instanceof Error ? err.message : 'فشل الطلب');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>نسيت كلمة المرور</Text>
        <Text style={styles.label}>البريد الإلكتروني</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" textAlign="right" />
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>إرسال الرمز</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>العودة</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#1e293b' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  label: { fontWeight: '600', marginBottom: 6, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 14, fontWeight: '600' },
});
