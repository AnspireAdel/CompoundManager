import { useCallback, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, Dependent, Resident, UnitType } from '@/api/client';
import { Screen, ui } from '@/components/screen';

const RELATION_OPTIONS = ['زوج', 'زوجة', 'ابن', 'ابنة', 'والد', 'والدة'];

const empty = {
  area: '',
  buildingNo: '',
  floorNo: '1',
  apartmentNo: '1',
  residentName: '',
  mobile: '',
  email: '',
  landLine: '',
  nationality: 'مصري',
  monthlyFees: '',
  residentType: 'O',
  unitTypeId: '',
  notes: '',
};

export default function ResidentsScreen() {
  const [rows, setRows] = useState<Resident[]>([]);
  const [types, setTypes] = useState<UnitType[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [username, setUsername] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [depForm, setDepForm] = useState({ name: '', relation: 'زوج', mobile: '', email: '' });
  const [depPreviewUsername, setDepPreviewUsername] = useState('');
  const [savingDep, setSavingDep] = useState(false);

  async function load() {
    const [list, unitTypes] = await Promise.all([
      api.getResidents(search ? { search } : undefined),
      api.getUnitTypes(true),
    ]);
    setRows(list);
    setTypes(unitTypes);
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, [search]));

  function openCreate() {
    const first = types.find((t) => t.activeFlag === 'Y') || types[0];
    setEditingId(null);
    setForm({
      ...empty,
      unitTypeId: first ? String(first.id) : '',
      monthlyFees: first ? String(first.monthlyFees) : '',
    });
    api.getNextUsername().then((r) => setUsername(r.username)).catch(() => setUsername(''));
    setDependents([]);
    setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
    setShowForm(true);
  }

  function openEdit(r: Resident) {
    setEditingId(r.id);
    setForm({
      area: r.area,
      buildingNo: r.buildingNo,
      floorNo: String(r.floorNo),
      apartmentNo: r.apartmentNo,
      residentName: r.residentName,
      mobile: r.mobile,
      email: r.email || '',
      landLine: r.landLine || '',
      nationality: r.nationality || 'مصري',
      monthlyFees: String(r.monthlyFees),
      residentType: r.residentType || 'O',
      unitTypeId: r.unitTypeId ? String(r.unitTypeId) : '',
      notes: r.notes || '',
    });
    setUsername(r.user?.username || '');
    setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
    api.getSuggestedUsername().then((s) => setDepPreviewUsername(s.username)).catch(() => setDepPreviewUsername(''));
    api.getDependents(r.id).then(setDependents).catch(() => setDependents([]));
    setShowForm(true);
  }

  async function save() {
    try {
      const type = types.find((t) => t.id === Number(form.unitTypeId));
      const payload = {
        area: form.area,
        buildingNo: form.buildingNo,
        floorNo: type?.hasFloor ? Number(form.floorNo) : 0,
        apartmentNo: type?.hasApartment ? form.apartmentNo.trim() : '0',
        residentName: form.residentName,
        mobile: form.mobile,
        email: form.email || undefined,
        landLine: form.landLine || undefined,
        nationality: form.nationality,
        monthlyFees: Number(form.monthlyFees),
        unitTypeId: Number(form.unitTypeId),
        residentType: form.residentType === 'T' ? 'T' : 'O',
        notes: form.notes.trim() || null,
      };
      if (editingId) await api.updateResident(editingId, payload);
      else await api.createResident(payload);
      setShowForm(false);
      load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الحفظ');
    }
  }

  return (
    <Screen
      title="الوحدات"
      back
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(console.error);
        setRefreshing(false);
      }}
      right={
        <TouchableOpacity onPress={openCreate}>
          <Text style={{ color: '#2563eb', fontWeight: '700' }}>إضافة</Text>
        </TouchableOpacity>
      }
    >
      <TextInput style={ui.input} value={search} onChangeText={setSearch} placeholder="بحث..." />
      {showForm && (
        <View style={ui.card}>
          <Text style={ui.name}>{editingId ? 'تعديل وحدة' : 'وحدة جديدة'}</Text>
          <Text style={ui.label}>الاسم</Text>
          <TextInput style={ui.input} value={form.residentName} onChangeText={(v) => setForm({ ...form, residentName: v })} />
          <Text style={ui.label}>الموبايل</Text>
          <TextInput style={ui.input} value={form.mobile} onChangeText={(v) => setForm({ ...form, mobile: v })} />
          <Text style={ui.label}>البريد</Text>
          <TextInput style={ui.input} value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} autoCapitalize="none" />
          <Text style={ui.label}>اسم المستخدم</Text>
          <TextInput style={[ui.input, { backgroundColor: '#f1f5f9' }]} value={username} editable={false} />
          <Text style={ui.label}>المجاورة</Text>
          <TextInput style={ui.input} value={form.area} onChangeText={(v) => setForm({ ...form, area: v })} />
          <Text style={ui.label}>القطعة</Text>
          <TextInput style={ui.input} value={form.buildingNo} onChangeText={(v) => setForm({ ...form, buildingNo: v })} />
          <Text style={ui.label}>نوع الوحدة</Text>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {types.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[ui.chip, form.unitTypeId === String(t.id) && ui.chipActive]}
                onPress={() => setForm({ ...form, unitTypeId: String(t.id), monthlyFees: String(t.monthlyFees) })}
              >
                <Text style={[ui.chipText, form.unitTypeId === String(t.id) && ui.chipTextActive]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={ui.button} onPress={save}>
            <Text style={ui.buttonText}>حفظ</Text>
          </TouchableOpacity>
          {editingId && (
            <TouchableOpacity
              style={[ui.outline, { marginTop: 8 }]}
              onPress={async () => {
                try {
                  const r = await api.resetResidentPassword(editingId);
                  Alert.alert('تم', r.message);
                } catch (e) {
                  Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل');
                }
              }}
            >
              <Text style={ui.outlineText}>إعادة كلمة المرور</Text>
            </TouchableOpacity>
          )}
          {editingId && (
            <View style={{ marginTop: 16 }}>
              <Text style={ui.name}>التابعون</Text>
              <Text style={ui.meta}>البريد مطلوب. اسم المستخدم: {depPreviewUsername || '…'} — كلمة المرور الافتراضية 123</Text>
              <TextInput style={ui.input} value={depForm.name} onChangeText={(v) => setDepForm({ ...depForm, name: v })} placeholder="الاسم" />
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {RELATION_OPTIONS.map((r) => (
                  <TouchableOpacity key={r} style={[ui.chip, depForm.relation === r && ui.chipActive]} onPress={() => setDepForm({ ...depForm, relation: r })}>
                    <Text style={[ui.chipText, depForm.relation === r && ui.chipTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={ui.input} value={depForm.mobile} onChangeText={(v) => setDepForm({ ...depForm, mobile: v })} placeholder="الموبايل" />
              <TextInput style={ui.input} value={depForm.email} onChangeText={(v) => setDepForm({ ...depForm, email: v })} placeholder="البريد" autoCapitalize="none" />
              <TouchableOpacity
                style={ui.outline}
                disabled={savingDep}
                onPress={async () => {
                  if (!depForm.name.trim() || !depForm.mobile.trim() || !depForm.email.trim()) {
                    Alert.alert('تنبيه', 'الاسم والموبايل والبريد مطلوبة');
                    return;
                  }
                  setSavingDep(true);
                  try {
                    await api.createDependent({
                      residentId: editingId,
                      name: depForm.name.trim(),
                      relation: depForm.relation,
                      mobile: depForm.mobile.trim(),
                      email: depForm.email.trim(),
                    });
                    const assigned = depPreviewUsername;
                    setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
                    setDependents(await api.getDependents(editingId));
                    api.getSuggestedUsername().then((s) => setDepPreviewUsername(s.username)).catch(() => {});
                    Alert.alert('تم', `تم إضافة التابع — اسم المستخدم: ${assigned} — كلمة المرور 123`);
                  } catch (e) {
                    Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل إضافة التابع');
                  } finally {
                    setSavingDep(false);
                  }
                }}
              >
                <Text style={ui.outlineText}>{savingDep ? '...' : 'إضافة تابع'}</Text>
              </TouchableOpacity>
              {dependents.map((d) => (
                <View key={d.id} style={[ui.card, { marginTop: 8 }]}>
                  <Text style={ui.name}>{d.name}</Text>
                  <Text style={ui.meta}>{d.relation} · {d.mobile}</Text>
                  <Text style={ui.meta}>@{d.user?.username || '—'} · {d.email || '—'}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={[ui.outline, { flex: 1 }]}
                      onPress={async () => {
                        try {
                          const r = await api.resetDependentPassword(d.id);
                          Alert.alert('تم', r.message);
                        } catch (e) {
                          Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل');
                        }
                      }}
                    >
                      <Text style={ui.outlineText}>إعادة كلمة المرور</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[ui.danger, { flex: 1 }]}
                      onPress={() => {
                        Alert.alert('تأكيد', 'حذف هذا التابع؟', [
                          { text: 'إلغاء', style: 'cancel' },
                          {
                            text: 'حذف',
                            style: 'destructive',
                            onPress: async () => {
                              await api.deleteDependent(d.id);
                              setDependents(await api.getDependents(editingId));
                            },
                          },
                        ]);
                      }}
                    >
                      <Text style={ui.buttonText}>حذف</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={[ui.outline, { marginTop: 8 }]} onPress={() => setShowForm(false)}>
            <Text style={ui.outlineText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      )}
      {rows.map((r) => (
        <TouchableOpacity key={r.id} style={ui.card} onPress={() => openEdit(r)}>
          <Text style={ui.name}>{r.residentName}</Text>
          <Text style={ui.meta}>{r.area}-{r.buildingNo} · {r.user?.username || 'بدون دخول'}</Text>
          <Text style={ui.meta}>{r.mobile} · {r.monthlyFees} ج.م</Text>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}
