import { useCallback, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, Resident, Service, ServiceType } from '@/api/client';
import { Screen, ui } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

export default function ServicesScreen() {
  const { isStaff } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ serviceType: '', serviceName: '', mobile: '', notes: '', residentId: '' });
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [list, t] = await Promise.all([
      api.getServices(isStaff),
      api.getServiceTypes(isStaff),
    ]);
    setServices(list);
    setTypes(t);
    if (isStaff) setResidents(await api.getResidents());
    if (!form.serviceType && t[0]) setForm((f) => ({ ...f, serviceType: t[0].name }));
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, [isStaff]));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => [s.serviceType, s.serviceName, s.mobile, s.resident?.residentName].join(' ').toLowerCase().includes(q));
  }, [services, search]);

  return (
    <Screen
      title="الخدمات"
      back
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(console.error);
        setRefreshing(false);
      }}
      right={isStaff ? (
        <TouchableOpacity onPress={() => setShowForm((v) => !v)}>
          <Text style={{ color: '#2563eb', fontWeight: '700' }}>{showForm ? 'إغلاق' : 'إضافة'}</Text>
        </TouchableOpacity>
      ) : undefined}
    >
      <TextInput style={ui.input} value={search} onChangeText={setSearch} placeholder="بحث..." />
      {isStaff && showForm && (
        <View style={ui.card}>
          <Text style={ui.label}>نوع الخدمة</Text>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {types.map((t) => (
              <TouchableOpacity key={t.id} style={[ui.chip, form.serviceType === t.name && ui.chipActive]} onPress={() => setForm({ ...form, serviceType: t.name })}>
                <Text style={[ui.chipText, form.serviceType === t.name && ui.chipTextActive]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={ui.input} value={form.serviceName} onChangeText={(v) => setForm({ ...form, serviceName: v })} placeholder="اسم الخدمة" />
          <TextInput style={ui.input} value={form.mobile} onChangeText={(v) => setForm({ ...form, mobile: v })} placeholder="الموبايل" />
          <TextInput style={ui.input} value={form.residentId} onChangeText={(v) => setForm({ ...form, residentId: v })} placeholder={residents[0] ? `معرف الوحدة مثل ${residents[0].id}` : 'معرف الوحدة'} keyboardType="number-pad" />
          <TouchableOpacity
            style={ui.button}
            onPress={async () => {
              try {
                await api.createService({
                  serviceType: form.serviceType,
                  serviceName: form.serviceName,
                  mobile: form.mobile,
                  notes: form.notes,
                  residentId: form.residentId ? Number(form.residentId) : null,
                });
                setShowForm(false);
                load();
              } catch (e) {
                Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل');
              }
            }}
          >
            <Text style={ui.buttonText}>حفظ</Text>
          </TouchableOpacity>
        </View>
      )}
      {filtered.map((item) => (
        <View key={item.id} style={ui.card}>
          <Text style={ui.meta}>{item.serviceType}</Text>
          <Text style={ui.name}>{item.serviceName}</Text>
          {item.resident ? <Text style={ui.meta}>{item.resident.residentName}</Text> : null}
          <Text style={ui.meta}>📞 {item.mobile}</Text>
          {isStaff && (
            <TouchableOpacity style={[ui.outline, { marginTop: 8 }]} onPress={async () => { await api.toggleService(item.id); load(); }}>
              <Text style={ui.outlineText}>{item.activeFlag === 'Y' ? 'إيقاف' : 'تفعيل'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </Screen>
  );
}
