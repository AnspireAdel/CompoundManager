import { useCallback, useMemo, useState } from 'react';
import {
  Alert, Text, TextInput, TouchableOpacity, View, StyleSheet,
  ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ContactRequest } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const categoryLabel: Record<string, string> = {
  REQUEST: 'طلب',
  INQUIRY: 'استفسار',
  COMPLAINT: 'شكوى',
};

const statusLabel: Record<string, string> = {
  PENDING: 'جديد',
  IN_PROGRESS: 'قيد المعالجة',
  RESOLVED: 'تم الحل',
  CLOSED: 'مغلق',
};

const statusColor: Record<string, { text: string; bg: string }> = {
  PENDING: { text: '#F59E0B', bg: '#FEF3C7' },
  IN_PROGRESS: { text: '#2563EB', bg: '#DBEAFE' },
  RESOLVED: { text: '#10B981', bg: '#D1FAE5' },
  CLOSED: { text: '#64748B', bg: '#F1F5F9' },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const emptyForm = {
  category: 'INQUIRY',
  subject: '',
  message: '',
};

export default function ContactScreen() {
  const { isStaff, user: authUser } = useAuth();
  const [items, setItems] = useState<ContactRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showStatusFilterPicker, setShowStatusFilterPicker] = useState(false);
  const [showCategoryFilterPicker, setShowCategoryFilterPicker] = useState(false);

  // Resident Form Modal (Contact Us)
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);

  // Staff Form Modal (Edit/Reply Request)
  const [editTarget, setEditTarget] = useState<ContactRequest | null>(null);
  const [editStatus, setEditStatus] = useState('PENDING');
  const [staffReply, setStaffReply] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  async function load() {
    try {
      const list = await api.getContactRequests();
      setItems(list);
    } catch (e) {
      console.error(e);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function submitRequest() {
    if (!form.subject.trim() || !form.message.trim()) {
      Alert.alert('تنبيه', 'برجاء تعبئة كافة الحقول المطلوبة');
      return;
    }
    setSubmitting(true);
    try {
      await api.createContactRequest({
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      Alert.alert('تم بنجاح', 'تم إرسال الطلب/الشكوى بنجاح إلى الإدارة.');
      setForm({ ...emptyForm });
      setShowAddModal(false);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(item: ContactRequest) {
    setEditTarget(item);
    setEditStatus(item.status);
    setStaffReply(item.staffResponse || '');
  }

  async function saveEdit() {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await api.updateContactRequest(editTarget.id, {
        status: editStatus,
        staffResponse: staffReply.trim() || undefined,
      });
      Alert.alert('تم بنجاح', 'تم تحديث حالة الطلب والرد بنجاح.');
      setEditTarget(null);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل تحديث الطلب');
    } finally {
      setSavingEdit(false);
    }
  }

  // Filter items in memory
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      return true;
    });
  }, [items, statusFilter, categoryFilter]);

  return (
    <Screen
      title={isStaff ? 'الطلبات والشكاوى' : 'تواصل معنا'}
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
        <Text style={styles.pageTitle}>
          {isStaff ? 'الطلبات والشكاوى' : 'تواصل معنا'}
        </Text>
        {!isStaff && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            <Text style={styles.addBtnText}>تواصل معنا</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. FILTER DROPDOWNS ROW */}
      <View style={styles.filtersRow}>
        <TouchableOpacity style={styles.filterTrigger} onPress={() => setShowStatusFilterPicker(true)}>
          <Text style={styles.filterTriggerText}>
            {statusFilter === 'ALL' ? 'الحالة' : statusLabel[statusFilter] || statusFilter}
          </Text>
          <Ionicons name="chevron-down-outline" size={14} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.filterTrigger} onPress={() => setShowCategoryFilterPicker(true)}>
          <Text style={styles.filterTriggerText}>
            {categoryFilter === 'ALL' ? 'النوع' : categoryLabel[categoryFilter] || categoryFilter}
          </Text>
          <Ionicons name="chevron-down-outline" size={14} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* 4. HORIZONTAL DATA TABLE */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
        <View style={styles.tableContainer}>
          {/* Table Headers */}
          <View style={styles.tableHeader}>
            {isStaff && <Text style={[styles.thCol, { width: 140, textAlign: 'right' }]}>المالك</Text>}
            <Text style={[styles.thCol, { width: 70, textAlign: 'center' }]}>النوع</Text>
            <Text style={[styles.thCol, { width: 220, textAlign: 'right' }]}>الموضوع</Text>
            <Text style={[styles.thCol, { width: 110, textAlign: 'center' }]}>التاريخ</Text>
            <Text style={[styles.thCol, { width: 95, textAlign: 'center' }]}>الحالة</Text>
            <Text style={[styles.thCol, { width: 180, textAlign: 'right' }]}>الرد</Text>
            {isStaff && <Text style={[styles.thCol, { width: 50, textAlign: 'center' }]}>تعديل</Text>}
          </View>

          {/* Table Rows */}
          {filteredItems.length === 0 ? (
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>لا توجد أي طلبات أو شكاوى مسجلة</Text>
            </View>
          ) : (
            filteredItems.map((item, idx) => {
              const theme = statusColor[item.status] || { text: '#475569', bg: '#F1F5F9' };
              const dateObj = new Date(item.createdAt);
              const dateStr = dateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/[/]/g, '-');
              const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

              return (
                <View key={item.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                  {/* Owner (Staff only) */}
                  {isStaff && (
                    <View style={[{ width: 140, alignItems: 'flex-end' }]}>
                      <Text style={[styles.tdCol, { fontWeight: '700', textAlign: 'right' }]} numberOfLines={1}>
                        {item.resident?.residentName || '—'}
                      </Text>
                      {item.resident && (
                        <Text style={styles.metaSubtext} numberOfLines={1}>
                          {item.resident.area}-{item.resident.buildingNo}
                        </Text>
                      )}
                    </View>
                  )}
                  {/* Type */}
                  <Text style={[styles.tdCol, { width: 70, textAlign: 'center', fontWeight: '600', color: '#024C59' }]}>
                    {categoryLabel[item.category] || item.category}
                  </Text>
                  {/* Subject & Message details */}
                  <View style={[{ width: 220, alignItems: 'flex-end' }]}>
                    <Text style={[styles.tdCol, { fontWeight: '600', textAlign: 'right' }]} numberOfLines={1}>
                      {item.subject}
                    </Text>
                    <Text style={styles.metaSubtext} numberOfLines={1}>
                      {item.message}
                    </Text>
                  </View>
                  {/* Date & Time */}
                  <View style={[{ width: 110, alignItems: 'center' }]}>
                    <Text style={[styles.tdCol, { fontSize: 11 }]}>{dateStr}</Text>
                    <Text style={[styles.metaSubtext, { fontSize: 10 }]}>{timeStr}</Text>
                  </View>
                  {/* Status Badge */}
                  <View style={[{ width: 95, alignItems: 'center' }]}>
                    <View style={[styles.statusBadge, { backgroundColor: theme.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: theme.text }]}>
                        {statusLabel[item.status] || item.status}
                      </Text>
                    </View>
                  </View>
                  {/* Reply Response */}
                  <Text style={[styles.tdCol, { width: 180, textAlign: 'right', color: '#10B981' }]} numberOfLines={1}>
                    {item.staffResponse || '—'}
                  </Text>
                  {/* Action Edit (Staff only) */}
                  {isStaff && (
                    <TouchableOpacity style={[{ width: 50, alignItems: 'center' }]} onPress={() => openEdit(item)}>
                      <Ionicons name="pencil-outline" size={16} color="#024C59" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 5. RESIDENT ADD SUPPORT FORM SHEET MODAL */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="chevron-forward-outline" size={24} color="#024C59" />
            </TouchableOpacity>
            <Text style={styles.formHeaderTitle}>تواصل معنا</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Category selection chips */}
            <Text style={styles.fieldLabel}>النوع</Text>
            <View style={styles.chipsRow}>
              {Object.entries(categoryLabel).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chipItem, form.category === value && styles.chipItemActive]}
                  onPress={() => setForm({ ...form, category: value })}
                >
                  <Text style={[styles.chipItemText, form.category === value && styles.chipItemTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subject Input */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>الموضوع</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.subject}
              onChangeText={(v) => setForm({ ...form, subject: v })}
              placeholder="اكتب عنوان الموضوع باختصار..."
              placeholderTextColor="#94A3B8"
            />

            {/* Message Input */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>التفاصيل</Text>
            <TextInput
              style={[styles.fieldInput, { height: 120, textAlignVertical: 'top', paddingVertical: 10 }]}
              value={form.message}
              onChangeText={(v) => setForm({ ...form, message: v })}
              placeholder="اكتب هنا كافة تفاصيل الطلب أو الشكوى..."
              placeholderTextColor="#94A3B8"
              multiline={true}
            />

            {/* Action buttons */}
            <View style={styles.formActionsRow}>
              <TouchableOpacity style={styles.submitBtn} onPress={submitRequest} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>إرسال الطلب</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* 6. STAFF EDIT SUPPORT SHEET MODAL */}
      <Modal
        visible={!!editTarget}
        animationType="slide"
        onRequestClose={() => setEditTarget(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setEditTarget(null)}>
              <Ionicons name="chevron-forward-outline" size={24} color="#024C59" />
            </TouchableOpacity>
            <Text style={styles.formHeaderTitle}>التعديل على الشكوى أو الطلب</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Status Dropdown Picker */}
            <Text style={styles.fieldLabel}>الحالة</Text>
            <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowStatusPicker(true)}>
              <Text style={styles.selectTriggerText}>
                {statusLabel[editStatus] || editStatus}
              </Text>
              <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
            </TouchableOpacity>

            {/* Reply Input */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>الرد / الملاحظات</Text>
            <TextInput
              style={[styles.fieldInput, { height: 120, textAlignVertical: 'top', paddingVertical: 10 }]}
              value={staffReply}
              onChangeText={setStaffReply}
              placeholder="اكتب هنا رد الإدارة أو الملاحظات الداخلية..."
              placeholderTextColor="#94A3B8"
              multiline={true}
            />

            {/* Action buttons */}
            <View style={styles.formActionsRow}>
              <TouchableOpacity style={styles.submitBtn} onPress={saveEdit} disabled={savingEdit}>
                {savingEdit ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>حفظ</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditTarget(null)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* 7. STATUS FILTER SELECT PICKER */}
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
            {Object.entries(statusLabel).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.pickerItem, statusFilter === value && styles.pickerItemActive]}
                onPress={() => {
                  setStatusFilter(value);
                  setShowStatusFilterPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, statusFilter === value && styles.pickerItemTextActive]}>
                  {label}
                </Text>
                {statusFilter === value && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowStatusFilterPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 8. CATEGORY FILTER SELECT PICKER */}
      <Modal
        visible={showCategoryFilterPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCategoryFilterPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر النوع</Text>
            <TouchableOpacity
              style={[styles.pickerItem, categoryFilter === 'ALL' && styles.pickerItemActive]}
              onPress={() => {
                setCategoryFilter('ALL');
                setShowCategoryFilterPicker(false);
              }}
            >
              <Text style={[styles.pickerItemText, categoryFilter === 'ALL' && styles.pickerItemTextActive]}>الكل</Text>
              {categoryFilter === 'ALL' && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
            </TouchableOpacity>
            {Object.entries(categoryLabel).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.pickerItem, categoryFilter === value && styles.pickerItemActive]}
                onPress={() => {
                  setCategoryFilter(value);
                  setShowCategoryFilterPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, categoryFilter === value && styles.pickerItemTextActive]}>
                  {label}
                </Text>
                {categoryFilter === value && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowCategoryFilterPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 9. STAFF STATUS EDIT PICKER */}
      <Modal
        visible={showStatusPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>تعديل الحالة</Text>
            {Object.entries(statusLabel).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.pickerItem, editStatus === value && styles.pickerItemActive]}
                onPress={() => {
                  setEditStatus(value);
                  setShowStatusPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, editStatus === value && styles.pickerItemTextActive]}>
                  {label}
                </Text>
                {editStatus === value && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowStatusPicker(false)}>
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
  filtersRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
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
  metaSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  chipItem: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipItemActive: {
    borderColor: '#024C59',
    backgroundColor: '#E6F4F6',
  },
  chipItemText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  chipItemTextActive: {
    color: '#024C59',
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
    marginTop: 24,
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
});
