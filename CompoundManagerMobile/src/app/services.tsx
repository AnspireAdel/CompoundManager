import { useCallback, useMemo, useState } from 'react';
import {
  Alert, Text, TextInput, TouchableOpacity, View, StyleSheet,
  ScrollView, ActivityIndicator, Modal, Pressable, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Resident, Service, ServiceType } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const emptyForm = {
  serviceType: '',
  serviceName: '',
  mobile: '',
  notes: '',
  residentId: '',
};

export default function ServicesScreen() {
  const { isStaff, user: authUser } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Filter Pickers Overlay State
  const [showStatusFilterPicker, setShowStatusFilterPicker] = useState(false);
  const [showTypeFilterPicker, setShowTypeFilterPicker] = useState(false);

  // Form Sheets State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Form Pickers State
  const [showFormTypePicker, setShowFormTypePicker] = useState(false);
  const [showFormProviderPicker, setShowFormProviderPicker] = useState(false);

  // Toggle Confirm State
  const [toggleTarget, setToggleTarget] = useState<Service | null>(null);
  const [toggling, setToggling] = useState(false);

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const [list, t] = await Promise.all([
        api.getServices(isStaff),
        api.getServiceTypes(isStaff),
      ]);
      setServices(list);
      setTypes(t);
      if (isStaff) {
        const people = await api.getResidents();
        setResidents(people);
      }
    } catch (e) {
      console.error(e);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [isStaff])
  );

  function openCreate() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      serviceType: types[0] ? types[0].name : '',
    });
    setShowFormModal(true);
  }

  function openEdit(s: Service) {
    setEditingId(s.id);
    setForm({
      serviceType: s.serviceType,
      serviceName: s.serviceName,
      mobile: s.mobile,
      notes: s.notes || '',
      residentId: s.residentId ? String(s.residentId) : '',
    });
    setShowFormModal(true);
  }

  async function save() {
    if (!form.serviceType || !form.serviceName || !form.mobile) {
      Alert.alert('تنبيه', 'برجاء تعبئة كافة الحقول المطلوبة');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        serviceType: form.serviceType,
        serviceName: form.serviceName.trim(),
        mobile: form.mobile.trim(),
        notes: form.notes.trim() || undefined,
        residentId: form.residentId ? Number(form.residentId) : undefined,
      };

      if (editingId) {
        await api.updateService(editingId, payload);
        Alert.alert('تم بنجاح', 'تم تعديل بيانات الخدمة بنجاح.');
      } else {
        await api.createService(payload);
        Alert.alert('تم بنجاح', 'تم تسجيل الخدمة بنجاح.');
      }
      setShowFormModal(false);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function triggerToggle() {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      await api.toggleService(toggleTarget.id);
      Alert.alert(
        'تم بنجاح',
        `تم ${toggleTarget.activeFlag === 'Y' ? 'إيقاف' : 'تفعيل'} الخدمة بنجاح.`
      );
      setToggleTarget(null);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل التعديل');
    } finally {
      setToggling(false);
    }
  }

  async function triggerDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteService(deleteTarget.id);
      Alert.alert('تم بنجاح', 'تم حذف الخدمة بنجاح.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل حذف الخدمة');
    } finally {
      setDeleting(false);
    }
  }

  // Filter list in memory
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      // 1. Search Query
      const q = search.trim().toLowerCase();
      if (q) {
        const matches = [
          s.serviceType,
          s.serviceName,
          s.mobile,
          s.resident?.residentName,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
        if (!matches) return false;
      }
      // 2. Status Filter
      if (statusFilter === 'ACTIVE' && s.activeFlag !== 'Y') return false;
      if (statusFilter === 'INACTIVE' && s.activeFlag !== 'N') return false;

      // 3. Type Filter
      if (typeFilter !== 'ALL' && s.serviceType !== typeFilter) return false;

      return true;
    });
  }, [services, search, statusFilter, typeFilter]);

  const selectedResident = residents.find((r) => String(r.id) === form.residentId);

  return (
    <Screen
      title="الخدمات"
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

      {/* 2. SUBHEADER & ACTIONS */}
      <View style={styles.subHeader}>
        <Text style={styles.pageTitle}>الخدمات</Text>
        {isStaff && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            <Text style={styles.addBtnText}>إضافة خدمة</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. SEARCH & DROPDOWN FILTER ROW */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginLeft: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث باسم الخدمة، المالك، الموبايل..."
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.filtersRow}>
          <TouchableOpacity style={styles.filterTrigger} onPress={() => setShowStatusFilterPicker(true)}>
            <Text style={styles.filterTriggerText}>
              {statusFilter === 'ALL' ? 'الحالة' : statusFilter === 'ACTIVE' ? 'نشط' : 'غير نشط'}
            </Text>
            <Ionicons name="chevron-down-outline" size={14} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterTrigger} onPress={() => setShowTypeFilterPicker(true)}>
            <Text style={styles.filterTriggerText} numberOfLines={1}>
              {typeFilter === 'ALL' ? 'النوع' : typeFilter}
            </Text>
            <Ionicons name="chevron-down-outline" size={14} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. HORIZONTAL DATA TABLE */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
        <View style={styles.tableContainer}>
          {/* Table Headers */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCol, { width: 75, textAlign: 'center' }]}>النوع</Text>
            <Text style={[styles.thCol, { width: 140, textAlign: 'right' }]}>الاسم</Text>
            <Text style={[styles.thCol, { width: 140, textAlign: 'right' }]}>المالك</Text>
            <Text style={[styles.thCol, { width: 95, textAlign: 'center' }]}>الموبايل</Text>
            <Text style={[styles.thCol, { width: 75, textAlign: 'center' }]}>الحالة</Text>
            {isStaff && <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>إجراءات</Text>}
          </View>

          {/* Table Rows */}
          {filteredServices.length === 0 ? (
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>لا توجد أي خدمات مسجلة</Text>
            </View>
          ) : (
            filteredServices.map((item, idx) => {
              const isActive = item.activeFlag === 'Y';
              return (
                <View key={item.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                  {/* Type */}
                  <Text style={[styles.tdCol, { width: 75, textAlign: 'center', fontWeight: '600', color: '#024C59' }]}>
                    {item.serviceType}
                  </Text>
                  {/* Name */}
                  <Text style={[styles.tdCol, { width: 140, textAlign: 'right', fontWeight: '700' }]} numberOfLines={1}>
                    {item.serviceName}
                  </Text>
                  {/* Owner */}
                  <Text style={[styles.tdCol, { width: 140, textAlign: 'right' }]} numberOfLines={1}>
                    {item.resident?.residentName || '—'}
                  </Text>
                  {/* Mobile */}
                  <Text style={[styles.tdCol, { width: 95, textAlign: 'center' }]}>
                    {item.mobile}
                  </Text>
                  {/* Status Badge */}
                  <View style={[{ width: 75, alignItems: 'center' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#10B981' : '#EF4444' }}>
                      {isActive ? 'نشط' : 'غير نشط'}
                    </Text>
                  </View>
                  {/* Action controls (Staff only) */}
                  {isStaff && (
                    <View style={[{ width: 90, flexDirection: 'row-reverse', justifyContent: 'center', gap: 12 }]}>
                      {/* Toggle status */}
                      <TouchableOpacity onPress={() => setToggleTarget(item)}>
                        <Ionicons name="power-outline" size={16} color={isActive ? '#024C59' : '#EF4444'} />
                      </TouchableOpacity>
                      {/* Delete */}
                      <TouchableOpacity onPress={() => setDeleteTarget(item)}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                      {/* Edit */}
                      <TouchableOpacity onPress={() => openEdit(item)}>
                        <Ionicons name="pencil-outline" size={16} color="#024C59" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 5. TOGGLE SERVICE CONFIRMATION POPUP */}
      <Modal
        visible={!!toggleTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setToggleTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="power-outline" size={32} color="#024C59" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>
              {toggleTarget?.activeFlag === 'Y' ? 'إيقاف الخدمة' : 'تفعيل الخدمة'}
            </Text>
            <Text style={styles.confirmSubtext}>
              هل أنت متأكد من {toggleTarget?.activeFlag === 'Y' ? 'إيقاف' : 'تفعيل'} الخدمة؟
            </Text>
            <Text style={styles.confirmTargetVal}>
              "{toggleTarget?.serviceName || 'الخدمة'}"
            </Text>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnYes]}
                onPress={triggerToggle}
                disabled={toggling}
              >
                {toggling ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    {toggleTarget?.activeFlag === 'Y' ? 'إيقاف' : 'تفعيل'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnNo]}
                onPress={() => setToggleTarget(null)}
              >
                <Text style={styles.confirmBtnTextNo}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. DELETE SERVICE CONFIRMATION POPUP */}
      <Modal
        visible={!!deleteTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="trash-outline" size={32} color="#EF4444" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>حذف الخدمة</Text>
            <Text style={styles.confirmSubtext}>هل أنت متأكد من حذف الخدمة نهائياً؟</Text>
            <Text style={styles.confirmTargetVal}>
              "{deleteTarget?.serviceName || 'الخدمة'}"
            </Text>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnYes, { backgroundColor: '#EF4444' }]}
                onPress={triggerDelete}
                disabled={deleting}
              >
                {deleting ? (
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

      {/* 7. CREATE / EDIT SERVICE SHEET MODAL */}
      <Modal
        visible={showFormModal}
        animationType="slide"
        onRequestClose={() => setShowFormModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setShowFormModal(false)}>
              <Ionicons name="chevron-forward-outline" size={24} color="#024C59" />
            </TouchableOpacity>
            <Text style={styles.formHeaderTitle}>
              {editingId ? `تعديل الخدمة "${form.serviceName}"` : 'إضافة خدمة جديدة'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Pair 1: Service Type & Service Name */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>النوع</Text>
                <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowFormTypePicker(true)}>
                  <Text style={styles.selectTriggerText}>
                    {form.serviceType ? form.serviceType : 'اختر النوع...'}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>اسم الخدمة</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.serviceName}
                  onChangeText={(v) => setForm({ ...form, serviceName: v })}
                  placeholder="مثال: صيدلية جهاد..."
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Pair 2: Mobile & Provider */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>الموبايل</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.mobile}
                  onChangeText={(v) => setForm({ ...form, mobile: v })}
                  keyboardType="phone-pad"
                  placeholder="010XXXXXXXX"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>مقدم الخدمة (اختياري)</Text>
                <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowFormProviderPicker(true)}>
                  <Text style={styles.selectTriggerText} numberOfLines={1}>
                    {selectedResident ? selectedResident.residentName : 'بدون مقدم خدمة'}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notes */}
            <Text style={styles.fieldLabel}>ملاحظات</Text>
            <TextInput
              style={[styles.fieldInput, { height: 100, textAlignVertical: 'top', paddingVertical: 10 }]}
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              placeholder="اكتب تفاصيل أو ملاحظات حول الخدمة..."
              placeholderTextColor="#94A3B8"
              multiline={true}
            />

            {/* Action buttons */}
            <View style={styles.formActionsRow}>
              <TouchableOpacity style={styles.submitBtn} onPress={save} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingId ? 'حفظ التعديلات' : 'انشاء خدمة جديدة'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFormModal(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* 8. STATUS FILTER PICKER */}
      <Modal
        visible={showStatusFilterPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatusFilterPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر الحالة</Text>
            <TouchableOpacity
              style={[styles.pickerItem, statusFilter === 'ALL' && styles.pickerItemActive]}
              onPress={() => {
                setStatusFilter('ALL');
                setShowStatusFilterPicker(false);
              }}
            >
              <Text style={[styles.pickerItemText, statusFilter === 'ALL' && styles.pickerItemTextActive]}>الكل</Text>
              {statusFilter === 'ALL' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerItem, statusFilter === 'ACTIVE' && styles.pickerItemActive]}
              onPress={() => {
                setStatusFilter('ACTIVE');
                setShowStatusFilterPicker(false);
              }}
            >
              <Text style={[styles.pickerItemText, statusFilter === 'ACTIVE' && styles.pickerItemTextActive]}>نشط</Text>
              {statusFilter === 'ACTIVE' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerItem, statusFilter === 'INACTIVE' && styles.pickerItemActive]}
              onPress={() => {
                setStatusFilter('INACTIVE');
                setShowStatusFilterPicker(false);
              }}
            >
              <Text style={[styles.pickerItemText, statusFilter === 'INACTIVE' && styles.pickerItemTextActive]}>غير نشط</Text>
              {statusFilter === 'INACTIVE' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowStatusFilterPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 9. TYPE FILTER PICKER */}
      <Modal
        visible={showTypeFilterPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTypeFilterPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر النوع</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              <TouchableOpacity
                style={[styles.pickerItem, typeFilter === 'ALL' && styles.pickerItemActive]}
                onPress={() => {
                  setTypeFilter('ALL');
                  setShowTypeFilterPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, typeFilter === 'ALL' && styles.pickerItemTextActive]}>الكل</Text>
                {typeFilter === 'ALL' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
              </TouchableOpacity>
              {types.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.pickerItem, typeFilter === t.name && styles.pickerItemActive]}
                  onPress={() => {
                    setTypeFilter(t.name);
                    setShowTypeFilterPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, typeFilter === t.name && styles.pickerItemTextActive]}>
                    {t.name}
                  </Text>
                  {typeFilter === t.name && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowTypeFilterPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 10. FORM TYPE PICKER */}
      <Modal
        visible={showFormTypePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFormTypePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر النوع</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {types.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.pickerItem, form.serviceType === t.name && styles.pickerItemActive]}
                  onPress={() => {
                    setForm({ ...form, serviceType: t.name });
                    setShowFormTypePicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, form.serviceType === t.name && styles.pickerItemTextActive]}>
                    {t.name}
                  </Text>
                  {form.serviceType === t.name && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowFormTypePicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 11. FORM PROVIDER PICKER */}
      <Modal
        visible={showFormProviderPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFormProviderPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر مقدم الخدمة</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              <TouchableOpacity
                style={[styles.pickerItem, form.residentId === '' && styles.pickerItemActive]}
                onPress={() => {
                  setForm({ ...form, residentId: '' });
                  setShowFormProviderPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, form.residentId === '' && styles.pickerItemTextActive]}>
                  بدون مقدم خدمة
                </Text>
                {form.residentId === '' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
              </TouchableOpacity>
              {residents.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.pickerItem, form.residentId === String(r.id) && styles.pickerItemActive]}
                  onPress={() => {
                    setForm({ ...form, residentId: String(r.id) });
                    setShowFormProviderPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, form.residentId === String(r.id) && styles.pickerItemTextActive]}>
                    {r.residentName} ({r.area}-{r.buildingNo})
                  </Text>
                  {form.residentId === String(r.id) && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowFormProviderPicker(false)}>
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
  searchSection: {
    marginBottom: 16,
    paddingHorizontal: 4,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    textAlign: 'right',
  },
  filtersRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  filterTrigger: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  filterTriggerText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
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
    fontSize: 15,
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
