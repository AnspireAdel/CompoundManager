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
    username: '', name: '', email: '', password: '', confirmPassword: '', mobile: '',
    area: '', buildingNo: '', floorNo: '1', apartmentNo: '1',
    residentType: 'O' as 'O' | 'T',
    unitTypeId: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.getUnitTypes(), api.getSuggestedUsername()])
      .then(([types, suggested]) => {
        setUnitTypes(types);
        setForm((f) => ({
          ...f,
          unitTypeId: types[0]?.id ?? f.unitTypeId,
          username: f.username || suggested.username,
        }));
      })
      .catch(console.error);
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
        apartmentNo: selectedType?.hasApartment ? String(form.apartmentNo).trim() : '0',
        unitTypeId: Number(form.unitTypeId),
      });
      Alert.alert('تم', result.message, [{ text: 'حسناً', onPress: () => router.replace('/login') }]);
    } catch (err) {
      Alert.alert('خطأ', err instanceof Error ? err.message : 'فشل التسجيل');
    } finally {
      setLoading(false);
    }
  }

  const fields: Array<[Exclude<keyof typeof form, 'residentType' | 'unitTypeId' | 'floorNo' | 'apartmentNo'>, string, string, boolean?]> = [
    ['username', 'اسم المستخدم', 'أدخل اسم المستخدم'],
    ['name', 'الاسم الكامل', 'أدخل اسمك الكامل'],
    ['email', 'البريد الإلكتروني', 'example@domain.com'],
    ['password', 'كلمة المرور', '••••••••••••', true],
    ['confirmPassword', 'تأكيد كلمة المرور', '••••••••••••', true],
    ['mobile', 'رقم الموبايل', '05xxxxxxxx'],
    ['area', 'المجاورة', 'رقم المجاورة'],
    ['buildingNo', 'القطعة', 'رقم القطعة'],
  ];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>تسجيل حساب جديد</Text>
          <Text style={styles.subtitle}>بانتظار موافقة المدير قبل الدخول للنظام</Text>

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

          {fields.map(([key, label, placeholder, isPassword]) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              {key === 'username' ? (
                <Text style={styles.usernameHint}>اسم مستخدم مقترح تلقائياً — يمكنك تعديله</Text>
              ) : null}
              {isPassword ? (
                <PasswordInput
                  value={form[key]}
                  onChangeText={(v) => setForm({ ...form, [key]: v })}
                  containerStyle={styles.passwordWrap}
                  placeholder={placeholder}
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                  inputStyle={{ paddingLeft: 44 }}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  value={form[key]}
                  onChangeText={(v) => setForm({ ...form, [key]: v })}
                  keyboardType={key === 'email' ? 'email-address' : 'default'}
                  autoCapitalize="none"
                  maxLength={key === 'buildingNo' ? 5 : key === 'area' ? 3 : key === 'username' ? 32 : undefined}
                  textAlign="right"
                  placeholder={placeholder}
                  placeholderTextColor="#94A3B8"
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
                placeholder="أدخل رقم الدور"
                placeholderTextColor="#94A3B8"
              />
            </View>
          )}

          {selectedType?.hasApartment !== false && (
            <View>
              <Text style={styles.label}>رقم الشقة</Text>
              <TextInput
                style={styles.input}
                value={form.apartmentNo}
                onChangeText={(v) => setForm({ ...form, apartmentNo: v })}
                placeholder="مثال: 12 أو A1"
                placeholderTextColor="#94A3B8"
                textAlign="right"
              />
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>إرسال طلب التسجيل</Text>}
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
    padding: 24,
    paddingVertical: 40,
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 24,
    marginTop: 6,
    fontSize: 14,
  },
  label: {
    fontWeight: '600',
    color: '#334155',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'right',
    marginTop: 4,
  },
  usernameHint: {
    textAlign: 'right',
    color: '#64748B',
    fontSize: 12,
    marginBottom: 6,
  },
  typeRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  typeBtnActive: {
    backgroundColor: '#024C59',
    borderColor: '#024C59',
  },
  typeText: {
    fontWeight: '600',
    color: '#475569',
  },
  typeTextActive: {
    color: '#FFFFFF',
  },
  unitTypesWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  unitChip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 88,
    backgroundColor: '#FFFFFF',
  },
  unitChipActive: {
    backgroundColor: '#024C59',
    borderColor: '#024C59',
  },
  unitChipText: {
    fontWeight: '700',
    color: '#334155',
  },
  unitChipFees: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  unitChipTextActive: {
    color: '#FFFFFF',
  },
  feesHint: {
    textAlign: 'right',
    color: '#64748B',
    marginBottom: 16,
    fontSize: 13,
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
  passwordWrap: {
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#024C59',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
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

