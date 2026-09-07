import { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, User } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function RegistrationsScreen() {
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // Stepper fee overrides (in memory before confirmation or quick update)
  const [feesOverride, setFeesOverride] = useState<Record<number, number>>({});

  // Modals state
  const [approveTarget, setApproveTarget] = useState<User | null>(null);
  const [rejectTarget, setRejectTarget] = useState<User | null>(null);

  // Quick edit modal
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editFee, setEditFee] = useState<string>('');

  async function load() {
    try {
      const data = await api.getPendingUsers();
      setUsers(data);
      // Initialize fees map
      const map: Record<number, number> = {};
      data.forEach((u) => {
        map[u.id] = u.resident?.monthlyFees ?? 150;
      });
      setFeesOverride(map);
    } catch (e) {
      if (e instanceof Error && (e.message.includes('Authentication') || e.message.includes('required'))) {
        return;
      }
      console.error(e);
      Alert.alert('خطأ', 'فشل تحميل طلبات التسجيل');
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const getFee = (userId: number, fallback = 150) => {
    return feesOverride[userId] ?? fallback;
  };

  const handleStepFee = (userId: number, delta: number) => {
    const current = getFee(userId);
    const next = Math.max(0, current + delta);
    setFeesOverride((prev) => ({ ...prev, [userId]: next }));
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setLoadingAction(true);
    try {
      const fee = getFee(approveTarget.id, approveTarget.resident?.monthlyFees ?? 150);
      await api.approveUser(approveTarget.id, fee);
      setApproveTarget(null);
      await load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الموافقة');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setLoadingAction(true);
    try {
      await api.rejectUser(rejectTarget.id, 'تم رفض طلب التسجيل');
      setRejectTarget(null);
      await load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الرفض');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const parsedFee = parseFloat(editFee);
    if (isNaN(parsedFee) || parsedFee < 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ صحيح للرسوم الشهرية');
      return;
    }
    setLoadingAction(true);
    try {
      await api.updatePendingRegistration(editTarget.id, { monthlyFees: parsedFee });
      setFeesOverride((prev) => ({ ...prev, [editTarget.id]: parsedFee }));
      setEditTarget(null);
      await load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل حفظ التعديلات');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <Screen
      title="طلبات التسجيل"
      headerShown={false}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      {/* 1. TOP HEADER (Avatar + Greeting + Notification Bell + Back) */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#024C59" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color="#024C59" />
            <View style={styles.badgeDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.profileTextWrap}>
            <Text style={styles.greetText}>مرحباً،</Text>
            <Text style={styles.userName}>{authUser?.name || 'محمد عبد الله'}</Text>
          </View>
          <Ionicons name="person-circle" size={44} color="#024C59" />
        </View>
      </View>

      {/* Dotted Divider */}
      <View style={styles.dottedDivider} />

      {/* 2. SUBHEADER / PAGE TITLE */}
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>طلبات التسجيل</Text>
      </View>

      {/* 3. HORIZONTAL DATA TABLE INSIDE CARD */}
      <View style={styles.cardContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.thCol, { width: 125, textAlign: 'right' }]}>الاسم</Text>
              <Text style={[styles.thCol, { width: 185, textAlign: 'right' }]}>البريد</Text>
              <Text style={[styles.thCol, { width: 70, textAlign: 'center' }]}>النوع</Text>
              <Text style={[styles.thCol, { width: 85, textAlign: 'center' }]}>نوع الوحدة</Text>
              <Text style={[styles.thCol, { width: 125, textAlign: 'center' }]}>الوحدة</Text>
              <Text style={[styles.thCol, { width: 115, textAlign: 'center' }]}>الموبايل</Text>
              <Text style={[styles.thCol, { width: 110, textAlign: 'center' }]}>الرسوم الشهرية</Text>
              <Text style={[styles.thCol, { width: 110, textAlign: 'center' }]}>الإجراءات</Text>
            </View>

            {/* Table Rows */}
            {users.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="documents-outline" size={48} color="#94A3B8" />
                <Text style={styles.emptyText}>لا توجد طلبات قيد المراجعة</Text>
              </View>
            ) : (
              users.map((u, idx) => {
                const resident = u.resident;
                const unitType = resident?.unitType?.name || '—';
                const residentTypeText = resident?.residentType === 'T' ? 'مستأجر' : 'مالك';
                const unitNumber = resident
                  ? `${resident.area || ''}${resident.buildingNo ? '-' + resident.buildingNo : ''} / ${resident.floorNo ?? 0} / ${resident.apartmentNo ?? '1'}`
                  : '—';
                const currentFee = getFee(u.id, resident?.monthlyFees ?? 150);

                return (
                  <View
                    key={u.id}
                    style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                  >
                    {/* Name */}
                    <Text style={[styles.tdCol, { width: 125, textAlign: 'right', fontWeight: '700' }]} numberOfLines={1}>
                      {u.name}
                    </Text>

                    {/* Email */}
                    <Text style={[styles.tdCol, { width: 185, textAlign: 'right', color: '#475569' }]} numberOfLines={1}>
                      {u.email}
                    </Text>

                    {/* Type */}
                    <Text style={[styles.tdCol, { width: 70, textAlign: 'center', color: '#334155' }]}>
                      {residentTypeText}
                    </Text>

                    {/* Unit Type */}
                    <Text style={[styles.tdCol, { width: 85, textAlign: 'center', color: '#334155' }]}>
                      {unitType}
                    </Text>

                    {/* Unit */}
                    <Text style={[styles.tdCol, { width: 125, textAlign: 'center', color: '#334155' }]} numberOfLines={1}>
                      {unitNumber}
                    </Text>

                    {/* Mobile */}
                    <Text style={[styles.tdCol, { width: 115, textAlign: 'center', color: '#334155' }]} numberOfLines={1}>
                      {resident?.mobile || '—'}
                    </Text>

                    {/* Monthly Fees Stepper */}
                    <View style={[styles.tdCell, { width: 110, alignItems: 'center', justifyContent: 'center' }]}>
                      <View style={styles.stepperBox}>
                        <Text style={styles.stepperText}>{currentFee}</Text>
                        <View style={styles.stepperArrows}>
                          <TouchableOpacity
                            onPress={() => handleStepFee(u.id, 50)}
                            hitSlop={{ top: 4, bottom: 2, left: 4, right: 4 }}
                          >
                            <Ionicons name="chevron-up" size={13} color="#64748B" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleStepFee(u.id, -50)}
                            hitSlop={{ top: 2, bottom: 4, left: 4, right: 4 }}
                          >
                            <Ionicons name="chevron-down" size={13} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    {/* Action Buttons (Edit, Approve, Reject) */}
                    <View style={[styles.tdCell, { width: 110, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 10 }]}>
                      {/* Edit Icon Button */}
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => {
                          setEditTarget(u);
                          setEditFee(String(currentFee));
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="pencil-outline" size={20} color="#64748B" />
                      </TouchableOpacity>

                      {/* Approve Icon Button */}
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => setApproveTarget(u)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="checkmark-circle-outline" size={24} color="#64748B" />
                      </TouchableOpacity>

                      {/* Reject Icon Button */}
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => setRejectTarget(u)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close-circle-outline" size={24} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>

      {/* 4. APPROVAL MODAL */}
      <Modal
        visible={approveTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setApproveTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>قبول طلب التسجيل</Text>
            <Text style={styles.dialogMessage}>
              هل أنت متأكد من قبول طلب التسجيل "{approveTarget?.name}"؟
            </Text>

            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => setApproveTarget(null)}
                disabled={loadingAction}
              >
                <Text style={styles.dialogCancelText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogPrimaryBtn}
                onPress={handleApprove}
                disabled={loadingAction}
              >
                <Text style={styles.dialogPrimaryText}>
                  {loadingAction ? 'جاري القبول...' : 'قبول'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. REJECTION MODAL */}
      <Modal
        visible={rejectTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>رفض طلب التسجيل</Text>
            <Text style={styles.dialogMessage}>
              هل أنت متأكد من رفض طلب التسجيل "{rejectTarget?.name}"؟
            </Text>

            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => setRejectTarget(null)}
                disabled={loadingAction}
              >
                <Text style={styles.dialogCancelText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogPrimaryBtn}
                onPress={handleReject}
                disabled={loadingAction}
              >
                <Text style={styles.dialogPrimaryText}>
                  {loadingAction ? 'جاري الرفض...' : 'رفض'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. QUICK EDIT MODAL */}
      <Modal
        visible={editTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>تعديل الرسوم الشهرية</Text>
            <Text style={[styles.dialogMessage, { marginBottom: 14 }]}>
              تحديد قيمة الرسوم الشهرية للعضو "{editTarget?.name}"
            </Text>

            <TextInput
              style={styles.editInput}
              value={editFee}
              onChangeText={setEditFee}
              keyboardType="numeric"
              placeholder="150"
              textAlign="center"
            />

            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => setEditTarget(null)}
                disabled={loadingAction}
              >
                <Text style={styles.dialogCancelText}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dialogPrimaryBtn}
                onPress={handleSaveEdit}
                disabled={loadingAction}
              >
                <Text style={styles.dialogPrimaryText}>
                  {loadingAction ? 'جاري الحفظ...' : 'حفظ'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // 1. Top Header
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBtn: {
    position: 'relative',
    padding: 4,
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileTextWrap: {
    alignItems: 'flex-end',
  },
  greetText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  dottedDivider: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginHorizontal: 16,
    marginVertical: 12,
  },

  // 2. Title
  titleRow: {
    paddingHorizontal: 16,
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },

  // 3. Table Card
  cardContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  scrollContent: {
    minWidth: '100%',
  },
  table: {
    minWidth: 920,
  },
  tableHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#EEF4F8',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thCol: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  tableRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    minHeight: 52,
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  tdCol: {
    fontSize: 13,
    color: '#0F172A',
  },
  tdCell: {
    justifyContent: 'center',
  },

  // Stepper Box
  stepperBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 78,
    backgroundColor: '#FFFFFF',
  },
  stepperText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  stepperArrows: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Action Buttons
  iconActionBtn: {
    padding: 2,
  },

  // Empty State
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  dialogPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#13445C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 18,
  },
});
