import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch, RefreshControl, Modal, Dimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Resident, ServiceType, Dependent } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import PasswordInput from '@/components/PasswordInput';
import { BottomTabInset } from '@/constants/theme';
import { Screen } from '@/components/screen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RELATION_OPTIONS = ['زوج', 'زوجة', 'ابن', 'ابنة', 'والد', 'والدة'];

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const tabPad = BottomTabInset + Math.max(insets.bottom, 0);

  const isOwner = user?.role === 'OWNER';
  const isDependent = user?.role === 'DEPENDENT';
  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' || user?.role === 'ACCOUNTANT';

  const [form, setForm] = useState({ username: '', name: '', email: '', mobile: '', landLine: '', nationality: '' });
  const [resident, setResident] = useState<Partial<Resident> | null>(null);
  
  // Service Provider State
  const [serviceForm, setServiceForm] = useState({
    serviceType: '',
    serviceName: '',
    mobile: '',
    notes: '',
  });
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  
  // Password Change State
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  
  // Dependents List State
  const [dependents, setDependents] = useState<Dependent[]>([]);
  
  // Dependent Modal form State
  const [showDepModal, setShowDepModal] = useState(false);
  const [editingDepId, setEditingDepId] = useState<number | null>(null);
  const [depForm, setDepForm] = useState({ name: '', relation: 'زوج', mobile: '', email: '' });
  const [depPreviewUsername, setDepPreviewUsername] = useState('');
  const [showRelationPicker, setShowRelationPicker] = useState(false);
  const [showServiceTypePicker, setShowServiceTypePicker] = useState(false);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [savingDep, setSavingDep] = useState(false);
  const [togglingProvider, setTogglingProvider] = useState(false);

  // Delete Dependent State
  const [deleteTarget, setDeleteTarget] = useState<Dependent | null>(null);
  const [deletingDep, setDeletingDep] = useState(false);

  // Reset Dependent Password State
  const [resetTarget, setResetTarget] = useState<Dependent | null>(null);
  const [resettingPass, setResettingPass] = useState(false);

  const loadProfile = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [me, types] = await Promise.all([refreshUser(), api.getServiceTypes()]);
      if (!me) return;
      setServiceTypes(types);
      setForm({
        username: me.username || '',
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

      if (me.role === 'OWNER') {
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
        const [deps, suggested] = await Promise.all([
          api.getDependents(),
          api.getSuggestedUsername(),
        ]);
        setDependents(deps);
        setDepPreviewUsername(suggested.username);
      }
    } catch (e) {
      console.error(e);
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
    setSavingProfile(true);
    try {
      await api.updateProfile({
        username: form.username,
        name: form.name,
        email: form.email,
        mobile: form.mobile || undefined,
        landLine: form.landLine || null,
        nationality: form.nationality || undefined,
      });
      await loadProfile({ silent: true });
      Alert.alert('تم بنجاح', 'تم حفظ الملف الشخصي بنجاح.');
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل حفظ التعديلات');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      Alert.alert('تنبيه', 'برجاء تعبئة كافة حقول كلمة المرور');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('خطأ', 'كلمتا المرور الجديدتان غير متطابقتين');
      return;
    }
    setSavingPassword(true);
    try {
      const result = await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      Alert.alert('تم بنجاح', result.message);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل تغيير كلمة المرور');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSaveService() {
    if (!serviceForm.serviceName.trim() || !serviceForm.mobile.trim()) {
      Alert.alert('تنبيه', 'أدخل اسم الخدمة وموبايل التواصل');
      return;
    }
    setSavingService(true);
    try {
      const result = await api.saveMyService({
        serviceType: serviceForm.serviceType,
        serviceName: serviceForm.serviceName.trim(),
        mobile: serviceForm.mobile.trim(),
        notes: serviceForm.notes.trim() || null,
      });
      Alert.alert(
        'تم بنجاح',
        isServiceProvider
          ? `${result.message} — تظهر الخدمة الآن في صفحة الخدمات للجميع.`
          : `${result.message} — برجاء تفعيل خيار مقدم الخدمة بالرأس لتفعيل ظهورها.`
      );
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل حفظ بيانات الخدمة');
    } finally {
      setSavingService(false);
    }
  }

  async function handleProviderToggle(value: boolean) {
    setTogglingProvider(true);
    try {
      if (value && (!serviceForm.serviceType || !serviceForm.serviceName.trim() || !serviceForm.mobile.trim())) {
        Alert.alert('تنبيه', 'برجاء حفظ تفاصيل الخدمة أولاً قبل تفعيل ظهورك كمقدم خدمة.');
        setTogglingProvider(false);
        return;
      }
      if (value) {
        await api.saveMyService({
          serviceType: serviceForm.serviceType,
          serviceName: serviceForm.serviceName.trim(),
          mobile: serviceForm.mobile.trim(),
          notes: serviceForm.notes.trim() || null,
        });
      }
      const result = await api.setServiceProvider(value);
      setIsServiceProvider(value);
      Alert.alert('تم بنجاح', result.message);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل تغيير الحالة');
    } finally {
      setTogglingProvider(false);
    }
  }

  function openCreateDep() {
    setEditingDepId(null);
    setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
    setShowDepModal(true);
  }

  function openEditDep(d: Dependent) {
    setEditingDepId(d.id);
    setDepForm({
      name: d.name,
      relation: RELATION_OPTIONS.includes(d.relation) ? d.relation : 'زوج',
      mobile: d.mobile,
      email: d.email || '',
    });
    setShowDepModal(true);
  }

  async function handleSaveDependent() {
    if (!depForm.name.trim() || !depForm.mobile.trim()) {
      Alert.alert('تنبيه', 'الاسم والموبايل مطلوبان');
      return;
    }
    if (!editingDepId && !depForm.email.trim()) {
      Alert.alert('تنبيه', 'البريد الإلكتروني مطلوب لإنشاء حساب دخول التابع');
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
      if (editingDepId) {
        await api.updateDependent(editingDepId, {
          ...payload,
          email: payload.email || null,
        });
        Alert.alert('تم بنجاح', 'تم تحديث التابع بنجاح.');
      } else {
        const assignedUsername = depPreviewUsername;
        await api.createDependent(payload);
        const suggested = await api.getSuggestedUsername();
        setDepPreviewUsername(suggested.username);
        Alert.alert(
          'تم بنجاح',
          `تم إضافة التابع بنجاح — اسم المستخدم: ${assignedUsername} — كلمة المرور الافتراضية: 123`
        );
      }
      setDependents(await api.getDependents());
      setShowDepModal(false);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل حفظ التابع');
    } finally {
      setSavingDep(false);
    }
  }

  async function triggerDeleteDep() {
    if (!deleteTarget) return;
    setDeletingDep(true);
    try {
      await api.deleteDependent(deleteTarget.id);
      setDependents(await api.getDependents());
      setDeleteTarget(null);
      Alert.alert('تم بنجاح', 'تم حذف التابع بنجاح.');
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل حذف التابع');
    } finally {
      setDeletingDep(false);
    }
  }

  async function triggerResetDepPassword() {
    if (!resetTarget) return;
    setResettingPass(true);
    try {
      const r = await api.resetDependentPassword(resetTarget.id);
      setResetTarget(null);
      Alert.alert('تم بنجاح', r.message);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل إعادة التعيين');
    } finally {
      setResettingPass(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#024C59" />
      </View>
    );
  }

  const unitType = resident?.unitType;
  const showFloor = unitType ? unitType.hasFloor : resident?.floorNo != null && resident.floorNo !== 0;
  const showApartment = unitType ? unitType.hasApartment : resident?.apartmentNo != null && resident.apartmentNo !== '' && resident.apartmentNo !== '0';

  return (
    <Screen
      title="الملف الشخصي"
      headerShown={false} // Custom header
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {/* 1. CUSTOM TOP HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={24} color="#024C59" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.profileTextContainer}>
            <Text style={styles.greetText}>مرحباً،</Text>
            <Text style={styles.userName}>{user?.name || 'مستخدم'}</Text>
          </View>
          <Ionicons name="person-circle" size={44} color="#024C59" />
        </View>
      </View>

      {/* 2. SUBHEADER Title */}
      <View style={styles.subHeader}>
        <Text style={styles.pageTitle}>الملف الشخصي</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: tabPad }} showsVerticalScrollIndicator={false}>
        
        {/* CARD 1: REGISTRATION DATA (Read-only) - Residents (Owners/Dependents) only */}
        {!isStaff && resident && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>بيانات التسجيل (للعرض فقط)</Text>
            
            <View style={styles.readOnlyGrid}>
              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={styles.readLabel}>نوع السكن</Text>
                  <Text style={styles.readVal}>{resident.residentType === 'T' ? 'مستأجر' : resident.residentType === 'O' ? 'مالك' : '—'}</Text>
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.readLabel}>نوع الوحدة</Text>
                  <Text style={styles.readVal}>{displayValue(unitType?.name)}</Text>
                </View>
              </View>

              <View style={[styles.gridRow, { marginTop: 12 }]}>
                <View style={styles.gridCol}>
                  <Text style={styles.readLabel}>الرسوم الشهرية</Text>
                  <Text style={styles.readVal}>
                    {(unitType?.monthlyFees ?? resident.monthlyFees) != null
                      ? `${Number(unitType?.monthlyFees ?? resident.monthlyFees).toLocaleString()} ج.م`
                      : '—'}
                  </Text>
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.readLabel}>المجاورة</Text>
                  <Text style={styles.readVal}>{displayValue(resident.area)}</Text>
                </View>
              </View>

              <View style={[styles.gridRow, { marginTop: 12 }]}>
                <View style={styles.gridCol}>
                  <Text style={styles.readLabel}>القطعة</Text>
                  <Text style={styles.readVal}>{displayValue(resident.buildingNo)}</Text>
                </View>
                {showFloor && (
                  <View style={styles.gridCol}>
                    <Text style={styles.readLabel}>الدور</Text>
                    <Text style={styles.readVal}>{displayValue(resident.floorNo)}</Text>
                  </View>
                )}
              </View>

              {showApartment && (
                <View style={[styles.gridRow, { marginTop: 12 }]}>
                  <View style={styles.gridCol}>
                    <Text style={styles.readLabel}>رقم الوحدة</Text>
                    <Text style={styles.readVal}>{displayValue(resident.apartmentNo)}</Text>
                  </View>
                  <View style={styles.gridCol} />
                </View>
              )}
            </View>
          </View>
        )}

        {/* CARD 2: PERSONAL INFORMATION */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>البيانات</Text>
          
          <View style={styles.formRowInput}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>الاسم</Text>
              <TextInput style={styles.fieldInput} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} textAlign="right" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>اسم المستخدم</Text>
              <TextInput style={styles.fieldInput} value={form.username} onChangeText={(v) => setForm({ ...form, username: v })} autoCapitalize="none" textAlign="right" />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>البريد الإلكتروني</Text>
          <TextInput style={styles.fieldInput} value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" textAlign="right" />

          {(isOwner || isDependent) && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>الموبايل</Text>
              <TextInput style={styles.fieldInput} value={form.mobile} onChangeText={(v) => setForm({ ...form, mobile: v })} textAlign="right" />
            </>
          )}

          {isOwner && (
            <View style={[styles.formRowInput, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>الهاتف الأرضي</Text>
                <TextInput style={styles.fieldInput} value={form.landLine} onChangeText={(v) => setForm({ ...form, landLine: v })} placeholder="—" textAlign="right" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>الجنسية</Text>
                <TextInput style={styles.fieldInput} value={form.nationality} onChangeText={(v) => setForm({ ...form, nationality: v })} textAlign="right" />
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContentRow}>
                <Ionicons name="save-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                <Text style={styles.saveBtnText}>حفظ التعديلات</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* CARD 3: SERVICE PROVIDER DATA (Owner-only) */}
        {isOwner && (
          <View style={styles.card}>
            <View style={styles.providerHeader}>
              <Switch
                value={isServiceProvider}
                onValueChange={handleProviderToggle}
                disabled={togglingProvider}
                trackColor={{ false: '#CBD5E1', true: '#E6F4F6' }}
                thumbColor={isServiceProvider ? '#024C59' : '#94A3B8'}
              />
              <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={styles.cardTitle}>بيانات الخدمة</Text>
                <Text style={styles.hintSub}>أدخل تفاصيل خدمتك لتظهر في صفحة الخدمات</Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>نوع الخدمة</Text>
            <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowServiceTypePicker(true)}>
              <Text style={styles.selectTriggerText}>{serviceForm.serviceType || 'اختر نوع الخدمة...'}</Text>
              <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>اسم الخدمة</Text>
            <TextInput style={styles.fieldInput} value={serviceForm.serviceName} onChangeText={(v) => setServiceForm({ ...serviceForm, serviceName: v })} textAlign="right" />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>موبايل التواصل</Text>
            <TextInput style={styles.fieldInput} value={serviceForm.mobile} onChangeText={(v) => setServiceForm({ ...serviceForm, mobile: v })} keyboardType="phone-pad" textAlign="right" />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>ملاحظات</Text>
            <TextInput style={[styles.fieldInput, { minHeight: 70, textAlignVertical: 'top', paddingVertical: 10 }]} value={serviceForm.notes} onChangeText={(v) => setServiceForm({ ...serviceForm, notes: v })} textAlign="right" multiline />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveService} disabled={savingService}>
              {savingService ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.btnContentRow}>
                  <Ionicons name="save-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  <Text style={styles.saveBtnText}>حفظ بيانات الخدمة</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* CARD 4: DEPENDENTS LIST & ACTION (Owner-only) */}
        {isOwner && (
          <View style={styles.card}>
            <View style={styles.depHeader}>
              <TouchableOpacity style={styles.addDepBtn} onPress={openCreateDep}>
                <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                <Text style={styles.addDepBtnText}>إضافة تابع</Text>
              </TouchableOpacity>
              <Text style={styles.cardTitle}>التابعون</Text>
            </View>
            <Text style={styles.hintSub}>أفراد عائلتك المرتبطون بوحدتك - يمكنهم تسجيل الدخول باستخدام الحسابات أدناه</Text>

            {/* Table layout for dependents */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 16 }}>
              <View style={styles.tableContainer}>
                {/* Table Headers */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.thCol, { width: 130, textAlign: 'right' }]}>الاسم</Text>
                  <Text style={[styles.thCol, { width: 80, textAlign: 'center' }]}>صلة القرابة</Text>
                  <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>الموبايل</Text>
                  <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>اسم المستخدم</Text>
                  <Text style={[styles.thCol, { width: 140, textAlign: 'right' }]}>البريد</Text>
                  <Text style={[styles.thCol, { width: 110, textAlign: 'center' }]}>إجراءات</Text>
                </View>

                {/* Table Rows */}
                {dependents.length === 0 ? (
                  <View style={styles.emptyView}>
                    <Text style={styles.emptyText}>لا يوجد تابعون مسجلون بعد</Text>
                  </View>
                ) : (
                  dependents.map((item, idx) => (
                    <View key={item.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                      <Text style={[styles.tdCol, { width: 130, textAlign: 'right', fontWeight: '700' }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.tdCol, { width: 80, textAlign: 'center' }]}>
                        {item.relation}
                      </Text>
                      <Text style={[styles.tdCol, { width: 100, textAlign: 'center' }]}>
                        {item.mobile}
                      </Text>
                      <Text style={[styles.tdCol, { width: 90, textAlign: 'center', color: '#64748B' }]} numberOfLines={1}>
                        {item.user?.username || '—'}
                      </Text>
                      <Text style={[styles.tdCol, { width: 140, textAlign: 'right' }]} numberOfLines={1}>
                        {item.email || '—'}
                      </Text>
                      
                      {/* Action buttons */}
                      <View style={[{ width: 110, flexDirection: 'row-reverse', justifyContent: 'center', gap: 12 }]}>
                        <TouchableOpacity onPress={() => setResetTarget(item)}>
                          <Ionicons name="key-outline" size={16} color="#024C59" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setDeleteTarget(item)}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openEditDep(item)}>
                          <Ionicons name="pencil-outline" size={16} color="#024C59" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* CARD 5: CHANGE PASSWORD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>تغيير كلمة المرور</Text>
          
          <Text style={styles.fieldLabel}>كلمة المرور الحالية</Text>
          <PasswordInput
            value={passwordForm.currentPassword}
            onChangeText={(v) => setPasswordForm({ ...passwordForm, currentPassword: v })}
            containerStyle={styles.passwordWrap}
          />
          
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>كلمة المرور الجديدة</Text>
          <PasswordInput
            value={passwordForm.newPassword}
            onChangeText={(v) => setPasswordForm({ ...passwordForm, newPassword: v })}
            containerStyle={styles.passwordWrap}
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>تأكيد كلمة المرور</Text>
          <PasswordInput
            value={passwordForm.confirmPassword}
            onChangeText={(v) => setPasswordForm({ ...passwordForm, confirmPassword: v })}
            containerStyle={styles.passwordWrap}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContentRow}>
                <Ionicons name="lock-closed-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                <Text style={styles.saveBtnText}>تحديث كلمة المرور</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ===================== EDIT/ADD DEPENDENT MODAL SHEET ===================== */}
      <Modal
        visible={showDepModal}
        animationType="slide"
        onRequestClose={() => setShowDepModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setShowDepModal(false)}>
              <Ionicons name="chevron-forward-outline" size={24} color="#024C59" />
            </TouchableOpacity>
            <Text style={styles.formHeaderTitle}>
              {editingDepId ? 'تعديل التابع' : 'إضافة تابع'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            
            <View style={styles.formRowInput}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>الاسم</Text>
                <TextInput style={styles.fieldInput} value={depForm.name} onChangeText={(v) => setDepForm({ ...depForm, name: v })} textAlign="right" />
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>صلة القرابة</Text>
                <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowRelationPicker(true)}>
                  <Text style={styles.selectTriggerText}>{depForm.relation}</Text>
                  <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.formRowInput, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>الموبايل</Text>
                <TextInput style={styles.fieldInput} value={depForm.mobile} onChangeText={(v) => setDepForm({ ...depForm, mobile: v })} keyboardType="phone-pad" textAlign="right" />
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>البريد الإلكتروني</Text>
                <TextInput style={styles.fieldInput} value={depForm.email} onChangeText={(v) => setDepForm({ ...depForm, email: v })} autoCapitalize="none" keyboardType="email-address" textAlign="right" />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>اسم المستخدم</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputDisabled]}
              value={editingDepId
                ? (dependents.find((d) => d.id === editingDepId)?.user?.username || '—')
                : depPreviewUsername}
              editable={false}
              textAlign="right"
            />
            
            {!editingDepId && (
              <Text style={styles.disclaimerText}>
                يُعيَّن تلقائياً — يُطلب من التابع تغييره عند أول تسجيل دخول. كلمة المرور الافتراضية: 123
              </Text>
            )}

            <View style={styles.formActionsRow}>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveDependent} disabled={savingDep}>
                {savingDep ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingDepId ? 'حفظ التعديل' : 'إضافة تابع جديد'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDepModal(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* RELATION SELECTION DIALOG */}
      <Modal
        visible={showRelationPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRelationPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر صلة القرابة</Text>
            {RELATION_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.pickerItem, depForm.relation === r && styles.pickerItemActive]}
                onPress={() => {
                  setDepForm({ ...depForm, relation: r });
                  setShowRelationPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, depForm.relation === r && styles.pickerItemTextActive]}>
                  {r}
                </Text>
                {depForm.relation === r && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowRelationPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SERVICE TYPE SELECTION DIALOG */}
      <Modal
        visible={showServiceTypePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowServiceTypePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر نوع الخدمة</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {serviceTypes.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.pickerItem, serviceForm.serviceType === t.name && styles.pickerItemActive]}
                  onPress={() => {
                    setServiceForm({ ...serviceForm, serviceType: t.name });
                    setShowServiceTypePicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, serviceForm.serviceType === t.name && styles.pickerItemTextActive]}>
                    {t.name}
                  </Text>
                  {serviceForm.serviceType === t.name && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowServiceTypePicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DELETE DEPENDENT CONFIRM MODAL */}
      <Modal
        visible={!!deleteTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="trash-outline" size={32} color="#EF4444" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>حذف التابع</Text>
            <Text style={styles.confirmSubtext}>هل أنت متأكد من حذف هذا التابع من وحدتك؟</Text>
            <Text style={styles.confirmTargetVal}>
              "{deleteTarget?.name || 'التابع'}"
            </Text>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnYes, { backgroundColor: '#EF4444' }]}
                onPress={triggerDeleteDep}
                disabled={deletingDep}
              >
                {deletingDep ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>حذف</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnNo]}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={styles.confirmBtnTextNo}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RESET PASSWORD DEPENDENT CONFIRM MODAL */}
      <Modal
        visible={!!resetTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setResetTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="key-outline" size={32} color="#024C59" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>إعادة تعيين كلمة المرور</Text>
            <Text style={styles.confirmSubtext}>هل أنت متأكد من إعادة كلمة مرور هذا التابع إلى القيمة الافتراضية "123"؟</Text>
            <Text style={styles.confirmTargetVal}>
              "{resetTarget?.name || 'التابع'}"
            </Text>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnYes]}
                onPress={triggerResetDepPassword}
                disabled={resettingPass}
              >
                {resettingPass ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>إعادة تعيين</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnNo]}
                onPress={() => setResetTarget(null)}
              >
                <Text style={styles.confirmBtnTextNo}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF3F8',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  profileSection: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  profileTextContainer: {
    marginRight: 10,
    alignItems: 'flex-end',
  },
  greetText: {
    fontSize: 12,
    color: '#64748B',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F7FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'right',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#024C59',
    textAlign: 'right',
    marginBottom: 12,
  },
  readOnlyGrid: {
    backgroundColor: '#FAFBFD',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  gridRow: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  gridCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  readLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  readVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  formRowInput: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 6,
  },
  fieldInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFD',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#1E293B',
    textAlign: 'right',
  },
  fieldInputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
  },
  saveBtn: {
    height: 44,
    backgroundColor: '#024C59',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  btnContentRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  passwordWrap: {
    marginBottom: 2,
  },
  providerHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  hintSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    textAlign: 'right',
    marginTop: 4,
  },
  selectTrigger: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFD',
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectTriggerText: {
    fontSize: 13,
    color: '#1E293B',
  },
  depHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
  },
  addDepBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#024C59',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  addDepBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tableContainer: {
    flexDirection: 'column',
  },
  tableHeader: {
    flexDirection: 'row-reverse',
    backgroundColor: '#EBF5FF',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  thCol: {
    fontSize: 12,
    fontWeight: '700',
    color: '#024C59',
  },
  tableRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tableRowAlt: {
    backgroundColor: '#FAFBFD',
  },
  tdCol: {
    fontSize: 12,
    color: '#334155',
  },
  emptyView: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
  },

  // MODAL SHEET FORM STYLES
  formHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  formHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  formScroll: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    textAlign: 'right',
    marginTop: 8,
  },
  formActionsRow: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 24,
  },
  submitBtn: {
    height: 46,
    backgroundColor: '#024C59',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelBtn: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },

  // DIALOG PICKERS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  pickerItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#FAFBFD',
  },
  pickerItemActive: {
    backgroundColor: '#E6F4F6',
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'right',
  },
  pickerItemTextActive: {
    color: '#024C59',
    fontWeight: '700',
  },
  closePickerBtn: {
    marginTop: 16,
    height: 40,
    backgroundColor: '#FAFBFD',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePickerBtnText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
  },
  confirmCard: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  confirmSubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmTargetVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#024C59',
    marginTop: 10,
    marginBottom: 24,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnYes: {
    backgroundColor: '#024C59',
  },
  confirmBtnNo: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  confirmBtnTextNo: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
  },
});
