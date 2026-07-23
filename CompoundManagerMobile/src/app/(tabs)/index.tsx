import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { api, Bill } from '@/api/client';

const statusLabel: Record<string, string> = {
  ISSUED: 'مستحقة',
  DUE: 'مستحقة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  PARTIAL: 'جزئية',
};

const statusColor: Record<string, string> = {
  ISSUED: '#2563eb',
  DUE: '#d97706',
  PAID: '#16a34a',
  OVERDUE: '#dc2626',
  PARTIAL: '#7c3aed',
};

function formatOwner(b: Bill) {
  const r = b.resident;
  if (!r) return null;
  const type = r.residentType === 'T' ? 'مستأجر' : 'مالك';
  const unit = [r.area, r.buildingNo, r.floorNo, r.apartmentNo]
    .filter((v) => v !== undefined && v !== null && v !== '')
    .join('-');
  return { name: r.residentName, type, unit, mobile: r.mobile };
}

export default function HomeScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      await refreshUser().catch(() => {});
      const [b, n] = await Promise.all([api.getBills(), api.getUnreadCount()]);
      setBills(b);
      setUnread(n.count);
    } catch (e) {
      console.error(e);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [refreshUser])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const unpaid = bills.filter((b) => b.status !== 'PAID');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>مرحباً، {user?.name}</Text>
            <Text style={styles.role}>
              {user?.role === 'SUPERADMIN'
                ? 'مدير أعلى'
                : user?.role === 'ADMIN'
                  ? 'مدير'
                  : user?.role === 'ACCOUNTANT'
                    ? 'محاسب'
                    : 'مالك'}
            </Text>
          </View>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logout}>خروج</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{unpaid.length}</Text>
            <Text style={styles.statLabel}>فواتير غير مدفوعة</Text>
          </View>
          <TouchableOpacity style={styles.statCard} onPress={() => router.push('/notifications')}>
            <Text style={styles.statValue}>{unread}</Text>
            <Text style={styles.statLabel}>إشعارات جديدة</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>آخر الفواتير</Text>
        {bills.length === 0 ? (
          <Text style={styles.empty}>لا توجد فواتير</Text>
        ) : (
          bills.slice(0, 5).map((b) => {
            const owner = formatOwner(b);
            return (
              <View key={b.id} style={styles.billCard}>
                <View style={styles.billHeader}>
                  <Text style={styles.billPeriod}>{b.period}</Text>
                  <Text style={[styles.badge, { color: statusColor[b.status] }]}>
                    {statusLabel[b.status]}
                  </Text>
                </View>
                {owner && (
                  <View style={styles.ownerBlock}>
                    <Text style={styles.ownerName}>{owner.name}</Text>
                    <Text style={styles.ownerMeta}>
                      {owner.type}
                      {owner.unit ? ` · ${owner.unit}` : ''}
                    </Text>
                    {owner.mobile ? <Text style={styles.ownerMeta}>📞 {owner.mobile}</Text> : null}
                  </View>
                )}
                <Text style={styles.billAmount}>{b.amount} ج.م</Text>
                <Text style={styles.billDue}>
                  الاستحقاق: {new Date(b.dueDate).toLocaleDateString('ar-EG')}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 20, fontWeight: '700' },
  role: { color: '#64748b', marginTop: 2 },
  logout: { color: '#dc2626', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '700', color: '#2563eb' },
  statLabel: { color: '#64748b', fontSize: 13, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, textAlign: 'right' },
  billCard: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 10 },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billPeriod: { fontWeight: '600', fontSize: 16 },
  badge: { fontWeight: '600', fontSize: 13 },
  ownerBlock: { marginBottom: 8, alignItems: 'flex-end' },
  ownerName: { fontWeight: '600', fontSize: 15, textAlign: 'right', color: '#0f172a' },
  ownerMeta: { color: '#64748b', fontSize: 13, marginTop: 2, textAlign: 'right' },
  billAmount: { fontSize: 20, fontWeight: '700', textAlign: 'right' },
  billDue: { color: '#64748b', marginTop: 4, textAlign: 'right', fontSize: 13 },
  empty: { textAlign: 'center', color: '#64748b', padding: 24 },
});
