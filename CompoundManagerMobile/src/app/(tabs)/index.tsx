import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, Bill, DashboardStats } from '@/api/client';
import { Screen, ui } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';
import { roleLabel } from '@/lib/roles';

const statusLabel: Record<string, string> = {
  ISSUED: 'مستحقة',
  DUE: 'مستحقة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  PARTIAL: 'جزئية',
  PENDING_REVIEW: 'بانتظار المراجعة',
};

export default function HomeScreen() {
  const { user, logout, refreshUser, isStaff, isOwner, isDependent } = useAuth();
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [unread, setUnread] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      await refreshUser().catch(() => {});
      const n = await api.getUnreadCount();
      setUnread(n.count);
      if (isStaff) {
        setStats(await api.getDashboard(year));
      } else {
        setBills(await api.getBills());
      }
    } catch (e) {
      console.error(e);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [isStaff, year])
  );

  const unpaid = bills.filter((b) => b.status !== 'PAID');
  const years = stats?.availableYears?.length ? stats.availableYears : [year];

  return (
    <Screen
      title="الرئيسية"
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      right={
        <TouchableOpacity onPress={logout}>
          <Text style={{ color: '#dc2626', fontWeight: '700' }}>خروج</Text>
        </TouchableOpacity>
      }
    >
      <View style={ui.card}>
        <Text style={ui.name}>مرحباً، {user?.name}</Text>
        <Text style={ui.meta}>{roleLabel(user?.role)}</Text>
      </View>

      {isStaff && stats ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <View style={ui.stat}>
              <Text style={ui.statValue}>{stats.totalUnits}</Text>
              <Text style={ui.statLabel}>الوحدات</Text>
            </View>
            <View style={ui.stat}>
              <Text style={ui.statValue}>{stats.unpaidBills}</Text>
              <Text style={ui.statLabel}>فواتير متبقية</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <View style={ui.stat}>
              <Text style={[ui.statValue, { fontSize: 16 }]}>{(stats.monthlyMaintenance || 0).toLocaleString()}</Text>
              <Text style={ui.statLabel}>صيانة شهرية</Text>
            </View>
            <View style={ui.stat}>
              <Text style={[ui.statValue, { fontSize: 16 }]}>{stats.totalOutstanding.toLocaleString()}</Text>
              <Text style={ui.statLabel}>المستحقات</Text>
            </View>
          </View>

          <TouchableOpacity style={ui.card} onPress={() => router.push('/notifications')}>
            <Text style={ui.name}>إشعارات جديدة: {unread}</Text>
          </TouchableOpacity>

          <Text style={[ui.name, { marginBottom: 8 }]}>السنة</Text>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {years.map((y) => (
              <TouchableOpacity
                key={y}
                style={[ui.chip, year === y && ui.chipActive]}
                onPress={() => setYear(y)}
              >
                <Text style={[ui.chipText, year === y && ui.chipTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[ui.name, { marginBottom: 8 }]}>الصيانة حسب نوع الوحدة</Text>
          {(stats.unitTypeBreakdown || []).map((row) => (
            <View key={row.name} style={ui.card}>
              <Text style={ui.name}>{row.name}</Text>
              <Text style={ui.meta}>{row.count} وحدة · {row.totalValue.toLocaleString()} ج.م</Text>
            </View>
          ))}

          <Text style={[ui.name, { marginVertical: 8 }]}>الملخص الشهري</Text>
          {(stats.yearlyMonthly || []).map((row) => (
            <View key={row.monthKey} style={ui.card}>
              <Text style={ui.name}>{row.label}</Text>
              <Text style={ui.meta}>مُصدر: {row.issued.toLocaleString()} · محصّل: {row.collected.toLocaleString()}</Text>
              <Text style={ui.meta}>متبقي: {row.remaining.toLocaleString()} · مصاريف: {(row.expenses || 0).toLocaleString()}</Text>
              <Text style={ui.meta}>صافي: {(row.net || 0).toLocaleString()}</Text>
            </View>
          ))}
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <View style={ui.stat}>
              <Text style={ui.statValue}>{unpaid.length}</Text>
              <Text style={ui.statLabel}>فواتير غير مدفوعة</Text>
            </View>
            <TouchableOpacity style={ui.stat} onPress={() => router.push('/notifications')}>
              <Text style={ui.statValue}>{unread}</Text>
              <Text style={ui.statLabel}>إشعارات جديدة</Text>
            </TouchableOpacity>
          </View>
          {(isOwner || isDependent) && (
            <>
              <Text style={[ui.name, { marginBottom: 8 }]}>آخر الفواتير</Text>
              {bills.length === 0 ? <Text style={ui.empty}>لا توجد فواتير</Text> : bills.slice(0, 5).map((b) => (
                <View key={b.id} style={ui.card}>
                  <View style={ui.row}>
                    <Text style={{ color: '#2563eb', fontWeight: '700' }}>{statusLabel[b.status] || b.status}</Text>
                    <Text style={ui.name}>{b.billType === 'EXTRA' ? (b.title || 'فاتورة إضافية') : b.period}</Text>
                  </View>
                  <Text style={[ui.meta, { fontWeight: '800', color: '#0f172a' }]}>{b.amount} ج.م</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
