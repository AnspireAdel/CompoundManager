import { useCallback, useState } from 'react';
import {
  Alert, Text, TextInput, TouchableOpacity, View, StyleSheet,
  ScrollView, ActivityIndicator, Modal, Pressable, Dimensions, KeyboardAvoidingView, Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Bill, Resident } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const statusLabel: Record<string, string> = {
  ISSUED: 'مستحقة',
  DUE: 'مستحقة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  PARTIAL: 'جزئية',
  PENDING_REVIEW: 'مراجعة الدفع',
};

const statusColor: Record<string, { text: string; bg: string }> = {
  ISSUED: { text: '#F59E0B', bg: '#FEF3C7' },
  DUE: { text: '#F59E0B', bg: '#FEF3C7' },
  PAID: { text: '#024C59', bg: '#E6F4F6' },
  OVERDUE: { text: '#EF4444', bg: '#FEE2E2' },
  PARTIAL: { text: '#3B82F6', bg: '#DBEAFE' },
  PENDING_REVIEW: { text: '#6366F1', bg: '#EEF2FF' },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BillsScreen() {
  const { isStaff, user: authUser } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Issue Monthly Bills Form State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [issuing, setIssuing] = useState(false);

  // Extra Bill Form State
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [showResidentPicker, setShowResidentPicker] = useState(false);
  const [extra, setExtra] = useState({
    residentId: '',
    title: '',
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [creatingExtra, setCreatingExtra] = useState(false);

  // Collect Cash Confirmation State
  const [collectTarget, setCollectTarget] = useState<Bill | null>(null);
  const [collecting, setCollecting] = useState(false);

  // Filters State
  const [filterDate, setFilterDate] = useState('');
  const [showFilterPicker, setShowFilterPicker] = useState(false);

  async function load() {
    try {
      const list = await api.getBills();
      setBills(list);
      if (isStaff) {
        const resList = await api.getResidents();
        setResidents(resList);
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

  async function handleUploadProof(bill: Bill) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      const remaining = bill.amount - bill.paidAmount;
      const uri = file.uri.startsWith('file://') || file.uri.startsWith('content://') ? file.uri : `file://${file.uri}`;
      await api.uploadPaymentProof(bill.id, remaining, {
        uri,
        name: file.name || `proof-${Date.now()}.jpg`,
        mimeType: file.mimeType || undefined,
      });
      Alert.alert('تم بنجاح', 'تم رفع مستند الدفع وهو الآن بانتظار المراجعة من الإدارة المالية.');
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الرفع');
    }
  }

  async function triggerMonthlyIssue() {
    setIssuing(true);
    try {
      const r = await api.issueMonthlyBills(period, dueDate);
      Alert.alert('تم بنجاح', `تم إصدار عدد ${r.issued} فاتورة بنجاح.`);
      setShowIssueModal(false);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل إصدار الفواتير');
    } finally {
      setIssuing(false);
    }
  }

  async function triggerCreateExtra() {
    if (!extra.residentId || !extra.title || !extra.amount) {
      Alert.alert('تنبيه', 'برجاء تعبئة كافة الحقول المطلوبة');
      return;
    }
    setCreatingExtra(true);
    try {
      await api.createExtraBill({
        residentId: Number(extra.residentId),
        title: extra.title.trim(),
        amount: Number(extra.amount),
        dueDate: extra.dueDate,
      });
      Alert.alert('تم بنجاح', 'تم إنشاء الفاتورة الإضافية وإخطار الساكن.');
      setShowExtraModal(false);
      setExtra({ residentId: '', title: '', amount: '', dueDate: new Date().toISOString().slice(0, 10), notes: '' });
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل إنشاء الفاتورة');
    } finally {
      setCreatingExtra(false);
    }
  }

  async function triggerCashCollection() {
    if (!collectTarget) return;
    setCollecting(true);
    try {
      const remaining = collectTarget.amount - collectTarget.paidAmount;
      await api.payBill(collectTarget.id, remaining);
      Alert.alert('تم بنجاح', 'تم تحصيل المبلغ نقداً وإغلاق الفاتورة.');
      setCollectTarget(null);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل عملية التحصيل');
    } finally {
      setCollecting(false);
    }
  }

  // Filter bills in memory based on selected due date (YYYY-MM-DD)
  const filteredBills = filterDate
    ? bills.filter((b) => b.dueDate.startsWith(filterDate))
    : bills;

  const selectedResident = residents.find((r) => String(r.id) === extra.residentId);

  // Compile unique months/dates for filter picker from bills
  const uniqueDueDates = Array.from(new Set(bills.map((b) => b.dueDate.slice(0, 10)))).sort((a, b) => b.localeCompare(a));

  return (
    <Screen
      title="الفواتير"
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
        <Text style={styles.pageTitle}>الفواتير</Text>
        {isStaff && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtnSolid} onPress={() => setShowExtraModal(true)}>
              <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
              <Text style={styles.actionBtnSolidText}>فاتورة إضافية</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnOutline} onPress={() => setShowIssueModal(true)}>
              <Text style={styles.actionBtnOutlineText}>اصدار فاتورة شهرية</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3. DATE FILTER */}
      <View style={styles.filterSection}>
        <TouchableOpacity style={styles.filterTrigger} onPress={() => setShowFilterPicker(true)}>
          <Ionicons name="calendar-outline" size={18} color="#64748B" style={{ marginLeft: 8 }} />
          <Text style={styles.filterTriggerText}>
            {filterDate ? filterDate : 'فلترة حسب تاريخ الاستحقاق...'}
          </Text>
          {filterDate ? (
            <TouchableOpacity onPress={() => setFilterDate('')} style={{ paddingHorizontal: 6 }}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-down-outline" size={14} color="#64748B" />
          )}
        </TouchableOpacity>
      </View>

      {/* 4. DATA TABLE */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
        <View style={styles.tableContainer}>
          {/* Table Headers */}
          <View style={styles.tableHeader}>
            {isStaff && <Text style={[styles.thCol, { width: 140, textAlign: 'right' }]}>الساكن</Text>}
            {isStaff && <Text style={[styles.thCol, { width: 120, textAlign: 'right' }]}>الوحدة</Text>}
            {isStaff && <Text style={[styles.thCol, { width: 95, textAlign: 'center' }]}>الموبايل</Text>}
            <Text style={[styles.thCol, { width: 65, textAlign: 'center' }]}>النوع</Text>
            <Text style={[styles.thCol, { width: 75, textAlign: 'center' }]}>الفاتورة</Text>
            <Text style={[styles.thCol, { width: 80, textAlign: 'left' }]}>المبلغ</Text>
            <Text style={[styles.thCol, { width: 80, textAlign: 'left' }]}>المدفوع</Text>
            <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>الاستحقاق</Text>
            <Text style={[styles.thCol, { width: 80, textAlign: 'center' }]}>الحالة</Text>
            <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>تحصيل</Text>
          </View>

          {/* Table Rows */}
          {filteredBills.length === 0 ? (
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>لا توجد أي فواتير مسجلة</Text>
            </View>
          ) : (
            filteredBills.map((item, idx) => {
              const theme = statusColor[item.status] || { text: '#475569', bg: '#F1F5F9' };
              const unitDetails = item.resident
                ? `${item.resident.area}-${item.resident.buildingNo}${item.resident.floorNo ? ` / دور ${item.resident.floorNo}` : ''}${item.resident.apartmentNo ? ` / شقة ${item.resident.apartmentNo}` : ''}`
                : '—';
              
              const isPaid = item.status === 'PAID';
              const isPending = item.status === 'PENDING_REVIEW';
              const remaining = item.amount - item.paidAmount;

              return (
                <View key={item.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                  {/* Resident Name (Staff only) */}
                  {isStaff && (
                    <Text style={[styles.tdCol, { width: 140, textAlign: 'right', fontWeight: '700' }]} numberOfLines={1}>
                      {item.resident?.residentName || '—'}
                    </Text>
                  )}
                  {/* Unit details (Staff only) */}
                  {isStaff && (
                    <Text style={[styles.tdCol, { width: 120, textAlign: 'right' }]} numberOfLines={1}>
                      {unitDetails}
                    </Text>
                  )}
                  {/* Mobile (Staff only) */}
                  {isStaff && (
                    <Text style={[styles.tdCol, { width: 95, textAlign: 'center' }]}>
                      {item.resident?.mobile || '—'}
                    </Text>
                  )}
                  {/* Type */}
                  <View style={[{ width: 65, alignItems: 'center' }]}>
                    <View style={[styles.typeBadge, { borderColor: item.billType === 'EXTRA' ? '#8B5CF6' : '#024C59' }]}>
                      <Text style={[styles.typeBadgeText, { color: item.billType === 'EXTRA' ? '#8B5CF6' : '#024C59' }]}>
                        {item.billType === 'EXTRA' ? 'إضافية' : 'شهرية'}
                      </Text>
                    </View>
                  </View>
                  {/* Bill title / Period */}
                  <Text style={[styles.tdCol, { width: 75, textAlign: 'center' }]} numberOfLines={1}>
                    {item.billType === 'EXTRA' ? (item.title || 'إضافية') : item.period}
                  </Text>
                  {/* Amount */}
                  <Text style={[styles.tdCol, { width: 80, textAlign: 'left', fontWeight: '600' }]}>
                    {item.amount} ج.م
                  </Text>
                  {/* Paid */}
                  <Text style={[styles.tdCol, { width: 80, textAlign: 'left', color: '#10B981', fontWeight: '600' }]}>
                    {item.paidAmount} ج.م
                  </Text>
                  {/* Due Date */}
                  <Text style={[styles.tdCol, { width: 90, textAlign: 'center' }]}>
                    {new Date(item.dueDate).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/[/]/g, '-')}
                  </Text>
                  {/* Status Badge */}
                  <View style={[{ width: 80, alignItems: 'center' }]}>
                    <View style={[styles.statusBadge, { backgroundColor: theme.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: theme.text }]}>
                        {statusLabel[item.status] || item.status}
                      </Text>
                    </View>
                  </View>
                  {/* Collect / Upload Payment proof Actions */}
                  <View style={[{ width: 90, alignItems: 'center' }]}>
                    {!isPaid && !isPending && isStaff && (
                      <TouchableOpacity onPress={() => setCollectTarget(item)}>
                        <Text style={styles.collectActionText}>تحصيل نقدي</Text>
                      </TouchableOpacity>
                    )}
                    {!isPaid && !isPending && !isStaff && (
                      <TouchableOpacity onPress={() => handleUploadProof(item)}>
                        <Text style={styles.uploadActionText}>رفع إثبات</Text>
                      </TouchableOpacity>
                    )}
                    {(isPaid || isPending) && (
                      <Text style={styles.completedText}>—</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 5. COLLECT CASH CONFIRMATION MODAL POP-UP */}
      <Modal
        visible={!!collectTarget}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCollectTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="cash-outline" size={32} color="#024C59" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>تحصيل نقدي</Text>
            <Text style={styles.confirmSubtext}>أنت على وشك تحصيل القيمة المتبقية نقداً:</Text>
            <Text style={styles.confirmTargetVal}>
              {(collectTarget ? collectTarget.amount - collectTarget.paidAmount : 0).toLocaleString()} ج.م
            </Text>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnYes]}
                onPress={triggerCashCollection}
                disabled={collecting}
              >
                {collecting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.confirmBtnText}>تحصيل</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnNo]}
                onPress={() => setCollectTarget(null)}
              >
                <Text style={styles.confirmBtnTextNo}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. ISSUE MONTHLY BILLS MODAL POP-UP */}
      <Modal
        visible={showIssueModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowIssueModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>إصدار الفواتير الشهرية</Text>
            
            <Text style={styles.fieldLabel}>الفترة (السنة-الشهر)</Text>
            <TextInput
              style={styles.fieldInput}
              value={period}
              onChangeText={setPeriod}
              placeholder="YYYY-MM"
              placeholderTextColor="#94A3B8"
            />
            
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>تاريخ الاستحقاق</Text>
            <TextInput
              style={styles.fieldInput}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
            />

            <View style={[styles.confirmActions, { marginTop: 20 }]}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnYes, { flex: 1.5 }]}
                onPress={triggerMonthlyIssue}
                disabled={issuing}
              >
                {issuing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>إصدار الفواتير</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnNo]}
                onPress={() => setShowIssueModal(false)}
              >
                <Text style={styles.confirmBtnTextNo}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. CREATE EXTRA BILL SHEET MODAL */}
      <Modal
        visible={showExtraModal}
        animationType="slide"
        onRequestClose={() => setShowExtraModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setShowExtraModal(false)}>
              <Ionicons name="chevron-forward-outline" size={24} color="#024C59" />
            </TouchableOpacity>
            <Text style={styles.formHeaderTitle}>إضافة فاتورة إضافية (مرة واحدة)</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Pair 1: Resident dropdown select and Bill Title */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>المالك / الوحدة</Text>
                <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowResidentPicker(true)}>
                  <Text style={styles.selectTriggerText}>
                    {selectedResident ? selectedResident.residentName : 'اختر الساكن...'}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>عنوان الفاتورة</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={extra.title}
                  onChangeText={(v) => setExtra({ ...extra, title: v })}
                  placeholder="صيانة مصعد، إصلاح مضخة..."
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Pair 2: Amount and Due Date */}
            <View style={styles.formRow}>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>المبلغ</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={extra.amount}
                  onChangeText={(v) => setExtra({ ...extra, amount: v })}
                  keyboardType="numeric"
                  placeholder="500"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.formCol}>
                <Text style={styles.fieldLabel}>تاريخ الاستحقاق</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={extra.dueDate}
                  onChangeText={(v) => setExtra({ ...extra, dueDate: v })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Notes */}
            <Text style={styles.fieldLabel}>ملاحظات</Text>
            <TextInput
              style={[styles.fieldInput, { height: 100, textAlignVertical: 'top', paddingVertical: 10 }]}
              value={extra.notes}
              onChangeText={(v) => setExtra({ ...extra, notes: v })}
              placeholder="اكتب تفاصيل أو أسباب الفاتورة الإضافية..."
              placeholderTextColor="#94A3B8"
              multiline={true}
            />

            {/* Action buttons */}
            <View style={styles.formActionsRow}>
              <TouchableOpacity style={styles.submitBtn} onPress={triggerCreateExtra} disabled={creatingExtra}>
                {creatingExtra ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>انشاء الفاتورة</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowExtraModal(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* 8. RESIDENT PICKER MODAL POP-UP */}
      <Modal
        visible={showResidentPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResidentPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر الساكن</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {residents.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.pickerItem, extra.residentId === String(r.id) && styles.pickerItemActive]}
                  onPress={() => {
                    setExtra({ ...extra, residentId: String(r.id) });
                    setShowResidentPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, extra.residentId === String(r.id) && styles.pickerItemTextActive]}>
                    {r.residentName} ({r.area}-{r.buildingNo})
                  </Text>
                  {extra.residentId === String(r.id) && (
                    <Ionicons name="checkmark-sharp" size={16} color="#024C59" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowResidentPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 9. DATE FILTER PICKER MODAL POP-UP */}
      <Modal
        visible={showFilterPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFilterPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>تاريخ الاستحقاق</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {uniqueDueDates.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pickerItem, filterDate === d && styles.pickerItemActive]}
                  onPress={() => {
                    setFilterDate(d);
                    setShowFilterPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, filterDate === d && styles.pickerItemTextActive]}>
                    {d}
                  </Text>
                  {filterDate === d && (
                    <Ionicons name="checkmark-sharp" size={16} color="#024C59" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowFilterPicker(false)}>
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
  actionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnSolid: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#024C59',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  actionBtnSolidText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionBtnOutline: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  actionBtnOutlineText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  filterSection: {
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
    justifyContent: 'space-between',
  },
  filterTriggerText: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
    textAlign: 'right',
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
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
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
  collectActionText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
  },
  uploadActionText: {
    fontSize: 12,
    color: '#024C59',
    fontWeight: '700',
  },
  completedText: {
    fontSize: 12,
    color: '#94A3B8',
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
    fontSize: 20,
    fontWeight: '800',
    color: '#024C59',
    marginTop: 10,
    marginBottom: 24,
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

