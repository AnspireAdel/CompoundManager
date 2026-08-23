import { useCallback, useState } from 'react';
import {
  Alert, Text, TextInput, TouchableOpacity, View, StyleSheet,
  ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, UnitType } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function UnitTypesScreen() {
  const { isStaff, user: authUser } = useAuth();
  const [types, setTypes] = useState<UnitType[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Form Modal State (Add/Edit)
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [typeName, setTypeName] = useState('');
  const [monthlyFees, setMonthlyFees] = useState('500');
  const [hasFloor, setHasFloor] = useState(true);
  const [hasApartment, setHasApartment] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState<UnitType | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle Confirm State
  const [toggleTarget, setToggleTarget] = useState<UnitType | null>(null);
  const [toggling, setToggling] = useState(false);

  async function load() {
    try {
      setTypes(await api.getUnitTypes(true));
    } catch (e) {
      console.error(e);
    }
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, []));

  function openCreate() {
    setEditingId(null);
    setTypeName('');
    setMonthlyFees('500');
    setHasFloor(true);
    setHasApartment(true);
    setShowFormModal(true);
  }

  function openEdit(t: UnitType) {
    setEditingId(t.id);
    setTypeName(t.name);
    setMonthlyFees(String(t.monthlyFees));
    setHasFloor(t.hasFloor);
    setHasApartment(t.hasApartment);
    setShowFormModal(true);
  }

  async function save() {
    if (!typeName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم النوع');
      return;
    }
    if (!monthlyFees.trim() || isNaN(Number(monthlyFees))) {
      Alert.alert('تنبيه', 'يرجى إدخال رسوم شهرية صالحة');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: typeName.trim(),
        monthlyFees: Number(monthlyFees),
        hasFloor,
        hasApartment,
      };

      if (editingId) {
        await api.updateUnitType(editingId, payload);
        Alert.alert('تم بنجاح', 'تم تعديل نوع الوحدة بنجاح.');
      } else {
        await api.createUnitType(payload);
        Alert.alert('تم بنجاح', 'تم إضافة نوع الوحدة بنجاح.');
      }
      setShowFormModal(false);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function triggerDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteUnitType(deleteTarget.id);
      Alert.alert('تم بنجاح', 'تم حذف نوع الوحدة بنجاح.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الحذف');
    } finally {
      setDeleting(false);
    }
  }

  async function triggerToggle() {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      await api.toggleUnitType(toggleTarget.id);
      Alert.alert(
        'تم بنجاح',
        `تم ${toggleTarget.activeFlag === 'Y' ? 'إيقاف' : 'تفعيل'} نوع الوحدة بنجاح.`
      );
      setToggleTarget(null);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل تغيير الحالة');
    } finally {
      setToggling(false);
    }
  }

  return (
    <Screen
      title="أنواع الوحدات"
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
        <Text style={styles.pageTitle}>أنواع الوحدات</Text>
        {isStaff && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            <Text style={styles.addBtnText}>إضافة نوع جديد</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. HORIZONTAL DATA TABLE */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
        <View style={styles.tableContainer}>
          {/* Table Headers */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCol, { width: 140, textAlign: 'right' }]}>الاسم</Text>
            <Text style={[styles.thCol, { width: 110, textAlign: 'center' }]}>الرسوم الشهرية</Text>
            <Text style={[styles.thCol, { width: 110, textAlign: 'center' }]}>الخصائص</Text>
            <Text style={[styles.thCol, { width: 85, textAlign: 'center' }]}>الحالة</Text>
            {isStaff && <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>إجراءات</Text>}
          </View>

          {/* Table Rows */}
          {types.length === 0 ? (
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>لا توجد أنواع وحدات مسجلة</Text>
            </View>
          ) : (
            types.map((item, idx) => {
              const isActive = item.activeFlag === 'Y';
              const props = [item.hasFloor ? 'دور' : '', item.hasApartment ? 'شقة' : ''].filter(Boolean).join(' · ') || '—';
              return (
                <View key={item.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                  {/* Name */}
                  <Text style={[styles.tdCol, { width: 140, textAlign: 'right', fontWeight: '700' }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {/* Monthly Fees */}
                  <Text style={[styles.tdCol, { width: 110, textAlign: 'center', color: '#024C59', fontWeight: '700' }]}>
                    {item.monthlyFees} ج.م
                  </Text>
                  {/* Properties */}
                  <Text style={[styles.tdCol, { width: 110, textAlign: 'center', color: '#64748B' }]}>
                    {props}
                  </Text>
                  {/* Status */}
                  <View style={[{ width: 85, alignItems: 'center' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#10B981' : '#EF4444' }}>
                      {isActive ? 'نشط' : 'غير نشط'}
                    </Text>
                  </View>
                  {/* Actions (Staff only) */}
                  {isStaff && (
                    <View style={[{ width: 90, flexDirection: 'row-reverse', justifyContent: 'center', gap: 12 }]}>
                      {/* Toggle */}
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

      {/* 4. FORM SHEET MODAL */}
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
              {editingId ? `تعديل النوع "${typeName}"` : 'إضافة نوع جديد'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Name Input */}
            <Text style={styles.fieldLabel}>اسم النوع</Text>
            <TextInput
              style={styles.fieldInput}
              value={typeName}
              onChangeText={setTypeName}
              placeholder="ادخل اسم النوع (مثل: فيلا، شقة)"
              placeholderTextColor="#94A3B8"
            />

            {/* Fees Input */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>الرسوم الشهرية</Text>
            <TextInput
              style={styles.fieldInput}
              value={monthlyFees}
              onChangeText={setMonthlyFees}
              keyboardType="decimal-pad"
              placeholder="ادخل قيمة الرسوم الشهرية بالجنيه"
              placeholderTextColor="#94A3B8"
            />

            {/* Checkbox triggers */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>الخصائص</Text>
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setHasFloor(!hasFloor)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={hasFloor ? 'checkbox' : 'square-outline'}
                  size={22}
                  color="#024C59"
                  style={{ marginLeft: 8 }}
                />
                <Text style={styles.checkboxLabel}>له دور</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.checkboxRow, { marginTop: 12 }]}
                onPress={() => setHasApartment(!hasApartment)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={hasApartment ? 'checkbox' : 'square-outline'}
                  size={22}
                  color="#024C59"
                  style={{ marginLeft: 8 }}
                />
                <Text style={styles.checkboxLabel}>له شقة / وحدة</Text>
              </TouchableOpacity>
            </View>

            {/* Action buttons */}
            <View style={styles.formActionsRow}>
              <TouchableOpacity style={styles.submitBtn} onPress={save} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingId ? 'حفظ التعديلات' : 'انشاء النوع'}
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

      {/* 5. DELETE CONFIRM MODAL */}
      <Modal
        visible={!!deleteTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="trash-outline" size={32} color="#EF4444" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>حذف النوع</Text>
            <Text style={styles.confirmSubtext}>هل أنت متأكد من حذف هذا النوع؟</Text>
            <Text style={styles.confirmTargetVal}>
              "{deleteTarget?.name || 'نوع الوحدة'}"
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

      {/* 6. TOGGLE ACTIVE CONFIRM MODAL */}
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
              {toggleTarget?.activeFlag === 'Y' ? 'إيقاف النوع' : 'تفعيل النوع'}
            </Text>
            <Text style={styles.confirmSubtext}>
              هل أنت متأكد من {toggleTarget?.activeFlag === 'Y' ? 'إيقاف' : 'تفعيل'} هذا النوع؟
            </Text>
            <Text style={styles.confirmTargetVal}>
              "{toggleTarget?.name || 'نوع الوحدة'}"
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

  // SHEET MODAL STYLES
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
  checkboxContainer: {
    backgroundColor: '#FAFBFD',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
  },
  checkboxRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#1E293B',
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
