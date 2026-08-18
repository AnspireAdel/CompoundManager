import { useCallback, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from 'expo-router';
import { api, Bill, Resident } from '@/api/client';
import { Screen, ui } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const statusLabel: Record<string, string> = {
  ISSUED: 'مستحقة',
  DUE: 'مستحقة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  PARTIAL: 'جزئية',
  PENDING_REVIEW: 'بانتظار المراجعة',
};

export default function BillsScreen() {
  const { isStaff } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [extra, setExtra] = useState({ residentId: '', title: '', amount: '', dueDate: new Date().toISOString().slice(0, 10) });

  async function load() {
    setBills(await api.getBills());
    if (isStaff) setResidents(await api.getResidents());
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, [isStaff]));

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
      Alert.alert('تم', 'تم رفع مستند الدفع وبانتظار المراجعة');
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الرفع');
    }
  }

  return (
    <Screen
      title="الفواتير"
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(console.error);
        setRefreshing(false);
      }}
    >
      {isStaff && (
        <View style={ui.card}>
          <Text style={ui.name}>إصدار الفواتير الشهرية</Text>
          <Text style={ui.label}>الفترة (YYYY-MM)</Text>
          <TextInput style={ui.input} value={period} onChangeText={setPeriod} />
          <Text style={ui.label}>تاريخ الاستحقاق</Text>
          <TextInput style={ui.input} value={dueDate} onChangeText={setDueDate} />
          <TouchableOpacity
            style={ui.button}
            onPress={async () => {
              try {
                const r = await api.issueMonthlyBills(period, dueDate);
                Alert.alert('تم', `تم إصدار ${r.issued} فاتورة`);
                load();
              } catch (e) {
                Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الإصدار');
              }
            }}
          >
            <Text style={ui.buttonText}>إصدار</Text>
          </TouchableOpacity>

          <Text style={[ui.name, { marginTop: 16 }]}>فاتورة إضافية</Text>
          <Text style={ui.label}>معرف الوحدة</Text>
          <TextInput
            style={ui.input}
            value={extra.residentId}
            onChangeText={(v) => setExtra({ ...extra, residentId: v })}
            keyboardType="number-pad"
            placeholder={residents[0] ? `مثال ${residents[0].id}` : ''}
          />
          <Text style={ui.label}>العنوان</Text>
          <TextInput style={ui.input} value={extra.title} onChangeText={(v) => setExtra({ ...extra, title: v })} />
          <Text style={ui.label}>المبلغ</Text>
          <TextInput style={ui.input} value={extra.amount} onChangeText={(v) => setExtra({ ...extra, amount: v })} keyboardType="decimal-pad" />
          <TouchableOpacity
            style={ui.button}
            onPress={async () => {
              try {
                await api.createExtraBill({
                  residentId: Number(extra.residentId),
                  title: extra.title.trim(),
                  amount: Number(extra.amount),
                  dueDate: extra.dueDate,
                });
                Alert.alert('تم', 'تم إنشاء الفاتورة الإضافية');
                load();
              } catch (e) {
                Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الإنشاء');
              }
            }}
          >
            <Text style={ui.buttonText}>إضافة فاتورة إضافية</Text>
          </TouchableOpacity>
        </View>
      )}

      {bills.length === 0 ? <Text style={ui.empty}>لا توجد فواتير</Text> : bills.map((item) => (
        <View key={item.id} style={ui.card}>
          <View style={ui.row}>
            <Text style={{ color: '#2563eb', fontWeight: '700' }}>{statusLabel[item.status] || item.status}</Text>
            <Text style={ui.name}>{item.billType === 'EXTRA' ? (item.title || 'فاتورة إضافية') : item.period}</Text>
          </View>
          {item.resident ? <Text style={ui.meta}>{item.resident.residentName} · {item.resident.area}-{item.resident.buildingNo}</Text> : null}
          <Text style={[ui.meta, { fontWeight: '800', color: '#0f172a' }]}>{item.amount} ج.م</Text>
          {item.status !== 'PAID' && item.status !== 'PENDING_REVIEW' && !isStaff && (
            <TouchableOpacity style={[ui.button, { backgroundColor: '#16a34a', marginTop: 10 }]} onPress={() => handleUploadProof(item)}>
              <Text style={ui.buttonText}>رفع إثبات دفع ({item.amount - item.paidAmount} ج.م)</Text>
            </TouchableOpacity>
          )}
          {isStaff && item.status !== 'PAID' && (
            <TouchableOpacity
              style={[ui.button, { backgroundColor: '#16a34a', marginTop: 10 }]}
              onPress={async () => {
                try {
                  await api.payBill(item.id, item.amount - item.paidAmount);
                  load();
                } catch (e) {
                  Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل التحصيل');
                }
              }}
            >
              <Text style={ui.buttonText}>تحصيل نقدي</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </Screen>
  );
}
