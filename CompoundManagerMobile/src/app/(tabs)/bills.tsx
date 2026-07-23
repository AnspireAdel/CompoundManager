import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { api, Bill } from '@/api/client';

const statusLabel: Record<string, string> = {
  ISSUED: 'مستحقة',
  DUE: 'مستحقة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  PARTIAL: 'جزئية',
  PENDING_REVIEW: 'بانتظار المراجعة',
};

function OwnerDetails({ bill }: { bill: Bill }) {
  const r = bill.resident;
  if (!r) return null;
  const type = r.residentType === 'T' ? 'مستأجر' : 'مالك';
  const unitParts = [
    r.area ? `المجاورة ${r.area}` : null,
    r.buildingNo ? `القطعة ${r.buildingNo}` : null,
    r.floorNo != null ? `دور ${r.floorNo}` : null,
    r.apartmentNo != null ? `شقة ${r.apartmentNo}` : null,
  ].filter(Boolean);

  return (
    <View style={styles.ownerBlock}>
      <Text style={styles.ownerName}>{r.residentName}</Text>
      <Text style={styles.ownerMeta}>{type}</Text>
      {unitParts.length > 0 && <Text style={styles.ownerMeta}>{unitParts.join(' · ')}</Text>}
      {r.mobile ? <Text style={styles.ownerMeta}>📞 {r.mobile}</Text> : null}
    </View>
  );
}

export default function BillsScreen() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setBills(await api.getBills());
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleUploadProof(bill: Bill) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const remaining = bill.amount - bill.paidAmount;
      const uri = file.uri.startsWith('file://') || file.uri.startsWith('content://')
        ? file.uri
        : `file://${file.uri}`;

      await api.uploadPaymentProof(
        bill.id,
        remaining,
        {
          uri,
          name: file.name || `proof-${Date.now()}.jpg`,
          mimeType: file.mimeType || undefined,
        }
      );

      Alert.alert('تم', 'تم رفع مستند الدفع وبانتظار موافقة المحاسب');
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الرفع');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>الفواتير</Text>
      <FlatList
        data={bills}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<Text style={styles.empty}>لا توجد فواتير</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.period}>
                {item.billType === 'EXTRA' ? (item.title || 'فاتورة إضافية') : item.period}
              </Text>
              <Text style={styles.status}>{statusLabel[item.status] || item.status}</Text>
            </View>
            {item.billType === 'EXTRA' ? (
              <Text style={styles.ownerMeta}>فاتورة إضافية</Text>
            ) : null}
            <OwnerDetails bill={item} />
            <Text style={styles.amount}>{item.amount} ج.م</Text>
            <Text style={styles.due}>الاستحقاق: {new Date(item.dueDate).toLocaleDateString('ar-EG')}</Text>
            {item.status !== 'PAID' && item.status !== 'PENDING_REVIEW' && (
              <TouchableOpacity style={styles.payBtn} onPress={() => handleUploadProof(item)}>
                <Text style={styles.payBtnText}>رفع إثبات دفع ({item.amount - item.paidAmount} ج.م)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  title: { fontSize: 22, fontWeight: '700', padding: 16, textAlign: 'right' },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  period: { fontWeight: '600', fontSize: 16 },
  status: { color: '#2563eb', fontWeight: '600' },
  ownerBlock: { marginTop: 8, marginBottom: 4, alignItems: 'flex-end' },
  ownerName: { fontWeight: '600', fontSize: 15, textAlign: 'right', color: '#0f172a' },
  ownerMeta: { color: '#64748b', fontSize: 13, marginTop: 2, textAlign: 'right' },
  amount: { fontSize: 22, fontWeight: '700', marginTop: 8, textAlign: 'right' },
  due: { color: '#64748b', fontSize: 13, marginTop: 4, textAlign: 'right' },
  payBtn: { backgroundColor: '#16a34a', borderRadius: 8, padding: 10, marginTop: 12, alignItems: 'center' },
  payBtnText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#64748b', padding: 40 },
});
