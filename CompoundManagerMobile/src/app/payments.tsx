import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { api, PaymentProof, resolveUploadUrl } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const statusLabel: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

// SVG Empty State Vector Illustration (Matches Figma 1:1)
function EmptyPaymentsIllustration() {
  return (
    <View style={styles.emptyIllustrationWrap}>
      <Svg width={220} height={200} viewBox="0 0 220 200">
        {/* Base ground line */}
        <Line x1="20" y1="180" x2="200" y2="180" stroke="#CBD5E1" strokeWidth="1.5" />

        {/* Shelf on top right */}
        <Line x1="120" y1="65" x2="175" y2="65" stroke="#CBD5E1" strokeWidth="2" />
        <Line x1="128" y1="65" x2="128" y2="72" stroke="#CBD5E1" strokeWidth="1.5" />
        <Line x1="168" y1="65" x2="168" y2="72" stroke="#CBD5E1" strokeWidth="1.5" />
        {/* Shelf books/items */}
        <Rect x="133" y="52" width="10" height="13" fill="#E2E8F0" />
        <Rect x="146" y="49" width="11" height="16" fill="#E2E8F0" />
        <Rect x="160" y="44" width="7" height="21" fill="#E2E8F0" />

        {/* Curly spring wire rising from box */}
        <Path
          d="M 100 85 Q 78 70 95 52 Q 115 35 98 22 Q 88 14 104 8"
          stroke="#94A3B8"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Light box behind plant */}
        <Rect x="140" y="130" width="45" height="50" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1" />

        {/* Plant pot and leaves */}
        <Path d="M 172 155 L 186 155 L 184 172 L 174 172 Z" fill="#2E4C6D" />
        <Path d="M 179 155 Q 174 135 166 122 Q 176 135 179 155" fill="#0D3B66" />
        <Path d="M 179 150 Q 188 138 194 130 Q 186 142 179 150" fill="#0D3B66" />
        <Path d="M 179 142 Q 184 128 189 122 Q 183 132 179 142" fill="#0D3B66" />
        <Path d="M 179 135 Q 175 125 170 118 Q 175 128 179 135" fill="#0D3B66" />

        {/* Bottom dark box */}
        <Rect x="50" y="115" width="75" height="65" fill="#0E2B52" />
        <Rect x="73" y="115" width="9" height="65" fill="#091E3B" opacity="0.35" />
        <Rect x="108" y="160" width="6" height="6" fill="#FFFFFF" />

        {/* Top open blue box */}
        <Rect x="58" y="80" width="66" height="38" fill="#134785" />
        {/* Left open lid flap */}
        <Path d="M 58 80 L 44 68 L 56 68 Z" fill="#0E3360" />
        {/* Right open lid flap */}
        <Path d="M 124 80 L 138 68 L 126 68 Z" fill="#0E3360" />
        {/* Top box lid rim */}
        <Rect x="54" y="76" width="74" height="6" fill="#0A274C" />

        {/* Sad face on top box */}
        <Circle cx="78" cy="95" r="1.8" fill="#081A33" />
        <Circle cx="94" cy="95" r="1.8" fill="#081A33" />
        <Path d="M 80 105 Q 86 99 92 105" stroke="#081A33" strokeWidth="1.8" fill="none" />
        {/* White label on top box */}
        <Rect x="110" y="103" width="6" height="6" fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

export default function PaymentsScreen() {
  const { user: authUser } = useAuth();
  const tableScrollRef = useRef<ScrollView>(null);
  const hasScrolledToEnd = useRef(false);
  const router = useRouter();

  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // Modals state
  const [approveTarget, setApproveTarget] = useState<PaymentProof | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PaymentProof | null>(null);

  // Preview modal state
  const [previewTarget, setPreviewTarget] = useState<PaymentProof | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  async function load() {
    try {
      const list = await api.getPayments({ status: 'PENDING' });
      setProofs(list);
    } catch (e) {
      if (e instanceof Error && (e.message.includes('Authentication') || e.message.includes('required'))) {
        return;
      }
      console.error(e);
      Alert.alert('خطأ', 'فشل تحميل مستندات الدفع');
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const handleOpenPreview = async (p: PaymentProof) => {
    setPreviewTarget(p);
    try {
      const url = await resolveUploadUrl(p.filePath);
      setPreviewUrl(url || p.filePath || '');
    } catch {
      setPreviewUrl(p.filePath || '');
    }
  };

  const handleDownloadFile = async () => {
    const targetUrl = previewUrl || (previewTarget?.filePath ? await resolveUploadUrl(previewTarget.filePath) : '');
    if (targetUrl) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(targetUrl, '_blank');
      } else {
        Linking.openURL(targetUrl).catch(() => {
          Alert.alert('خطأ', 'تعذر فتح أو تحميل الرابط');
        });
      }
    } else {
      Alert.alert('تنبيه', 'رابط الملف غير متاح');
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setLoadingAction(true);
    try {
      await api.approvePayment(approveTarget.id);
      setApproveTarget(null);
      await load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل اعتماد المستند');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setLoadingAction(true);
    try {
      await api.rejectPayment(rejectTarget.id, 'المستند غير صالح');
      setRejectTarget(null);
      await load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل رفض المستند');
    } finally {
      setLoadingAction(false);
    }
  };

  const isImageFile = (fileName?: string) => {
    if (!fileName) return false;
    const ext = fileName.toLowerCase().split('?')[0];
    return ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.webp') || ext.endsWith('.gif');
  };

  const isPdfFile = (fileName?: string) => {
    if (!fileName) return false;
    const ext = fileName.toLowerCase().split('?')[0];
    return ext.endsWith('.pdf');
  };

  return (
    <Screen
      title="مستندات الدفع"
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
        <Text style={styles.pageTitle}>مستندات الدفع</Text>
      </View>

      {/* 3. BODY: EMPTY STATE OR DATA TABLE */}
      {proofs.length === 0 ? (
        <View style={styles.emptyScreenContainer}>
          <Text style={styles.emptyScreenTitle}>لا توجد مستندات بانتظار المراجعة</Text>
          <EmptyPaymentsIllustration />
        </View>
      ) : (
        <View style={styles.cardContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={styles.scrollContent}
            ref={tableScrollRef}
            onContentSizeChange={() => {
              if (!hasScrolledToEnd.current) {
                hasScrolledToEnd.current = true;
                tableScrollRef.current?.scrollToEnd({ animated: false });
              }
            }}
          >
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.thCol, { width: 140, textAlign: 'right' }]}>الساكن</Text>
                <Text style={[styles.thCol, { width: 150, textAlign: 'center' }]}>الفاتورة</Text>
                <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>المبلغ</Text>
                <Text style={[styles.thCol, { width: 200, textAlign: 'center' }]}>الملف</Text>
                <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>الحالة</Text>
                <Text style={[styles.thCol, { width: 100, textAlign: 'center' }]}>الإجراءات</Text>
              </View>

              {/* Table Rows */}
              {proofs.map((p, idx) => {
                const residentName = p.resident?.residentName || (p as any).user?.name || '—';
                const billPeriod = p.bill?.period || `EXTRA-${p.billId}` || p.billId;
                const fileName = p.fileName || 'المستند.pdf';
                const statusText = statusLabel[p.status] || p.status;

                return (
                  <View
                    key={p.id}
                    style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                  >
                    {/* Resident */}
                    <Text style={[styles.tdCol, { width: 140, textAlign: 'right', fontWeight: '700' }]} numberOfLines={1}>
                      {residentName}
                    </Text>

                    {/* Bill */}
                    <Text style={[styles.tdCol, { width: 150, textAlign: 'center', color: '#475569' }]} numberOfLines={1}>
                      {billPeriod}
                    </Text>

                    {/* Amount */}
                    <Text style={[styles.tdCol, { width: 100, textAlign: 'center', fontWeight: '700', color: '#1E293B' }]}>
                      {p.amount.toLocaleString()} ج.م
                    </Text>

                    {/* File Link (Clickable Blue) */}
                    <TouchableOpacity
                      style={[styles.tdCell, { width: 200, alignItems: 'center', justifyContent: 'center' }]}
                      onPress={() => handleOpenPreview(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.fileLinkText} numberOfLines={1}>
                        {fileName}
                      </Text>
                    </TouchableOpacity>

                    {/* Status Badge Text */}
                    <View style={[styles.tdCell, { width: 100, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={styles.statusText}>{statusText}</Text>
                    </View>

                    {/* Action Buttons (Approve, Reject) */}
                    <View style={[styles.tdCell, { width: 100, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 12 }]}>
                      {/* Approve Icon Button */}
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => setApproveTarget(p)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="checkmark-circle-outline" size={24} color="#64748B" />
                      </TouchableOpacity>

                      {/* Reject Icon Button */}
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => setRejectTarget(p)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close-circle-outline" size={24} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {/* 4. FILE PREVIEW MODAL / SHEET */}
      <Modal
        visible={previewTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewTarget(null)}
      >
        <View style={styles.sheetOverlay}>
          {/* Dismiss backdrop on press */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewTarget(null)} />

          <View style={styles.sheetCard}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Header with Title and Close Button */}
            <View style={styles.sheetHeaderRow}>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setPreviewTarget(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {previewTarget?.fileName || 'Haddaj Privacy Policy.pdf'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Receipt Summary Banner */}
            <View style={styles.metaPillContainer}>
              <View style={styles.metaPillItem}>
                <Text style={styles.metaPillLabel}>المبلغ</Text>
                <Text style={[styles.metaPillValue, { color: '#024C59' }]}>
                  {previewTarget?.amount.toLocaleString()} ج.م
                </Text>
              </View>
              <View style={styles.metaPillItem}>
                <Text style={styles.metaPillLabel}>الساكن</Text>
                <Text style={styles.metaPillValue}>
                  {previewTarget?.resident?.residentName || (previewTarget as any)?.user?.name || '—'}
                </Text>
              </View>
              <View style={styles.metaPillItem}>
                <Text style={styles.metaPillLabel}>الفاتورة</Text>
                <Text style={styles.metaPillValue}>
                  {previewTarget?.bill?.period || `EXTRA-${previewTarget?.billId}` || '—'}
                </Text>
              </View>
            </View>

            {/* Real File Preview Area */}
            <View style={styles.sheetMediaWrap}>
              {isImageFile(previewTarget?.fileName) && previewUrl ? (
                <ScrollView
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Image
                    source={{ uri: previewUrl }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </ScrollView>
              ) : isPdfFile(previewTarget?.fileName) && previewUrl ? (
                Platform.OS === 'web' ? (
                  // On Web: native iframe viewer
                  <iframe
                    src={previewUrl}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                    }}
                    title="معاينة إيصال الدفع"
                  />
                ) : (
                  // On Native: WebView with Google Docs Viewer for Android and native PDF on iOS
                  <WebView
                    source={{
                      uri:
                        Platform.OS === 'android' && !previewUrl.startsWith('file://') && !previewUrl.startsWith('http://localhost')
                          ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(previewUrl)}`
                          : previewUrl,
                    }}
                    style={styles.pdfWebView}
                    originWhitelist={['*']}
                    startInLoadingState
                    renderLoading={() => (
                      <View style={styles.previewLoadingWrap}>
                        <ActivityIndicator size="large" color="#13445C" />
                        <Text style={styles.previewLoadingText}>جاري تحميل ملف الإيصال...</Text>
                      </View>
                    )}
                  />
                )
              ) : (
                <View style={styles.fallbackDocWrap}>
                  <Ionicons name="document-attach-outline" size={56} color="#13445C" />
                  <Text style={styles.fallbackFileName}>{previewTarget?.fileName || 'مستند الدفع'}</Text>
                  {previewTarget?.notes ? (
                    <Text style={styles.fallbackNotes}>
                      ملاحظات الساكن: {previewTarget.notes}
                    </Text>
                  ) : null}
                  <Text style={styles.fallbackHint}>
                    اضغط على زر التحميل بالأسفل لمعاينة وفتح المستند بالكامل في جهازك.
                  </Text>
                </View>
              )}
            </View>

            {/* Download / Open Button */}
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={handleDownloadFile}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.downloadBtnText}>تحميل</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 5. APPROVAL MODAL */}
      <Modal
        visible={approveTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setApproveTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>قبول مستند الدفع</Text>
            <Text style={styles.dialogMessage}>
              هل أنت متأكد من قبول مستند الدفع "
              {approveTarget?.resident?.residentName || (approveTarget as any)?.user?.name || 'عمرو المهدي'}
              "؟
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
                  {loadingAction ? 'جاري الاعتماد...' : 'قبول'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. REJECTION MODAL */}
      <Modal
        visible={rejectTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>رفض مستند الدفع</Text>
            <Text style={styles.dialogMessage}>
              هل أنت متأكد من رفض مستند الدفع "
              {rejectTarget?.resident?.residentName || (rejectTarget as any)?.user?.name || 'عمرو المهدي'}
              "؟
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  // 1. Top Header
  topHeader: {
    flexDirection: 'row-reverse',
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
    flexDirection: 'row-reverse',
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

  // 3. Empty State
  emptyScreenContainer: {
    paddingTop: 40,
    paddingBottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScreenTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 26,
    textAlign: 'center',
  },
  emptyIllustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 4. Data Table Card
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
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  table: {
    minWidth: 790,
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
    paddingVertical: 12,
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
  fileLinkText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  statusText: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 12,
  },
  iconActionBtn: {
    padding: 2,
  },

  // 5. File Preview Bottom Sheet Modal
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#1E40AF',
    textAlign: 'center',
  },
  metaPillContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  metaPillItem: {
    alignItems: 'center',
  },
  metaPillLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metaPillValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    marginTop: 2,
  },
  sheetMediaWrap: {
    width: '100%',
    height: 380,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  previewImage: {
    width: '100%',
    height: 370,
  },
  pdfWebView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewLoadingWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  previewLoadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  fallbackDocWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  fallbackFileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  fallbackNotes: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  fallbackHint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
  },
  downloadBtn: {
    backgroundColor: '#13445C',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // 6. Confirmation Modals
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
});
