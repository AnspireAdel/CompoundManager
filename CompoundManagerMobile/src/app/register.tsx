import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api, UnitType } from '@/api/client';
import PasswordInput from '@/components/PasswordInput';

export default function RegisterScreen() {
  const router = useRouter();
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', mobile: '',
    area: '', buildingNo: '', floorNo: '1', apartmentNo: '1',
    residentType: 'O' as 'O' | 'T',
    unitTypeId: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getUnitTypes().then((types) => {
      setUnitTypes(types);
      if (types[0]) setForm((f) => ({ ...f, unitTypeId: types[0].id }));
    }).catch(console.error);
  }, []);

  const selectedType = unitTypes.find((t) => t.id === form.unitTypeId);

  async function handleRegister() {
    if (form.password !== form.confirmPassword) {
      Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين');
      return;
    }
    if (!form.unitTypeId) {
      Alert.alert('خطأ', 'اختر نوع الوحدة');
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword: _, ...rest } = form;
      const result = await api.register({
        ...rest,
        floorNo: selectedType?.hasFloor ? Number(form.floorNo) : 0,
        apartmentNo: selectedType?.hasApartment ? Number(form.apartmentNo) : 0,
        unitTypeId: Number(form.unitTypeId),
      });
      Alert.alert('تم', result.message, [{ text: 'حسناً', onPress: () => router.replace('/login') }]);
    } catch (err) {
      Alert.alert('خطأ', err instanceof Error ? err.message : 'فشل التسجيل');
    } finally {
      setLoading(false);
    }
  }

  const fields: Array<[Exclude<keyof typeof form, 'residentType' | 'unitTypeId' | 'floorNo' | 'apartmentNo'>, string, boolean?]> = [
    ['name', 'الاسم'],
    ['email', 'البريد الإلكتروني'],
    ['password', 'كلمة المرور', true],
    ['confirmPassword', 'تأكيد كلمة المرور', true],
    ['mobile', 'الموبايل'],
    ['area', 'المجاورة'],
    ['buildingNo', 'القطعة'],
  ];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>تسجيل حساب جديد</Text>
          <Text style={styles.subtitle}>بانتظار موافقة المدير قبل الدخول</Text>

          <Text style={styles.label}>نوع السكن</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, form.residentType === 'O' && styles.typeBtnActive]}
              onPress={() => setForm({ ...form, residentType: 'O' })}
            >
              <Text style={[styles.typeText, form.residentType === 'O' && styles.typeTextActive]}>مالك</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, form.residentType === 'T' && styles.typeBtnActive]}
              onPress={() => setForm({ ...form, residentType: 'T' })}
            >
              <Text style={[styles.typeText, form.residentType === 'T' && styles.typeTextActive]}>مستأجر</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>نوع الوحدة</Text>
          <View style={styles.unitTypesWrap}>
            {unitTypes.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.unitChip, form.unitTypeId === t.id && styles.unitChipActive]}
                onPress={() => setForm({
                  ...form,
                  unitTypeId: t.id,
                  floorNo: t.hasFloor ? (form.floorNo === '0' ? '1' : form.floorNo) : '0',
                  apartmentNo: t.hasApartment ? (form.apartmentNo === '0' ? '1' : form.apartmentNo) : '0',
                })}
              >
                <Text style={[styles.unitChipText, form.unitTypeId === t.id && styles.unitChipTextActive]}>
                  {t.name}
                </Text>
                <Text style={[styles.unitChipFees, form.unitTypeId === t.id && styles.unitChipTextActive]}>
                  {t.monthlyFees} ج.م
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedType ? (
            <Text style={styles.feesHint}>الرسوم الشهرية: {selectedType.monthlyFees.toLocaleString()} ج.م</Text>
          ) : null}

          {fields.map(([key, label, isPassword]) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              {isPassword ? (
                <PasswordInput
                  value={form[key]}
                  onChangeText={(v) => setForm({ ...form, [key]: v })}
                  containerStyle={styles.passwordWrap}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  value={form[key]}
                  onChangeText={(v) => setForm({ ...form, [key]: v })}
                  keyboardType={key === 'email' ? 'email-address' : 'default'}
                  autoCapitalize="none"
                  textAlign="right"
                />
              )}
            </View>
          ))}

          {selectedType?.hasFloor !== false && (
            <View>
              <Text style={styles.label}>الدور</Text>
              <TextInput
                style={styles.input}
                value={form.floorNo}
                onChangeText={(v) => setForm({ ...form, floorNo: v })}
                keyboardType="number-pad"
                textAlign="right"
              />
            </View>
          )}

          {selectedType?.hasApartment !== false && (
            <View>
              <Text style={styles.label}>الشقة</Text>
              <TextInput
                style={styles.input}
                value={form.apartmentNo}
                onChangeText={(v) => setForm({ ...form, apartmentNo: v })}
                keyboardType="number-pad"
                textAlign="right"
              />
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>إرسال الطلب</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>العودة لتسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e293b' },
  scroll: { padding: 24, paddingVertical: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#64748b', marginBottom: 20, marginTop: 4 },
  label: { fontWeight: '600', marginBottom: 6, textAlign: 'right' },
  typeRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 14 },
  typeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  typeBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typeText: { fontWeight: '600', color: '#475569' },
  typeTextActive: { color: '#fff' },
  unitTypesWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  unitChip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 88,
  },
  unitChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  unitChipText: { fontWeight: '700', color: '#334155' },
  unitChipFees: { fontSize: 11, color: '#64748b', marginTop: 2 },
  unitChipTextActive: { color: '#fff' },
  feesHint: { textAlign: 'right', color: '#64748b', marginBottom: 12, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  passwordWrap: { marginBottom: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 14, fontWeight: '600' },
});
