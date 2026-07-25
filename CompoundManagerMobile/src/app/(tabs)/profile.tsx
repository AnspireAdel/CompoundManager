import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { api, Resident, ServiceType, Dependent } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import PasswordInput from '@/components/PasswordInput';

const RELATION_OPTIONS = ['زوج', 'زوجة', 'ابن', 'ابنة', 'والد', 'والدة'];

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const isResident = user?.role === 'OWNER' || user?.role === 'DEPENDENT';
  const [form, setForm] = useState({ name: '', email: '', mobile: '', landLine: '', nationality: '' });
  const [resident, setResident] = useState<Partial<Resident> | null>(null);
  const [serviceForm, setServiceForm] = useState({
    serviceType: '',
    serviceName: '',
    mobile: '',
    notes: '',
  });
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [depForm, setDepForm] = useState({ name: '', relation: 'زوج', mobile: '', email: '' });
  const [editingDepId, setEditingDepId] = useState<number | null>(null);
  const [savingDep, setSavingDep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [togglingProvider, setTogglingProvider] = useState(false);

  const loadProfile = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [me, types] = await Promise.all([refreshUser(), api.getServiceTypes()]);
      if (!me) return;
      setServiceTypes(types);
      setForm({
        name: me.name || '',
        email: me.email || '',
        mobile: me.role === 'DEPENDENT'
          ? (me.dependent?.mobile || '')
          : (me.resident?.mobile || ''),
        landLine: me.resident?.landLine || '',
        nationality: me.resident?.nationality || '',
      });
      setResident(me.resident || null);
      setIsServiceProvider(Boolean(me.resident?.isServiceProvider));

      if (me.role === 'OWNER' || me.role === 'DEPENDENT') {
        const mine = await api.getMyServices();
        setIsServiceProvider(mine.isServiceProvider);
        if (mine.service) {
          setServiceForm({
            serviceType: mine.service.serviceType || types[0]?.name || '',
            serviceName: mine.service.serviceName || '',
            mobile: mine.service.mobile || me.resident?.mobile || '',
            notes: mine.service.notes || '',
          });
        } else {
          setServiceForm((f) => ({
            ...f,
            serviceType: types[0]?.name || '',
            mobile: me.resident?.mobile || f.mobile,
          }));
        }
      }
      if (me.role === 'OWNER') {
        setDependents(await api.getDependents());
      }
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل التحميل');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      loadProfile({ silent: true });
    }, [loadProfile])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadProfile({ silent: true });
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      await api.updateProfile({
        name: form.name,
        email: form.email,
        mobile: form.mobile || undefined,
        landLine: form.landLine || null,
        nationality: form.nationality || undefined,
      });
      await loadProfile({ silent: true });
      Alert.alert('تم', 'تم حفظ الملف الشخصي');
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDependent() {
    if (!depForm.name.trim() || !depForm.mobile.trim()) {
      Alert.alert('تنبيه', 'الاسم والموبايل مطلوبان');
      return;
    }
    if (!editingDepId && !depForm.email.trim()) {
      Alert.alert('تنبيه', 'البريد الإلكتروني مطلوب لإنشاء حساب دخول للتابع');
      return;
    }
    setSavingDep(true);
    try {
      const payload = {
        name: depForm.name.trim(),
        relation: depForm.relation.trim(),
        mobile: depForm.mobile.trim(),
        email: depForm.email.trim(),
      };
      const wasEdit = editingDepId != null;
      if (editingDepId) {
        await api.updateDependent(editingDepId, {
          ...payload,
          email: payload.email || null,
        });
      } else {
        await api.createDependent(payload);
      }
      setDependents(await api.getDependents());
      setEditingDepId(null);
      setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
      Alert.alert(
        'تم',
        wasEdit
          ? 'تم تحديث التابع'
          : 'تم إضافة التابع — كلمة المرور الافتراضية 123'
      );
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setSavingDep(false);
    }
  }

  function startEditDependent(d: Dependent) {
    setEditingDepId(d.id);
    setDepForm({
      name: d.name,
      relation: RELATION_OPTIONS.includes(d.relation) ? d.relation : 'زوج',
      mobile: d.mobile,
      email: d.email || '',
    });
  }

  async function handleDeleteDependent(id: number) {
    Alert.alert('تأكيد', 'حذف هذا التابع؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteDependent(id);
            setDependents(await api.getDependents());
            if (editingDepId === id) {
              setEditingDepId(null);
              setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
            }
          } catch (e) {
            Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الحذف');
          }
        },
      },
    ]);
  }

  async function handleSaveService() {
    if (!serviceForm.serviceName || !serviceForm.mobile) {
      Alert.alert('تنبيه', 'أدخل اسم الخدمة وموبايل التواصل');
      return;
    }
    setSavingService(true);
    try {
      const result = await api.saveMyService({
        serviceType: serviceForm.serviceType,
        serviceName: serviceForm.serviceName,
        mobile: serviceForm.mobile,
        notes: serviceForm.notes || null,
      });
      Alert.alert(
        'تم',
        isServiceProvider
          ? `${result.message} — تظهر في صفحة الخدمات`
          : `${result.message}. فعّل مقدم خدمة لإظهارها`
      );
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setSavingService(false);
    }
  }

  async function handleProviderToggle(value: boolean) {
    setTogglingProvider(true);
    try {
      if (value && (!serviceForm.serviceType || !serviceForm.serviceName || !serviceForm.mobile)) {
        Alert.alert('تنبيه', 'احفظ بيانات الخدمة أولاً قبل التفعيل');
        setTogglingProvider(false);
        return;
      }
      if (value) {
        await api.saveMyService({
          serviceType: serviceForm.serviceType,
          serviceName: serviceForm.serviceName,
          mobile: serviceForm.mobile,
          notes: serviceForm.notes || null,
        });
      }
      const result = await api.setServiceProvider(value);
      setIsServiceProvider(value);
      Alert.alert('تم', result.message);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل التحديث');
    } finally {
      setTogglingProvider(false);
    }
  }

  async function handleChangePassword() {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين');
      return;
    }
    try {
      const result = await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      Alert.alert('تم', result.message);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل التحديث');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  const unitType = resident?.unitType;
  const showFloor = unitType ? unitType.hasFloor : resident?.floorNo != null && resident.floorNo !== 0;
  const showApartment = unitType ? unitType.hasApartment : resident?.apartmentNo != null && resident.apartmentNo !== '' && resident.apartmentNo !== '0';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.title}>الملف الشخصي</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>بيانات التسجيل (للعرض فقط)</Text>
            {resident && (
              <>
                <Text style={styles.label}>نوع السكن</Text>
                <TextInput
                  style={[styles.input, styles.readonly]}
                  value={resident.residentType === 'T' ? 'مستأجر' : resident.residentType === 'O' ? 'مالك' : '—'}
                  editable={false}
                  textAlign="right"
                />
                <Text style={styles.label}>نوع الوحدة</Text>
                <TextInput style={[styles.input, styles.readonly]} value={displayValue(unitType?.name)} editable={false} textAlign="right" />
                <Text style={styles.label}>الرسوم الشهرية</Text>
                <TextInput
                  style={[styles.input, styles.readonly]}
                  value={
                    (unitType?.monthlyFees ?? resident.monthlyFees) != null
                      ? `${Number(unitType?.monthlyFees ?? resident.monthlyFees).toLocaleString()} ج.م`
                      : '—'
                  }
                  editable={false}
                  textAlign="right"
                />
                <Text style={styles.label}>المجاورة</Text>
                <TextInput style={[styles.input, styles.readonly]} value={displayValue(resident.area)} editable={false} textAlign="right" />
                <Text style={styles.label}>القطعة</Text>
                <TextInput style={[styles.input, styles.readonly]} value={displayValue(resident.buildingNo)} editable={false} textAlign="right" />
                {showFloor && (
                  <>
                    <Text style={styles.label}>الدور</Text>
                    <TextInput style={[styles.input, styles.readonly]} value={displayValue(resident.floorNo)} editable={false} textAlign="right" />
                  </>
                )}
                {showApartment && (
                  <>
                    <Text style={styles.label}>رقم الوحدة</Text>
                    <TextInput style={[styles.input, styles.readonly]} value={displayValue(resident.apartmentNo)} editable={false} textAlign="right" />
                  </>
                )}
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>البيانات</Text>
            <Text style={styles.label}>الاسم</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} textAlign="right" />
            <Text style={styles.label}>البريد</Text>
            <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" textAlign="right" />
            {(isOwner || user?.role === 'DEPENDENT') && (
              <>
                <Text style={styles.label}>الموبايل</Text>
                <TextInput style={styles.input} value={form.mobile} onChangeText={(v) => setForm({ ...form, mobile: v })} textAlign="right" />
              </>
            )}
            {isOwner && (
              <>
                <Text style={styles.label}>الهاتف الأرضي</Text>
                <TextInput style={styles.input} value={form.landLine} onChangeText={(v) => setForm({ ...form, landLine: v })} placeholder="—" textAlign="right" />
                <Text style={styles.label}>الجنسية</Text>
                <TextInput style={styles.input} value={form.nationality} onChangeText={(v) => setForm({ ...form, nationality: v })} textAlign="right" />
              </>
            )}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>حفظ التعديلات</Text>}
            </TouchableOpacity>
          </View>

          {isResident && (
            <View style={styles.section}>
              <View style={styles.providerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>بيانات الخدمة</Text>
                  <Text style={styles.hint}>احفظ التفاصيل ثم فعّل الإظهار في صفحة الخدمات</Text>
                </View>
                <Switch
                  value={isServiceProvider}
                  onValueChange={handleProviderToggle}
                  disabled={togglingProvider}
                />
              </View>
              <Text style={styles.status}>{isServiceProvider ? 'نشط في صفحة الخدمات' : 'غير ظاهر في صفحة الخدمات'}</Text>

              <Text style={styles.label}>نوع الخدمة</Text>
              <View style={styles.typeRow}>
                {serviceTypes.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeChip, serviceForm.serviceType === t.name && styles.typeChipActive]}
                    onPress={() => setServiceForm({ ...serviceForm, serviceType: t.name })}
                  >
                    <Text style={[styles.typeChipText, serviceForm.serviceType === t.name && styles.typeChipTextActive]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>اسم الخدمة</Text>
              <TextInput style={styles.input} value={serviceForm.serviceName} onChangeText={(v) => setServiceForm({ ...serviceForm, serviceName: v })} textAlign="right" />
              <Text style={styles.label}>موبايل التواصل</Text>
              <TextInput style={styles.input} value={serviceForm.mobile} onChangeText={(v) => setServiceForm({ ...serviceForm, mobile: v })} keyboardType="phone-pad" textAlign="right" />
              <Text style={styles.label}>ملاحظات</Text>
              <TextInput style={[styles.input, { minHeight: 70 }]} value={serviceForm.notes} onChangeText={(v) => setServiceForm({ ...serviceForm, notes: v })} textAlign="right" multiline />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveService} disabled={savingService}>
                {savingService ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>حفظ بيانات الخدمة</Text>}
              </TouchableOpacity>
            </View>
          )}

          {isOwner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>التابعون</Text>
              <Text style={styles.hint}>البريد مطلوب — كلمة المرور الافتراضية 123 عند الإضافة</Text>
              <Text style={styles.hint}>للتسجيل فقط — بدون إمكانية دخول النظام</Text>

              <Text style={styles.label}>الاسم</Text>
              <TextInput style={styles.input} value={depForm.name} onChangeText={(v) => setDepForm({ ...depForm, name: v })} textAlign="right" />
              <Text style={styles.label}>صلة القرابة</Text>
              <View style={styles.typeRow}>
                {RELATION_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.typeChip, depForm.relation === r && styles.typeChipActive]}
                    onPress={() => setDepForm({ ...depForm, relation: r })}
                  >
                    <Text style={[styles.typeChipText, depForm.relation === r && styles.typeChipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>الموبايل</Text>
              <TextInput style={styles.input} value={depForm.mobile} onChangeText={(v) => setDepForm({ ...depForm, mobile: v })} keyboardType="phone-pad" textAlign="right" />
              <Text style={styles.label}>البريد</Text>
              <TextInput style={styles.input} value={depForm.email} onChangeText={(v) => setDepForm({ ...depForm, email: v })} autoCapitalize="none" keyboardType="email-address" textAlign="right" />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDependent} disabled={savingDep}>
                {savingDep ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.saveBtnText}>{editingDepId ? 'حفظ التعديل' : 'إضافة تابع'}</Text>
                )}
              </TouchableOpacity>
              {editingDepId && (
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#64748b', marginTop: 8 }]}
                  onPress={() => {
                    setEditingDepId(null);
                    setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
                  }}
                >
                  <Text style={styles.saveBtnText}>إلغاء التعديل</Text>
                </TouchableOpacity>
              )}

              {dependents.map((d) => (
                <View key={d.id} style={styles.depCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.depName}>{d.name}</Text>
                    <Text style={styles.depMeta}>{d.relation} · {d.mobile}</Text>
                    {!!d.email && <Text style={styles.depMeta}>{d.email}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => startEditDependent(d)}>
                    <Text style={styles.depAction}>تعديل</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteDependent(d.id)}>
                    <Text style={[styles.depAction, { color: '#dc2626' }]}>حذف</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {dependents.length === 0 && (
                <Text style={[styles.hint, { marginTop: 8 }]}>لا يوجد تابعون بعد.</Text>
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>تغيير كلمة المرور</Text>
            <Text style={styles.label}>الحالية</Text>
            <PasswordInput
              value={passwordForm.currentPassword}
              onChangeText={(v) => setPasswordForm({ ...passwordForm, currentPassword: v })}
              containerStyle={styles.passwordWrap}
            />
            <Text style={styles.label}>الجديدة</Text>
            <PasswordInput
              value={passwordForm.newPassword}
              onChangeText={(v) => setPasswordForm({ ...passwordForm, newPassword: v })}
              containerStyle={styles.passwordWrap}
            />
            <Text style={styles.label}>تأكيد كلمة المرور</Text>
            <PasswordInput
              value={passwordForm.confirmPassword}
              onChangeText={(v) => setPasswordForm({ ...passwordForm, confirmPassword: v })}
              containerStyle={styles.passwordWrap}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword}>
              <Text style={styles.saveBtnText}>تحديث كلمة المرور</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'right' },
  section: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'right' },
  label: { fontWeight: '600', marginBottom: 6, marginTop: 8, textAlign: 'right', fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 4, backgroundColor: '#fff' },
  readonly: { backgroundColor: '#f1f5f9', color: '#94a3b8' },
  passwordWrap: { marginBottom: 4 },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hint: { color: '#64748b', fontSize: 13, textAlign: 'right', marginTop: -6 },
  status: { marginTop: 10, marginBottom: 4, textAlign: 'right', fontWeight: '600', color: '#2563eb' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginBottom: 8 },
  typeChip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  typeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  typeChipText: { color: '#334155', fontSize: 13 },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },
  depCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
    marginTop: 12,
  },
  depName: { fontWeight: '700', textAlign: 'right', fontSize: 15 },
  depMeta: { color: '#64748b', textAlign: 'right', fontSize: 13, marginTop: 2 },
  depAction: { color: '#2563eb', fontWeight: '600', paddingHorizontal: 4 },
});
