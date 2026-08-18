import { useCallback, useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, PaymentProof, resolveUploadUrl } from '@/api/client';
import { Screen, ui } from '@/components/screen';

const statusLabel: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

export default function PaymentsScreen() {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setProofs(await api.getPayments({ status: 'PENDING' }));
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, []));

  return (
    <Screen
      title="مستندات الدفع"
      back
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(console.error);
        setRefreshing(false);
      }}
    >
      {proofs.length === 0 ? <Text style={ui.empty}>لا توجد مستندات بانتظار المراجعة</Text> : proofs.map((p) => (
        <View key={p.id} style={ui.card}>
          <Text style={ui.name}>{p.resident?.residentName || '—'}</Text>
          <Text style={ui.meta}>فاتورة {p.bill?.period || p.billId} · {p.amount} ج.م</Text>
          <Text style={ui.meta}>{statusLabel[p.status] || p.status}</Text>
          <TouchableOpacity
            style={[ui.outline, { marginTop: 8 }]}
            onPress={async () => {
              const url = await resolveUploadUrl(p.filePath);
              if (url) Linking.openURL(url);
            }}
          >
            <Text style={ui.outlineText}>فتح الملف</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              style={[ui.button, { flex: 1, backgroundColor: '#16a34a' }]}
              onPress={async () => {
                await api.approvePayment(p.id);
                load();
              }}
            >
              <Text style={ui.buttonText}>قبول</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ui.danger, { flex: 1 }]}
              onPress={async () => {
                await api.rejectPayment(p.id, 'المستند غير صالح');
                load();
              }}
            >
              <Text style={ui.buttonText}>رفض</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </Screen>
  );
}
