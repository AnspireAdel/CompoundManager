import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import PasswordInput from '@/components/PasswordInput';

export default function ForceChangePasswordScreen() {
  const { user, updateUser, logout } = useAuth();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
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
      await api.changePassword(undefined, newPassword);
      if (user) updateUser({ ...user, mustChangePassword: false });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>تغيير كلمة المرور مطلوب</Text>
          <Text style={styles.subtitle}>
            تم إنشاء حسابك بكلمة مرور مؤقتة. عيّن كلمة مرور جديدة للمتابعة.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>كلمة المرور الجديدة</Text>
          <PasswordInput value={newPassword} onChangeText={setNewPassword} />

          <Text style={styles.label}>تأكيد كلمة المرور</Text>
          <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} />

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>حفظ والمتابعة</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => logout()}>
            <Text style={styles.link}>تسجيل الخروج</Text>
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
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', color: '#64748b', marginBottom: 20, lineHeight: 22 },
  label: { fontWeight: '600', marginBottom: 6, textAlign: 'right' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'center' },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 16, fontWeight: '600' },
});
