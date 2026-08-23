import { useCallback, useState } from 'react';
import {
  Alert, Text, TextInput, TouchableOpacity, View, StyleSheet,
  ScrollView, ActivityIndicator, Modal, Pressable, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Expense, ExpenseType, Resident } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const emptyForm = {
  scope: 'COMPOUND' as 'COMPOUND' | 'UNIT',
  expenseTypeId: '',
  residentId: '',
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  notes: '',
};

export default function ExpensesScreen() {
  const { isStaff, user: authUser } = useAuth();
  const [rows, setRows] = useState<Expense[]>([]);
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'COMPOUND' | 'UNIT'>('ALL');
  const [showScopeFilterPicker, setShowScopeFilterPicker] = useState(false);

  // Form Sheets State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Form Pickers State
  const [showFormScopePicker, setShowFormScopePicker] = useState(false);
  const [showFormTypePicker, setShowFormTypePicker] = useState(false);
  const [showFormResidentPicker, setShowFormResidentPicker] = useState(false);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const [list, t, people] = await Promise.all([
        api.getExpenses(),
        api.getExpenseTypes(true),
        api.getResidents(),
      ]);
      setRows(list);
      setTypes(t);
      setResidents(people);
    } catch (e) {
      console.error(e);
    }
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, []));

  function openCreate() {
    const firstType = types.filter((t) => t.activeFlag === 'Y')[0] || types[0];
    setEditingId(null);
    setForm({
      ...emptyForm,
      expenseTypeId: firstType ? String(firstType.id) : '',
    });
    setShowFormModal(true);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    setForm({
      scope: e.scope,
      expenseTypeId: String(e.expenseTypeId),
      residentId: e.residentId ? String(e.residentId) : '',
      amount: String(e.amount),
      expenseDate: e.expenseDate.slice(0, 10),
      notes: e.notes || '',
    });
    setShowFormModal(true);
  }

  async function save() {
    if (!form.expenseTypeId || !form.amount || !form.expenseDate) {
      Alert.alert('تنبيه', 'برجاء تعبئة كافة الحقول المطلوبة');
      return;
    }
    if (form.scope === 'UNIT' && !form.residentId) {
      Alert.alert('تنبيه', 'يرجى تحديد الساكن / الوحدة للمصروف');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        expenseTypeId: Number(form.expenseTypeId),
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        notes: form.notes.trim() || null,
        residentId: form.scope === 'UNIT' ? Number(form.residentId) : null,
        scope: form.scope,
      };

      if (editingId) {
        await api.updateExpense(editingId, payload);
        Alert.alert('تم بنجاح', 'تم تعديل المصروف بنجاح.');
      } else {
        await api.createExpense(payload);
        Alert.alert('تم بنجاح', 'تم تسجيل المصروف بنجاح.');
      }
      setShowFormModal(false);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل حفظ المصروف');
    } finally {
      setSaving(false);
    }
  }

  async function triggerDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteExpense(deleteTarget.id);
      Alert.alert('تم بنجاح', 'تم حذف المصروف بنجاح.');
      setDeleteTarget(null);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل حذف المصروف');
    } finally {
      setDeleting(false);
    }
  }

  // Filter rows in memory
  const filteredRows = rows.filter((r) => {
    if (scopeFilter === 'ALL') return true;
    return r.scope === scopeFilter;
  });

  // Calculate sum of currently displayed expenses
  const displayedSum = filteredRows.reduce((sum, r) => sum + r.amount, 0);

  const selectedType = types.find((t) => String(t.id) === form.expenseTypeId);
  const selectedResident = residents.find((r) => String(r.id) === form.residentId);

  return (
    <Screen
      title="المصاريف"
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
        <Text style={styles.pageTitle}>المصاريف</Text>
        {isStaff && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            <Text style={styles.addBtnText}>تسجيل مصروف</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. SCOPE FILTERS & SUMMARY ROW */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterTrigger} onPress={() => setShowScopeFilterPicker(true)}>
          <Text style={styles.filterTriggerText}>
            {scopeFilter === 'ALL' ? 'النطاق' : scopeFilter === 'COMPOUND' ? 'الكومبوند كله' : 'وحدة'}
          </Text>
          <Ionicons name="chevron-down-outline" size={14} color="#64748B" />
        </TouchableOpacity>
        <Text style={styles.summaryLabel}>
          الإجمالي المعروض:{' '}
          <Text style={{ fontWeight: '800', color: '#1E293B' }}>{displayedSum.toLocaleString()} ج.م</Text>
        </Text>
      </View>

      {/* 4. HORIZONTAL SCROLLABLE DATA TABLE */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
        <View style={styles.tableContainer}>
          {/* Table Headers */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>التاريخ</Text>
            <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>النوع</Text>
            <Text style={[styles.thCol, { width: 130, textAlign: 'right' }]}>النطاق</Text>
            <Text style={[styles.thCol, { width: 90, textAlign: 'left' }]}>المبلغ</Text>
            <Text style={[styles.thCol, { width: 180, textAlign: 'right' }]}>ملاحظات</Text>
            {isStaff && <Text style={[styles.thCol, { width: 70, textAlign: 'center' }]}>إجراءات</Text>}
          </View>

          {/* Table Rows */}
          {filteredRows.length === 0 ? (
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>لا توجد أي مصاريف مسجلة</Text>
            </View>
          ) : (
            filteredRows.map((item, idx) => {
              const scopeText = item.scope === 'COMPOUND' ? 'الكومبوند كله' : item.resident?.residentName || 'وحدة';
              return (
                <View key={item.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                  {/* Date */}
                  <Text style={[styles.tdCol, { width: 90, textAlign: 'center' }]}>
                    {new Date(item.expenseDate).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/[/]/g, '-')}
                  </Text>
                  {/* Type */}
                  <Text style={[styles.tdCol, { width: 90, textAlign: 'center', color: '#024C59', fontWeight: '700' }]}>
                    {item.expenseType?.name || 'مصروف'}
                  </Text>
                  {/* Scope / Location */}
                  <Text style={[styles.tdCol, { width: 130, textAlign: 'right' }]} numberOfLines={1}>
                    {scopeText}
                  </Text>
                  {/* Amount */}
                  <Text style={[styles.tdCol, { width: 90, textAlign: 'left', fontWeight: '700' }]}>
                    {item.amount.toLocaleString()} ج.م
                  </Text>
                  {/* Notes */}
                  <Text style={[styles.tdCol, { width: 180, textAlign: 'right', color: '#64748B' }]} numberOfLines={1}>
                    {item.notes || '—'}
                  </Text>
                  {/* Actions (Staff only) */}
                  {isStaff && (
                    <View style={[{ width: 70, flexDirection: 'row-reverse', justifyContent: 'center', gap: 12 }]}>
                      <TouchableOpacity onPress={() => openEdit(item)}>
                        <Ionicons name="pencil-outline" size={16} color="#024C59" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setDeleteTarget(item)}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 5. DELETE EXPENSE CONFIRMATION MODAL POP-UP */}
      <Modal
        visible={!!deleteTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="trash-outline" size={32} color="#EF4444" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>حذف المصروف</Text>
            <Text style={styles.confirmSubtext}>هل أنت متأكد من حذف هذا المصروف؟</Text>
            <Text style={styles.confirmTargetVal}>
              "{deleteTarget?.expenseType?.name || 'مصروف'}"
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

      {/* 6. CREATE / EDIT EXPENSE SHEET MODAL */}
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
              {editingId ? `تعديل المصروف "${selectedType?.name || 'مصروف'}"` : 'تسجيل مصروف جديد'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Pair 1: Scope and Expense Type */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>النطاق</Text>
                <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowFormScopePicker(true)}>
                  <Text style={styles.selectTriggerText}>
                    {form.scope === 'COMPOUND' ? 'الكومبوند كله' : 'وحدة'}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>نوع المصروف</Text>
                <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowFormTypePicker(true)}>
                  <Text style={styles.selectTriggerText}>
                    {selectedType ? selectedType.name : 'اختر النوع...'}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sub-Form Row: Resident Selector (Only if scope is UNIT) */}
            {form.scope === 'UNIT' && (
              <View style={[styles.formRow, { marginBottom: 12 }]}>
                <View style={styles.formCol}>
                  <Text style={styles.fieldLabel}>الساكن / الوحدة</Text>
                  <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowFormResidentPicker(true)}>
                    <Text style={styles.selectTriggerText}>
                      {selectedResident ? `${selectedResident.residentName} (${selectedResident.area}-${selectedResident.buildingNo})` : 'اختر الوحدة...'}
                    </Text>
                    <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Pair 2: Amount and Date */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>المبلغ</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.amount}
                  onChangeText={(v) => setForm({ ...form, amount: v })}
                  keyboardType="numeric"
                  placeholder="500"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>التاريخ</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={form.expenseDate}
                  onChangeText={(v) => setForm({ ...form, expenseDate: v })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Notes */}
            <Text style={styles.fieldLabel}>ملاحظات</Text>
            <TextInput
              style={[styles.fieldInput, { height: 100, textAlignVertical: 'top', paddingVertical: 10 }]}
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              placeholder="اكتب ملاحظات إضافية حول المصروف..."
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
                    {editingId ? 'حفظ التعديلات' : 'انشاء مصروف جديد'}
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

      {/* 7. SCOPE FILTER SELECT PICKER */}
      <Modal
        visible={showScopeFilterPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowScopeFilterPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر النطاق</Text>
            <TouchableOpacity
              style={[styles.pickerItem, scopeFilter === 'ALL' && styles.pickerItemActive]}
              onPress={() => {
                setScopeFilter('ALL');
                setShowScopeFilterPicker(false);
              }}
            >
              <Text style={[styles.pickerItemText, scopeFilter === 'ALL' && styles.pickerItemTextActive]}>الكل</Text>
              {scopeFilter === 'ALL' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerItem, scopeFilter === 'COMPOUND' && styles.pickerItemActive]}
              onPress={() => {
                setScopeFilter('COMPOUND');
                setShowScopeFilterPicker(false);
              }}
            >
              <Text style={[styles.pickerItemText, scopeFilter === 'COMPOUND' && styles.pickerItemTextActive]}>الكومبوند كله</Text>
              {scopeFilter === 'COMPOUND' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerItem, scopeFilter === 'UNIT' && styles.pickerItemActive]}
              onPress={() => {
                setScopeFilter('UNIT');
                setShowScopeFilterPicker(false);
              }}
            >
              <Text style={[styles.pickerItemText, scopeFilter === 'UNIT' && styles.pickerItemTextActive]}>وحدة</Text>
              {scopeFilter === 'UNIT' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowScopeFilterPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 8. FORM SCOPE SELECT PICKER */}
      <Modal
        visible={showFormScopePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFormScopePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر النطاق</Text>
            <TouchableOpacity
              style={[styles.pickerItem, form.scope === 'COMPOUND' && styles.pickerItemActive]}
              onPress={() => {
                setForm({ ...form, scope: 'COMPOUND', residentId: '' });
                setShowFormScopePicker(false);
              }}
            >
              <Text style={[styles.pickerItemText, form.scope === 'COMPOUND' && styles.pickerItemTextActive]}>الكومبوند كله</Text>
              {form.scope === 'COMPOUND' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerItem, form.scope === 'UNIT' && styles.pickerItemActive]}
              onPress={() => {
                setForm({ ...form, scope: 'UNIT' });
                setShowFormScopePicker(false);
              }}
            >
              <Text style={[styles.pickerItemText, form.scope === 'UNIT' && styles.pickerItemTextActive]}>وحدة</Text>
              {form.scope === 'UNIT' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowFormScopePicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 9. FORM EXPENSE TYPE SELECT PICKER */}
      <Modal
        visible={showFormTypePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFormTypePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر نوع المصروف</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {types.filter(t => t.activeFlag === 'Y').map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.pickerItem, form.expenseTypeId === String(t.id) && styles.pickerItemActive]}
                  onPress={() => {
                    setForm({ ...form, expenseTypeId: String(t.id) });
                    setShowFormTypePicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, form.expenseTypeId === String(t.id) && styles.pickerItemTextActive]}>
                    {t.name}
                  </Text>
                  {form.expenseTypeId === String(t.id) && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowFormTypePicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 10. FORM RESIDENT SELECT PICKER */}
      <Modal
        visible={showFormResidentPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFormResidentPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر الساكن / الوحدة</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {residents.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.pickerItem, form.residentId === String(r.id) && styles.pickerItemActive]}
                  onPress={() => {
                    setForm({ ...form, residentId: String(r.id) });
                    setShowFormResidentPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, form.residentId === String(r.id) && styles.pickerItemTextActive]}>
                    {r.residentName} ({r.area}-{r.buildingNo})
                  </Text>
                  {form.residentId === String(r.id) && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowFormResidentPicker(false)}>
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
  filterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  filterTrigger: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 12,
    width: 140,
    justifyContent: 'space-between',
  },
  filterTriggerText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
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
    color: '#EF4444',
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
