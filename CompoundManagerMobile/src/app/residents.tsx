import { useCallback, useState } from 'react';
import {
  Alert, Text, TextInput, TouchableOpacity, View, StyleSheet,
  ScrollView, ActivityIndicator, Modal, Pressable, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Dependent, Resident, UnitType } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const RELATION_OPTIONS = ['زوج', 'زوجة', 'ابن', 'ابنة', 'والد', 'والدة'];

const empty = {
  area: '',
  buildingNo: '',
  floorNo: '1',
  apartmentNo: '1',
  residentName: '',
  mobile: '',
  email: '',
  landLine: '',
  nationality: 'مصري',
  monthlyFees: '',
  residentType: 'O',
  unitTypeId: '',
  notes: '',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ResidentsScreen() {
  const { user: authUser } = useAuth();
  const [rows, setRows] = useState<Resident[]>([]);
  const [types, setTypes] = useState<UnitType[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [username, setUsername] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [depForm, setDepForm] = useState({ name: '', relation: 'زوج', mobile: '', email: '' });
  const [depPreviewUsername, setDepPreviewUsername] = useState('');
  const [savingDep, setSavingDep] = useState(false);
  
  // Custom Modals visibility
  const [resetTarget, setResetTarget] = useState<Resident | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showUnitTypePicker, setShowUnitTypePicker] = useState(false);
  const [showRelationPicker, setShowRelationPicker] = useState(false);

  async function load() {
    try {
      const [list, unitTypes] = await Promise.all([
        api.getResidents(search ? { search } : undefined),
        api.getUnitTypes(true),
      ]);
      setRows(list);
      setTypes(unitTypes);
    } catch (e) {
      console.error(e);
    }
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, [search]));

  function openCreate() {
    const first = types.find((t) => t.activeFlag === 'Y') || types[0];
    setEditingId(null);
    setForm({
      ...empty,
      unitTypeId: first ? String(first.id) : '',
      monthlyFees: first ? String(first.monthlyFees) : '',
    });
    api.getNextUsername().then((r) => setUsername(r.username)).catch(() => setUsername(''));
    setDependents([]);
    setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
    setShowForm(true);
  }

  function openEdit(r: Resident) {
    setEditingId(r.id);
    setForm({
      area: r.area,
      buildingNo: r.buildingNo,
      floorNo: String(r.floorNo),
      apartmentNo: r.apartmentNo,
      residentName: r.residentName,
      mobile: r.mobile,
      email: r.email || '',
      landLine: r.landLine || '',
      nationality: r.nationality || 'مصري',
      monthlyFees: String(r.monthlyFees),
      residentType: r.residentType || 'O',
      unitTypeId: r.unitTypeId ? String(r.unitTypeId) : '',
      notes: r.notes || '',
    });
    setUsername(r.user?.username || '');
    setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
    api.getSuggestedUsername().then((s) => setDepPreviewUsername(s.username)).catch(() => setDepPreviewUsername(''));
    api.getDependents(r.id).then(setDependents).catch(() => setDependents([]));
    setShowForm(true);
  }

  async function save() {
    try {
      const type = types.find((t) => t.id === Number(form.unitTypeId));
      const payload = {
        area: form.area,
        buildingNo: form.buildingNo,
        floorNo: type?.hasFloor ? Number(form.floorNo) : 0,
        apartmentNo: type?.hasApartment ? form.apartmentNo.trim() : '0',
        residentName: form.residentName,
        mobile: form.mobile,
        email: form.email || undefined,
        landLine: form.landLine || undefined,
        nationality: form.nationality,
        monthlyFees: Number(form.monthlyFees),
        unitTypeId: Number(form.unitTypeId),
        residentType: form.residentType === 'T' ? 'T' : 'O',
        notes: form.notes.trim() || null,
      };
      if (editingId) await api.updateResident(editingId, payload);
      else await api.createResident(payload);
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
    }
  }

  async function triggerPasswordReset() {
    if (!resetTarget) return;
    setResettingPassword(true);
    try {
      const r = await api.resetResidentPassword(resetTarget.id);
      Alert.alert('تم إعادة تعيين كلمة المرور', r.message);
      setResetTarget(null);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل إعادة التعيين');
    } finally {
      setResettingPassword(false);
    }
  }

  const selectedUnitType = types.find((t) => String(t.id) === form.unitTypeId);

  return (
    <Screen
      title="الوحدات"
      back
      headerShown={false} // Custom header
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(console.error);
        setRefreshing(false);
      }}
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
            <Text style={styles.userName}>{authUser?.name || 'مستخدم'}</Text>
          </View>
          <Ionicons name="person-circle" size={44} color="#024C59" />
        </View>
      </View>

      {/* 2. SUBHEADER ACTIONS */}
      <View style={styles.subHeader}>
        <Text style={styles.pageTitle}>الوحدات</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
          <Text style={styles.addBtnText}>إضافة وحدة</Text>
        </TouchableOpacity>
      </View>

      {/* 3. SEARCH BAR */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث بالاسم أو بالموبايل..."
          placeholderTextColor="#94A3B8"
        />
        <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
      </View>

      {/* 4. HORIZONTAL SCROLLABLE DATA TABLE */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
        <View style={styles.tableContainer}>
          {/* Table Headers */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCol, { width: 110, textAlign: 'right' }]}>الاسم</Text>
            <Text style={[styles.thCol, { width: 65, textAlign: 'center' }]}>النوع</Text>
            <Text style={[styles.thCol, { width: 75, textAlign: 'center' }]}>نوع الوحدة</Text>
            <Text style={[styles.thCol, { width: 140, textAlign: 'right' }]}>الوحدة</Text>
            <Text style={[styles.thCol, { width: 95, textAlign: 'center' }]}>الموبايل</Text>
            <Text style={[styles.thCol, { width: 85, textAlign: 'left' }]}>الرسوم الشهرية</Text>
            <Text style={[styles.thCol, { width: 85, textAlign: 'left' }]}>الرصيد</Text>
            <Text style={[styles.thCol, { width: 70, textAlign: 'center' }]}>إجراءات</Text>
          </View>

          {/* Table Rows */}
          {rows.length === 0 ? (
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>لا توجد أي وحدات مسجلة</Text>
            </View>
          ) : (
            rows.map((r, idx) => {
              const unitDetails = `${r.area}-${r.buildingNo}${r.floorNo ? ` / دور ${r.floorNo}` : ''}${r.apartmentNo ? ` / شقة ${r.apartmentNo}` : ''}`;
              return (
                <View key={r.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                  {/* Name */}
                  <Text style={[styles.tdCol, { width: 110, textAlign: 'right', fontWeight: '700' }]} numberOfLines={1}>
                    {r.residentName}
                  </Text>
                  {/* Type */}
                  <Text style={[styles.tdCol, { width: 65, textAlign: 'center' }]}>
                    {r.residentType === 'T' ? 'مستأجر' : 'مالك'}
                  </Text>
                  {/* Unit Type */}
                  <Text style={[styles.tdCol, { width: 75, textAlign: 'center', color: '#024C59' }]}>
                    {r.unitType?.name || 'غير محدد'}
                  </Text>
                  {/* Unit No */}
                  <Text style={[styles.tdCol, { width: 140, textAlign: 'right' }]} numberOfLines={1}>
                    {unitDetails}
                  </Text>
                  {/* Mobile */}
                  <Text style={[styles.tdCol, { width: 95, textAlign: 'center' }]}>
                    {r.mobile}
                  </Text>
                  {/* Monthly Fees */}
                  <Text style={[styles.tdCol, { width: 85, textAlign: 'left', color: '#024C59', fontWeight: '600' }]}>
                    {r.monthlyFees} ج.م
                  </Text>
                  {/* Balance */}
                  <Text style={[styles.tdCol, { width: 85, textAlign: 'left', color: (r.balance ?? 0) > 0 ? '#EF4444' : '#10B981', fontWeight: '700' }]}>
                    {(r.balance ?? 0)} ج.م
                  </Text>
                  {/* Actions */}
                  <View style={[{ width: 70, flexDirection: 'row-reverse', justifyContent: 'center', gap: 10 }]}>
                    <TouchableOpacity onPress={() => openEdit(r)}>
                      <Ionicons name="pencil-outline" size={18} color="#024C59" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setResetTarget(r)}>
                      <Ionicons name="refresh-circle-outline" size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 5. RESET PASSWORD MODAL POP-UP */}
      <Modal
        visible={!!resetTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setResetTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="key-outline" size={32} color="#024C59" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>إعادة كلمة المرور</Text>
            <Text style={styles.confirmSubtext}>أنت الآن على وشك إعادة تعيين كلمة المرور إلى 123 للوحدة: </Text>
            <Text style={styles.confirmTargetName}>{resetTarget?.residentName}</Text>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnYes]}
                onPress={triggerPasswordReset}
                disabled={resettingPassword}
              >
                {resettingPassword ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="refresh-circle-outline" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                    <Text style={styles.confirmBtnText}>إعادة تعيين</Text>
                  </>
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

      {/* 6. EDIT/NEW UNIT DATA FULL-SCREEN SHEET MODAL */}
      <Modal
        visible={showForm}
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="chevron-forward-outline" size={24} color="#024C59" />
            </TouchableOpacity>
            <Text style={styles.formHeaderTitle}>{editingId ? 'تعديل بيانات الوحدة' : 'إضافة وحدة جديدة'}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Pair 1: Name and Mobile */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>الاسم</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.residentName}
                  onChangeText={(v) => setForm({ ...form, residentName: v })}
                  placeholder="عمرو المهدي..."
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>الموبايل</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.mobile}
                  onChangeText={(v) => setForm({ ...form, mobile: v })}
                  placeholder="0100000000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Pair 2: LandLine and Email */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>الهاتف الأرضي</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.landLine}
                  onChangeText={(v) => setForm({ ...form, landLine: v })}
                  placeholder="ادخل الهاتف الأرضي"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>البريد الإلكتروني</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.email}
                  onChangeText={(v) => setForm({ ...form, email: v })}
                  placeholder="email@example.com"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Pair 3: Username and Nationality */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>اسم المستخدم (تلقائي)</Text>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: '#F1F5F9', color: '#64748B' }]}
                  value={username}
                  editable={false}
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>الجنسية</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.nationality}
                  onChangeText={(v) => setForm({ ...form, nationality: v })}
                  placeholder="مصري"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Pair 4: Resident Type and Unit Type Dropdown */}
            <View style={styles.formRow}>
              {/* Resident Type Tabs */}
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>نوع السكن</Text>
                <View style={styles.tabsContainer}>
                  <TouchableOpacity
                    style={[styles.tabBtn, form.residentType === 'O' && styles.tabBtnActive]}
                    onPress={() => setForm({ ...form, residentType: 'O' })}
                  >
                    <Text style={[styles.tabText, form.residentType === 'O' && styles.tabTextActive]}>مالك</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabBtn, form.residentType === 'T' && styles.tabBtnActive]}
                    onPress={() => setForm({ ...form, residentType: 'T' })}
                  >
                    <Text style={[styles.tabText, form.residentType === 'T' && styles.tabTextActive]}>مستأجر</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Unit Type Custom Modal Picker Trigger */}
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>نوع الوحدة</Text>
                <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowUnitTypePicker(true)}>
                  <Text style={styles.selectTriggerText}>
                    {selectedUnitType ? `${selectedUnitType.name} (${selectedUnitType.monthlyFees} ج.م)` : 'اختر نوع الوحدة'}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Pair 5: Monthly Fees */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>الرسوم الشهرية</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.monthlyFees}
                  onChangeText={(v) => setForm({ ...form, monthlyFees: v })}
                  keyboardType="numeric"
                  placeholder="200"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.formCol} />
            </View>

            {/* Pair 6: District and Plot */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>المجاورة</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.area}
                  onChangeText={(v) => setForm({ ...form, area: v })}
                  placeholder="المجاورة 16"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>القطعة</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.buildingNo}
                  onChangeText={(v) => setForm({ ...form, buildingNo: v })}
                  placeholder="القطعة 12 أ"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Pair 7: Floor and Apartment Number */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>الدور</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.floorNo}
                  onChangeText={(v) => setForm({ ...form, floorNo: v })}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>رقم الوحدة</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.apartmentNo}
                  onChangeText={(v) => setForm({ ...form, apartmentNo: v })}
                  placeholder="1"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Notes */}
            <Text style={styles.fieldLabel}>ملاحظات (للإدارة فقط)</Text>
            <TextInput
              style={[styles.fieldInput, { height: 80, textAlignVertical: 'top', paddingVertical: 10 }]}
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              placeholder="اكتب أي ملاحظات داخلية عن المالك أو الوحدة..."
              placeholderTextColor="#94A3B8"
              multiline={true}
            />

            {/* DEPENDENTS SECTION */}
            {editingId && (
              <View style={styles.dependentsBlock}>
                <Text style={styles.dependentsBlockTitle}>التابعون (دخول عبر التطبيق)</Text>
                <Text style={styles.dependentsInstruction}>
                  البريد مطلوب. اسم المستخدم يعيّن تلقائياً ({depPreviewUsername || '…'}). كلمة المرور الافتراضية 123 ويُطلب تغييرها عند أول تسجيل دخول.
                </Text>

                {/* Dependents Inputs */}
                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.fieldLabel}>الاسم</Text>
                    <TextInput
                      style={styles.fieldInputCompact}
                      value={depForm.name}
                      onChangeText={(v) => setDepForm({ ...depForm, name: v })}
                      placeholder="الاسم الكامل"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.fieldLabel}>الموبايل</Text>
                    <TextInput
                      style={styles.fieldInputCompact}
                      value={depForm.mobile}
                      onChangeText={(v) => setDepForm({ ...depForm, mobile: v })}
                      placeholder="رقم الموبايل"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.fieldLabel}>العلاقة</Text>
                    <TouchableOpacity style={styles.selectTriggerCompact} onPress={() => setShowRelationPicker(true)}>
                      <Text style={styles.selectTriggerText}>{depForm.relation}</Text>
                      <Ionicons name="chevron-down-outline" size={14} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.fieldLabel}>البريد</Text>
                    <TextInput
                      style={styles.fieldInputCompact}
                      value={depForm.email}
                      onChangeText={(v) => setDepForm({ ...depForm, email: v })}
                      placeholder="email@example.com"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.addDepBtn}
                  disabled={savingDep}
                  onPress={async () => {
                    if (!depForm.name.trim() || !depForm.mobile.trim() || !depForm.email.trim()) {
                      Alert.alert('تنبيه', 'الاسم والموبايل والبريد مطلوبة لإضافة التابع');
                      return;
                    }
                    setSavingDep(true);
                    try {
                      await api.createDependent({
                        residentId: editingId,
                        name: depForm.name.trim(),
                        relation: depForm.relation,
                        mobile: depForm.mobile.trim(),
                        email: depForm.email.trim(),
                      });
                      const assigned = depPreviewUsername;
                      setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
                      setDependents(await api.getDependents(editingId));
                      api.getSuggestedUsername().then((s) => setDepPreviewUsername(s.username)).catch(() => {});
                      Alert.alert('تم', `تم إضافة التابع بنجاح — اسم المستخدم: ${assigned} — كلمة المرور 123`);
                    } catch (e) {
                      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل إضافة التابع');
                    } finally {
                      setSavingDep(false);
                    }
                  }}
                >
                  {savingDep ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="add-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                      <Text style={styles.addDepBtnText}>إضافة تابع</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Dependents List Card Feed */}
                {dependents.map((d) => (
                  <View key={d.id} style={styles.depCard}>
                    <View style={styles.depCardHeader}>
                      <Text style={styles.depCardName}>{d.name}</Text>
                      <Text style={styles.depCardBadge}>{d.relation}</Text>
                    </View>
                    <Text style={styles.depCardMeta}>موبايل: {d.mobile} · اسم المستخدم: @{d.user?.username || '—'}</Text>
                    <Text style={styles.depCardMeta}>البريد: {d.email || '—'}</Text>
                    
                    <View style={styles.depCardActions}>
                      <TouchableOpacity
                        style={styles.depResetBtn}
                        onPress={async () => {
                          try {
                            const r = await api.resetDependentPassword(d.id);
                            Alert.alert('تم', r.message);
                          } catch (e) {
                            Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل');
                          }
                        }}
                      >
                        <Ionicons name="refresh-circle-outline" size={16} color="#024C59" style={{ marginLeft: 4 }} />
                        <Text style={styles.depResetBtnText}>إعادة كلمة المرور</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.depDeleteBtn}
                        onPress={() => {
                          Alert.alert('تأكيد', `حذف التابع: ${d.name}؟`, [
                            { text: 'إلغاء', style: 'cancel' },
                            {
                              text: 'حذف',
                              style: 'destructive',
                              onPress: async () => {
                                await api.deleteDependent(d.id);
                                setDependents(await api.getDependents(editingId));
                              },
                            },
                          ]);
                        }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginLeft: 4 }} />
                        <Text style={styles.depDeleteBtnText}>حذف</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Action Buttons for Sheet Form */}
            <View style={styles.formActionsRow}>
              <TouchableOpacity style={styles.submitBtn} onPress={save}>
                <Text style={styles.submitBtnText}>حفظ التعديلات</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>

            {/* Reset Password link inside edit view */}
            {editingId && (
              <TouchableOpacity
                style={styles.resetPassLink}
                onPress={() => {
                  const targetRes = rows.find(r => r.id === editingId);
                  if (targetRes) {
                    setShowForm(false);
                    setResetTarget(targetRes);
                  }
                }}
              >
                <Ionicons name="refresh-circle-outline" size={18} color="#024C59" style={{ marginLeft: 4 }} />
                <Text style={styles.resetPassLinkText}>إعادة كلمة المرور إلى 123</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* 7. CUSTOM SELECT POP-UP DRAWER FOR UNIT TYPE */}
      <Modal
        visible={showUnitTypePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUnitTypePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر نوع الوحدة</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {types.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.pickerItem, form.unitTypeId === String(t.id) && styles.pickerItemActive]}
                  onPress={() => {
                    setForm({ ...form, unitTypeId: String(t.id), monthlyFees: String(t.monthlyFees) });
                    setShowUnitTypePicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, form.unitTypeId === String(t.id) && styles.pickerItemTextActive]}>
                    {t.name} ({t.monthlyFees} ج.م)
                  </Text>
                  {form.unitTypeId === String(t.id) && (
                    <Ionicons name="checkmark-sharp" size={16} color="#024C59" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowUnitTypePicker(false)}>
              <Text style={styles.closePickerBtnText}>إغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 8. CUSTOM SELECT POP-UP DRAWER FOR DEPENDENT RELATION */}
      <Modal
        visible={showRelationPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRelationPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر صلة القرابة</Text>
            <ScrollView style={{ maxHeight: 250 }}>
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
                  {depForm.relation === r && (
                    <Ionicons name="checkmark-sharp" size={16} color="#024C59" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowRelationPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  addBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#024C59',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    textAlign: 'right',
    height: '100%',
  },
  searchIcon: {
    marginRight: 8,
  },
  tableScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  tableContainer: {
    flexDirection: 'column',
    minWidth: 715,
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
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },

  // DIALOG CONFIRM MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
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
  confirmTargetName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#024C59',
    marginTop: 6,
    textAlign: 'center',
    marginBottom: 20,
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
    flexDirection: 'row-reverse',
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

  // SHEET FORM MODAL STYLES
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
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  formScroll: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  formRow: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginBottom: 12,
  },
  formCol: {
    flex: 1,
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
  tabsContainer: {
    flexDirection: 'row-reverse',
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FAFBFD',
  },
  tabBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#024C59',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  formActionsRow: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
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
  resetPassLink: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  resetPassLinkText: {
    fontSize: 13,
    color: '#024C59',
    fontWeight: '700',
  },

  // DEPENDENTS BLOCK IN EDIT MODAL
  dependentsBlock: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dependentsBlockTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'right',
    marginBottom: 6,
  },
  dependentsInstruction: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    textAlign: 'right',
    marginBottom: 14,
  },
  fieldInputCompact: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFD',
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#1E293B',
    textAlign: 'right',
  },
  selectTriggerCompact: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFD',
    paddingHorizontal: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addDepBtn: {
    height: 38,
    backgroundColor: '#024C59',
    borderRadius: 8,
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  addDepBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  depCard: {
    backgroundColor: '#FAFBFD',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 10,
  },
  depCardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  depCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  depCardBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#024C59',
    backgroundColor: '#E6F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  depCardMeta: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
  },
  depCardActions: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  depResetBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  depResetBtnText: {
    fontSize: 11,
    color: '#024C59',
    fontWeight: '700',
  },
  depDeleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  depDeleteBtnText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700',
  },

  // CUSTOM SELECT PICKER LISTS
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
});

