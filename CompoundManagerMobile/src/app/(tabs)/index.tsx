import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { api, Bill } from '@/api/client';
import { Brand } from '@/constants/theme';

const statusLabel: Record<string, string> = {
  ISSUED: 'مستحقة',
  DUE: 'مستحقة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  PARTIAL: 'جزئية',
};

const statusColor: Record<string, string> = {
  ISSUED: Brand.primary,
  DUE: '#B45309',
  PAID: '#15803D',
  OVERDUE: Brand.danger,
  PARTIAL: '#7C3AED',
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

function roleLabel(role?: string) {
  if (role === 'SUPERADMIN') return 'مدير أعلى';
  if (role === 'ADMIN') return 'مدير';
  if (role === 'ACCOUNTANT') return 'محاسب';
  if (role === 'DEPENDENT') return 'تابع';
  return 'مالك';
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>مرحباً، {user?.name}</Text>
              <Text style={styles.role}>{roleLabel(user?.role)}</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color={Brand.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statPrimary]}>
            <View style={styles.statIcon}>
              <Ionicons name="receipt-outline" size={18} color={Brand.primary} />
            </View>
            <Text style={styles.statValue}>{unpaid.length}</Text>
            <Text style={styles.statLabel}>فواتير غير مدفوعة</Text>
          </View>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/notifications')}
            activeOpacity={0.8}
          >
            <View style={styles.statIcon}>
              <Ionicons name="notifications-outline" size={18} color={Brand.primary} />
            </View>
            <Text style={styles.statValue}>{unread}</Text>
            <Text style={styles.statLabel}>إشعارات جديدة</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>آخر الفواتير</Text>
        {bills.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color={Brand.muted} />
            <Text style={styles.empty}>لا توجد فواتير</Text>
          </View>
        ) : (
          bills.slice(0, 5).map((b) => {
            const owner = formatOwner(b);
            return (
              <View key={b.id} style={styles.billCard}>
                <View style={styles.billHeader}>
                  <Text style={styles.billPeriod}>{b.period}</Text>
                  <View style={[styles.badge, { backgroundColor: `${statusColor[b.status]}18` }]}>
                    <Text style={[styles.badgeText, { color: statusColor[b.status] }]}>
                      {statusLabel[b.status]}
                    </Text>
                  </View>
                </View>
                {owner && (
                  <View style={styles.ownerBlock}>
                    <Text style={styles.ownerName}>{owner.name}</Text>
                    <Text style={styles.ownerMeta}>
                      {owner.type}
                      {owner.unit ? ` · ${owner.unit}` : ''}
                    </Text>
                    {owner.mobile ? <Text style={styles.ownerMeta}>{owner.mobile}</Text> : null}
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
  container: { flex: 1, backgroundColor: Brand.background },
  content: { padding: 16, paddingBottom: 28 },
  header: { marginBottom: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 14 },
  greeting: { fontSize: 20, fontWeight: '800', textAlign: 'right', color: Brand.text },
  role: { color: Brand.textSecondary, marginTop: 2, textAlign: 'right', fontSize: 13 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  statCard: {
    flex: 1,
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  statPrimary: { backgroundColor: Brand.primarySoft, borderColor: '#C8E6D5' },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: Brand.primary, textAlign: 'right' },
  statLabel: { color: Brand.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'right' },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'right',
    color: Brand.text,
  },
  billCard: {
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  billPeriod: { fontWeight: '700', fontSize: 16, color: Brand.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontWeight: '700', fontSize: 12 },
  ownerBlock: { marginBottom: 8, alignItems: 'flex-end' },
  ownerName: { fontWeight: '600', fontSize: 15, textAlign: 'right', color: Brand.text },
  ownerMeta: { color: Brand.textSecondary, fontSize: 13, marginTop: 2, textAlign: 'right' },
  billAmount: { fontSize: 20, fontWeight: '800', textAlign: 'right', color: Brand.primaryDark },
  billDue: { color: Brand.muted, marginTop: 4, textAlign: 'right', fontSize: 13 },
  emptyCard: {
    alignItems: 'center',
    padding: 28,
    backgroundColor: Brand.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 8 },
});
