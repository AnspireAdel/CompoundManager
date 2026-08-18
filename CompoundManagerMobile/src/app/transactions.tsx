import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, Transaction } from '@/api/client';
import { Screen, ui } from '@/components/screen';

export default function TransactionsScreen() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRows(await api.getTransactions());
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, []));

  return (
    <Screen
      title="المعاملات المالية"
      back
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(console.error);
        setRefreshing(false);
      }}
    >
      {rows.length === 0 ? <Text style={ui.empty}>لا توجد معاملات</Text> : rows.map((t) => (
        <View key={t.id} style={ui.card}>
          <Text style={ui.name}>{t.resident?.residentName || '—'}</Text>
          <Text style={ui.meta}>{new Date(t.trxDate).toLocaleDateString('ar-EG')}</Text>
          <Text style={ui.meta}>
            {t.trxType === 'BIL' ? 'فاتورة' : t.trxType === 'PAY' ? 'دفعة' : t.trxType} · {t.drCr === 'D' ? 'مدين' : 'دائن'}
          </Text>
          <Text style={[ui.meta, { fontWeight: '800', color: t.drCr === 'D' ? '#dc2626' : '#16a34a' }]}>{t.trxAmount} ج.م</Text>
          {t.notes ? <Text style={ui.meta}>{t.notes}</Text> : null}
        </View>
      ))}
    </Screen>
  );
}
