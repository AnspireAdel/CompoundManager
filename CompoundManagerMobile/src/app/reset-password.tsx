import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
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

  async function handleSubmit() {
    if (newPassword !== confirmPassword) {
      Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    try {
      const result = await api.resetPassword(email, token, newPassword);
      Alert.alert('تم', result.message, [{ text: 'حسناً', onPress: () => router.replace('/login') }]);
    } catch (err) {
      Alert.alert('خطأ', err instanceof Error ? err.message : 'فشل إعادة التعيين');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>تعيين كلمة مرور جديدة</Text>
        <Text style={styles.label}>البريد</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" textAlign="right" />
        <Text style={styles.label}>الرمز</Text>
        <TextInput style={styles.input} value={token} onChangeText={setToken} autoCapitalize="none" textAlign="right" />
        <Text style={styles.label}>كلمة المرور الجديدة</Text>
        <PasswordInput value={newPassword} onChangeText={setNewPassword} />
        <Text style={styles.label}>تأكيد كلمة المرور</Text>
        <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} />
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>حفظ</Text>}
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
});
