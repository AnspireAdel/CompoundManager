import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TextInput,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, Service, ServiceType } from '@/api/client';

export default function ServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [list, types] = await Promise.all([
        api.getServices(),
        api.getServiceTypes(),
      ]);
      setServices(list);
      setServiceTypes(types);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, []);

  const typeOptions = useMemo(() => {
    const fromApi = serviceTypes.map((t) => t.name);
    const fromData = services.map((s) => s.serviceType);
    return Array.from(new Set([...fromApi, ...fromData])).filter(Boolean).sort();
  }, [serviceTypes, services]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (typeFilter && s.serviceType !== typeFilter) return false;
      if (!q) return true;
      const haystack = [
        s.serviceType,
        s.serviceName,
        s.mobile,
        s.notes,
        s.resident?.residentName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [services, typeFilter, search]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>خدمات الوحدات</Text>

      <View style={styles.filters}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="بحث بالاسم أو الموبايل..."
          textAlign="right"
          placeholderTextColor="#94a3b8"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <TouchableOpacity
            style={[styles.chip, !typeFilter && styles.chipActive]}
            onPress={() => setTypeFilter('')}
          >
            <Text style={[styles.chipText, !typeFilter && styles.chipTextActive]}>الكل</Text>
          </TouchableOpacity>
          {typeOptions.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, typeFilter === t && styles.chipActive]}
              onPress={() => setTypeFilter(typeFilter === t ? '' : t)}
            >
              <Text style={[styles.chipText, typeFilter === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.count}>عرض {filtered.length} من {services.length}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>لا توجد خدمات مطابقة</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.type}>{item.serviceType}</Text>
            <Text style={styles.name}>{item.serviceName}</Text>
            {item.resident && (
              <Text style={styles.owner}>
                {item.resident.residentName}
              </Text>
            )}
            <Text style={styles.phone}>📞 {item.mobile}</Text>
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  title: { fontSize: 22, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, textAlign: 'right' },
  filters: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  search: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  chips: { gap: 8, paddingBottom: 4, flexDirection: 'row-reverse' },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  count: { color: '#64748b', fontSize: 12, textAlign: 'right', marginTop: 6, marginBottom: 4 },
  list: { padding: 16, paddingTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 },
  type: {
    alignSelf: 'flex-end',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  name: { fontSize: 17, fontWeight: '600', marginTop: 8, textAlign: 'right' },
  owner: { color: '#64748b', fontSize: 13, marginTop: 4, textAlign: 'right' },
  phone: { marginTop: 8, textAlign: 'right' },
  notes: { color: '#64748b', marginTop: 4, textAlign: 'right', fontSize: 13 },
  empty: { textAlign: 'center', color: '#64748b', padding: 40 },
});
