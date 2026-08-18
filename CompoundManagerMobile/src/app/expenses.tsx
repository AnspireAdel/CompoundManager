import { useCallback, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, Expense, ExpenseType, Resident } from '@/api/client';
import { Screen, ui } from '@/components/screen';

export default function ExpensesScreen() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [form, setForm] = useState({
    scope: 'COMPOUND' as 'COMPOUND' | 'UNIT',
    expenseTypeId: '',
    residentId: '',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [list, t, people] = await Promise.all([
      api.getExpenses(),
      api.getExpenseTypes(true),
      api.getResidents(),
    ]);
    setRows(list);
    setTypes(t);
    setResidents(people);
    if (!form.expenseTypeId && t[0]) setForm((f) => ({ ...f, expenseTypeId: String(t[0].id) }));
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, []));

  return (
    <Screen
      title="المصاريف"
      back
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(console.error);
        setRefreshing(false);
      }}
    >
      <View style={ui.card}>
        <Text style={ui.name}>إضافة مصروف</Text>
        <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 10 }}>
          {(['COMPOUND', 'UNIT'] as const).map((s) => (
            <TouchableOpacity key={s} style={[ui.chip, form.scope === s && ui.chipActive]} onPress={() => setForm({ ...form, scope: s })}>
              <Text style={[ui.chipText, form.scope === s && ui.chipTextActive]}>{s === 'COMPOUND' ? 'المجمع' : 'وحدة'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={ui.label}>النوع</Text>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {types.filter((t) => t.activeFlag === 'Y').map((t) => (
            <TouchableOpacity key={t.id} style={[ui.chip, form.expenseTypeId === String(t.id) && ui.chipActive]} onPress={() => setForm({ ...form, expenseTypeId: String(t.id) })}>
              <Text style={[ui.chipText, form.expenseTypeId === String(t.id) && ui.chipTextActive]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {form.scope === 'UNIT' && (
          <>
            <Text style={ui.label}>معرف الوحدة</Text>
            <TextInput style={ui.input} value={form.residentId} onChangeText={(v) => setForm({ ...form, residentId: v })} keyboardType="number-pad" placeholder={residents[0] ? String(residents[0].id) : ''} />
          </>
        )}
        <Text style={ui.label}>المبلغ</Text>
        <TextInput style={ui.input} value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} keyboardType="decimal-pad" />
        <Text style={ui.label}>التاريخ</Text>
        <TextInput style={ui.input} value={form.expenseDate} onChangeText={(v) => setForm({ ...form, expenseDate: v })} />
        <Text style={ui.label}>ملاحظات</Text>
        <TextInput style={ui.input} value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} />
        <TouchableOpacity
          style={ui.button}
          onPress={async () => {
            try {
              await api.createExpense({
                expenseTypeId: Number(form.expenseTypeId),
                amount: Number(form.amount),
                expenseDate: form.expenseDate,
                notes: form.notes || null,
                residentId: form.scope === 'UNIT' ? Number(form.residentId) : null,
                scope: form.scope,
              });
              setForm((f) => ({ ...f, amount: '', notes: '' }));
              load();
            } catch (e) {
              Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
            }
          }}
        >
          <Text style={ui.buttonText}>حفظ</Text>
        </TouchableOpacity>
      </View>
      {rows.map((e) => (
        <View key={e.id} style={ui.card}>
          <Text style={ui.name}>{e.expenseType?.name || 'مصروف'}</Text>
          <Text style={ui.meta}>{e.resident?.residentName || 'المجمع'} · {new Date(e.expenseDate).toLocaleDateString('ar-EG')}</Text>
          <Text style={[ui.meta, { fontWeight: '800', color: '#0f172a' }]}>{e.amount} ج.م</Text>
        </View>
      ))}
    </Screen>
  );
}
