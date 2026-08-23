import { useCallback, useState } from 'react';
import {
  Text, TouchableOpacity, View, StyleSheet, ScrollView, Image,
  Dimensions, ActivityIndicator, Alert, Modal, Pressable, Platform
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Line, Text as SvgText } from 'react-native-svg';
import { api, Bill, DashboardStats } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';
import { roleLabel } from '@/lib/roles';

const statusLabel: Record<string, string> = {
  ISSUED: 'مستحقة',
  DUE: 'مستحقة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  PARTIAL: 'جزئية',
  PENDING_REVIEW: 'مراجعة الدفع',
};

const statusColor: Record<string, { text: string; bg: string }> = {
  ISSUED: { text: '#F59E0B', bg: '#FEF3C7' },
  DUE: { text: '#F59E0B', bg: '#FEF3C7' },
  PAID: { text: '#024C59', bg: '#E6F4F6' },
  OVERDUE: { text: '#EF4444', bg: '#FEE2E2' },
  PARTIAL: { text: '#3B82F6', bg: '#DBEAFE' },
  PENDING_REVIEW: { text: '#6366F1', bg: '#EEF2FF' },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 1. VECTOR DONUT CHART COMPONENT
function DonutChart({
  collected,
  remaining,
  total,
  colorCollected,
  colorRemaining,
  labelText,
}: {
  collected: number;
  remaining: number;
  total: number;
  colorCollected: string;
  colorRemaining: string;
  labelText: string;
}) {
  const sum = collected + remaining;
  const collectedPercent = sum > 0 ? (collected / sum) * 100 : 0;
  
  const size = 90;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (circumference * collectedPercent) / 100;
  
  return (
    <View style={styles.donutSvgWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background remaining circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorRemaining}
          strokeWidth={strokeWidth}
          fill="transparent"
          opacity={0.15}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorRemaining}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Active collected circle slice */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorCollected}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* Center Text */}
        <SvgText
          x="50%"
          y="54%"
          textAnchor="middle"
          fontSize="13"
          fontWeight="bold"
          fill="#1E293B"
        >
          {labelText}
        </SvgText>
      </Svg>
    </View>
  );
}

// 2. VECTOR LINE CHART COMPONENT
function TrendLineChart({ data }: { data: Array<{ label: string; issued: number; collected: number }> }) {
  if (!data || data.length === 0) return null;
  
  const sizeWidth = SCREEN_WIDTH - 76;
  const sizeHeight = 110;
  const padding = 15;
  const axisHeight = 20;
  
  const maxVal = Math.max(...data.map(d => Math.max(d.issued, d.collected)), 1000);
  
  const getX = (index: number) => padding + (index * (sizeWidth - 2 * padding)) / (data.length - 1);
  const getY = (val: number) => sizeHeight - axisHeight - padding - (val / maxVal) * (sizeHeight - axisHeight - 2 * padding);
  
  let issuedPath = '';
  let collectedPath = '';
  
  data.forEach((d, idx) => {
    const x = getX(idx);
    const yIssued = getY(d.issued);
    const yCollected = getY(d.collected);
    
    if (idx === 0) {
      issuedPath = `M ${x} ${yIssued}`;
      collectedPath = `M ${x} ${yCollected}`;
    } else {
      issuedPath += ` L ${x} ${yIssued}`;
      collectedPath += ` L ${x} ${yCollected}`;
    }
  });
  
  return (
    <View style={styles.lineChartContainer}>
      <Svg width={sizeWidth} height={sizeHeight}>
        {/* Grid lines */}
        <Line x1={padding} y1={getY(0)} x2={sizeWidth - padding} y2={getY(0)} stroke="#E2E8F0" strokeWidth="1" />
        <Line x1={padding} y1={getY(maxVal / 2)} x2={sizeWidth - padding} y2={getY(maxVal / 2)} stroke="#F8FAFC" strokeWidth="1" strokeDasharray="3 3" />
        <Line x1={padding} y1={getY(maxVal)} x2={sizeWidth - padding} y2={getY(maxVal)} stroke="#F8FAFC" strokeWidth="1" strokeDasharray="3 3" />
        
        {/* Issued Path (Purple) */}
        <Path d={issuedPath} fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Collected Path (Teal) */}
        <Path d={collectedPath} fill="none" stroke="#024C59" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Coordinates nodes */}
        {data.map((d, idx) => {
          const x = getX(idx);
          const yIssued = getY(d.issued);
          const yCollected = getY(d.collected);
          return (
            <View key={idx}>
              <Circle cx={x} cy={yIssued} r="3.5" fill="#8B5CF6" stroke="#FFFFFF" strokeWidth="1" />
              <Circle cx={x} cy={yCollected} r="3.5" fill="#024C59" stroke="#FFFFFF" strokeWidth="1" />
            </View>
          );
        })}
      </Svg>
      
      {/* X-axis Month Labels */}
      <View style={styles.xAxisRow}>
        {data.map((d, idx) => (
          <Text key={idx} style={styles.xAxisLabel}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { user, logout, refreshUser, isStaff, isOwner, isDependent, isAdmin } = useAuth();
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [unread, setUnread] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isHousehold = isOwner || isDependent;

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

  function navigateFromDrawer(path: string) {
    setDrawerOpen(false);
    router.push(path as never);
  }

  const drawerItems = [
    { label: 'طلبات التسجيل', icon: 'person-add-outline', route: '/registrations', show: isAdmin },
    { label: 'مستندات الدفع', icon: 'receipt-outline', route: '/payments', show: isStaff },
    { label: 'المعالملات المالية', icon: 'wallet-outline', route: '/transactions', show: true },
    { label: 'المصاريف', icon: 'cash-outline', route: '/expenses', show: isStaff },
    { label: 'الخدمات', icon: 'construct-outline', route: '/services', show: true },
    { label: 'المحادثات', icon: 'chatbubbles-outline', route: '/(tabs)/chats', show: true },
    { label: 'إرسال إشعارات', icon: 'paper-plane-outline', route: '/send-notifications', show: isStaff },
    { label: 'الطلبات والشكاوى', icon: 'alert-circle-outline', route: '/contact', show: true },
    { label: 'أنواع الوحدات', icon: 'business-outline', route: '/unit-types', show: isStaff },
    { label: 'أنواع الخدمات', icon: 'settings-outline', route: '/service-types', show: isStaff },
    { label: 'أنواع المصاريف', icon: 'document-text-outline', route: '/expense-types', show: isStaff },
  ];

  return (
    <Screen
      title="الرئيسية"
      headerShown={false}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      {/* 1. PREMIUM HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setDrawerOpen(true)}>
            <Ionicons name="menu-outline" size={26} color="#024C59" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={24} color="#024C59" />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.profileSection} onPress={() => setDrawerOpen(true)}>
          <View style={styles.profileTextContainer}>
            <Text style={styles.greetText}>مرحباً،</Text>
            <Text style={styles.userName}>{user?.name || 'مستخدم'}</Text>
          </View>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={44} color="#024C59" />
            <View style={styles.onlineDot} />
          </View>
        </TouchableOpacity>
      </View>

      {/* 2. ROLE-BASED STATS GRID */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#E6F4F6' }]}>
            <Ionicons name="wallet-outline" size={22} color="#024C59" />
          </View>
          <Text style={styles.statLabel}>إجمالي المستحقات</Text>
          <Text style={styles.statValue}>
            {isStaff
              ? (stats?.totalOutstanding || 0).toLocaleString()
              : (user?.resident?.balance || 0).toLocaleString()}{' '}
            ج.م
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="receipt-outline" size={22} color="#D97706" />
          </View>
          <Text style={styles.statLabel}>فواتير متبقية</Text>
          <Text style={styles.statValue}>
            {isStaff ? stats?.unpaidBills || 0 : unpaid.length}
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="construct-outline" size={22} color="#2563EB" />
          </View>
          <Text style={styles.statLabel}>الصيانة الشهرية</Text>
          <Text style={styles.statValue}>
            {isStaff
              ? (stats?.monthlyMaintenance || 0).toLocaleString()
              : (user?.resident?.monthlyFees || 0).toLocaleString()}{' '}
            ج.م
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#EBF5FF' }]}>
            <Ionicons name="business-outline" size={22} color="#4F46E5" />
          </View>
          <Text style={styles.statLabel}>{isStaff ? 'عدد الوحدات' : 'شقتي'}</Text>
          <Text style={[styles.statValue, !isStaff && { fontSize: 13 }]}>
            {isStaff
              ? stats?.totalUnits || 0
              : user?.resident
                ? `ق ${user.resident.buildingNo} / ش ${user.resident.apartmentNo}`
                : 'غير محدد'}
          </Text>
        </View>
      </View>

      {/* 3. DYNAMIC CONTENT SECTION */}
      {isStaff && stats ? (
        <>
          <Text style={styles.sectionTitle}>نظرة عامة</Text>

          {/* 3.1 DUAL DONUT CHARTS (SIDE BY SIDE IN CARD) */}
          <View style={styles.donutsRow}>
            {/* Donut 1: Bills status */}
            {(() => {
              const collected = stats.yearlyTotals?.collected || 0;
              const remaining = stats.yearlyTotals?.remaining || 0;
              const total = collected + remaining;
              const collPercent = total > 0 ? (collected / total) * 100 : 0;
              return (
                <View style={styles.donutCard}>
                  <Text style={styles.donutTitle}>حالة الفواتير</Text>
                  <DonutChart
                    collected={collected}
                    remaining={remaining}
                    total={total}
                    colorCollected="#024C59"
                    colorRemaining="#F59E0B"
                    labelText={`${Math.round(collPercent)}%`}
                  />
                  <View style={styles.donutLegend}>
                    <View style={styles.legendItemCompact}>
                      <View style={[styles.legendDot, { backgroundColor: '#024C59' }]} />
                      <Text style={styles.legendText}>مجموع المحصل</Text>
                    </View>
                    <View style={styles.legendItemCompact}>
                      <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                      <Text style={styles.legendText}>المتبقي</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Donut 2: Owner / Tenant distribution */}
            {(() => {
              const owners = stats.residentTypeBreakdown?.find(r => r.name === 'مالك')?.count || 0;
              const tenants = stats.residentTypeBreakdown?.find(r => r.name === 'مستأجر')?.count || 0;
              const total = owners + tenants;
              return (
                <View style={styles.donutCard}>
                  <Text style={styles.donutTitle}>مالك / مستأجر</Text>
                  <DonutChart
                    collected={owners}
                    remaining={tenants}
                    total={total}
                    colorCollected="#024C59"
                    colorRemaining="#8B5CF6"
                    labelText={`${total}`}
                  />
                  <View style={styles.donutLegend}>
                    <View style={styles.legendItemCompact}>
                      <View style={[styles.legendDot, { backgroundColor: '#024C59' }]} />
                      <Text style={styles.legendText}>مالك</Text>
                    </View>
                    <View style={styles.legendItemCompact}>
                      <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                      <Text style={styles.legendText}>مستأجر</Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>

          {/* 3.2 LINE TREND CHART */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { marginBottom: 8 }]}>الإصدار والتحصيل (آخر 6 أشهر)</Text>
            <View style={styles.chartLegendRow}>
              <View style={styles.legendItemCompact}>
                <View style={[styles.legendDot, { backgroundColor: '#024C59' }]} />
                <Text style={styles.legendText}>التحصيل</Text>
              </View>
              <View style={styles.legendItemCompact}>
                <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.legendText}>الإصدار</Text>
              </View>
            </View>
            <TrendLineChart data={stats.monthlyTrend || []} />
          </View>

          {/* 3.3 BAR CHARTS */}
          <Text style={styles.sectionTitle}>إحصائيات الوحدات</Text>
          <View style={styles.chartCardRow}>
            <View style={styles.halfCard}>
              <Text style={styles.cardTitleCompact}>عدد الوحدات حسب النوع</Text>
              <View style={styles.barChartContainer}>
                {(() => {
                  const maxVal = Math.max(...(stats.unitTypeBreakdown || []).map(t => t.count), 1);
                  return (stats.unitTypeBreakdown || []).map(t => {
                    const heightPercent = (t.count / maxVal) * 80;
                    return (
                      <View key={t.name} style={styles.barColumn}>
                        <Text style={styles.barValue}>{t.count}</Text>
                        <View style={[styles.barFill, { height: `${heightPercent}%`, backgroundColor: '#024C59' }]} />
                        <Text style={styles.barLabel} numberOfLines={1}>{t.name}</Text>
                      </View>
                    );
                  });
                })()}
              </View>
            </View>

            <View style={styles.halfCard}>
              <Text style={styles.cardTitleCompact}>قيمة الصيانة حسب النوع</Text>
              <View style={styles.barChartContainer}>
                {(() => {
                  const maxVal = Math.max(...(stats.unitTypeBreakdown || []).map(t => t.totalValue), 1);
                  return (stats.unitTypeBreakdown || []).map(t => {
                    const heightPercent = (t.totalValue / maxVal) * 80;
                    return (
                      <View key={t.name} style={styles.barColumn}>
                        <Text style={styles.barValue} numberOfLines={1}>{Math.round(t.totalValue / 1000)}k</Text>
                        <View style={[styles.barFill, { height: `${heightPercent}%`, backgroundColor: '#8B5CF6' }]} />
                        <Text style={styles.barLabel} numberOfLines={1}>{t.name}</Text>
                      </View>
                    );
                  });
                })()}
              </View>
            </View>
          </View>

          {/* 3.4 YEAR FILTER & DATA TABLES */}
          <View style={styles.yearFilterSection}>
            <Text style={styles.sectionTitleCompact}>عرض إحصائيات السنة المالية:</Text>
            <View style={styles.yearsRow}>
              {years.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearChip, year === y && styles.yearChipActive]}
                  onPress={() => setYear(y)}
                >
                  <Text style={[styles.yearChipText, year === y && styles.yearChipTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={[styles.cardTitle, { marginBottom: 12 }]}>الصيانة حسب نوع الوحدة</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCol, { flex: 2, textAlign: 'right' }]}>نوع الوحدة</Text>
              <Text style={[styles.tableCol, { textAlign: 'center' }]}>العدد</Text>
              <Text style={[styles.tableCol, { textAlign: 'left' }]}>المجموع الشهري</Text>
            </View>
            {(stats.unitTypeBreakdown || []).map((row, idx) => (
              <View key={row.name} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                <Text style={[styles.tableColData, { flex: 2, textAlign: 'right', fontWeight: '600' }]}>{row.name}</Text>
                <Text style={[styles.tableColData, { textAlign: 'center' }]}>{row.count}</Text>
                <Text style={[styles.tableColData, { textAlign: 'left', color: '#024C59', fontWeight: '700' }]}>
                  {row.totalValue.toLocaleString()} ج.م
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={[styles.cardTitle, { marginBottom: 12 }]}>الملخص الشهري</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCol, { flex: 1.5, textAlign: 'right' }]}>الشهر</Text>
              <Text style={[styles.tableCol, { textAlign: 'center' }]}>المحصّل</Text>
              <Text style={[styles.tableCol, { textAlign: 'center' }]}>المصاريف</Text>
              <Text style={[styles.tableCol, { textAlign: 'left' }]}>الصافي</Text>
            </View>
            {(stats.yearlyMonthly || []).map((row, idx) => (
              <View key={row.monthKey} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                <Text style={[styles.tableColData, { flex: 1.5, textAlign: 'right', fontWeight: '600' }]}>{row.label}</Text>
                <Text style={[styles.tableColData, { textAlign: 'center', color: '#024C59' }]}>{row.collected.toLocaleString()}</Text>
                <Text style={[styles.tableColData, { textAlign: 'center', color: '#EF4444' }]}>{(row.expenses || 0).toLocaleString()}</Text>
                <Text style={[styles.tableColData, { textAlign: 'left', fontWeight: '700', color: row.net >= 0 ? '#10B981' : '#EF4444' }]}>
                  {row.net.toLocaleString()} ج.م
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          {/* RESIDENT DASHBOARD VIEW */}
          <Text style={styles.sectionTitle}>وصول سريع</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/(tabs)/chats')}>
              <View style={styles.quickIconWrap}>
                <Ionicons name="chatbubbles-outline" size={24} color="#024C59" />
              </View>
              <Text style={styles.quickLabel}>المحادثات</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/services')}>
              <View style={styles.quickIconWrap}>
                <Ionicons name="construct-outline" size={24} color="#024C59" />
              </View>
              <Text style={styles.quickLabel}>الخدمات</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/transactions')}>
              <View style={styles.quickIconWrap}>
                <Ionicons name="wallet-outline" size={24} color="#024C59" />
              </View>
              <Text style={styles.quickLabel}>كشف الحساب</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/contact')}>
              <View style={styles.quickIconWrap}>
                <Ionicons name="alert-circle-outline" size={24} color="#024C59" />
              </View>
              <Text style={styles.quickLabel}>الدعم الفني</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>آخر الفواتير الصادرة</Text>
          {bills.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>لا توجد أي فواتير مسجلة</Text>
            </View>
          ) : (
            bills.slice(0, 5).map((b) => {
              const theme = statusColor[b.status] || { text: '#475569', bg: '#F1F5F9' };
              return (
                <TouchableOpacity
                  key={b.id}
                  style={styles.billCard}
                  onPress={() => router.push('/(tabs)/bills')}
                >
                  <View style={styles.billCardLeft}>
                    <Text style={styles.billAmount}>{b.amount} ج.م</Text>
                    <View style={[styles.statusBadge, { backgroundColor: theme.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: theme.text }]}>
                        {statusLabel[b.status] || b.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.billCardRight}>
                    <Text style={styles.billTitle}>
                      {b.billType === 'EXTRA' ? (b.title || 'فاتورة إضافية') : `فاتورة صيانة - ${b.period}`}
                    </Text>
                    <Text style={styles.billDate}>تاريخ الاستحقاق: {new Date(b.dueDate).toLocaleDateString('ar-EG')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </>
      )}

      {/* 4. SLIDE-OUT NAVIGATION DRAWER MENU */}
      <Modal
        visible={drawerOpen}
        animationType="none"
        transparent={true}
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setDrawerOpen(false)} />

          <View style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerAvatarWrap}>
                <Ionicons name="person-circle" size={64} color="#024C59" />
                <TouchableOpacity style={styles.editAvatarBtn} onPress={() => navigateFromDrawer('/profile')}>
                  <Ionicons name="pencil" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.drawerGreet}>مرحباً بك،</Text>
              <Text style={styles.drawerName}>{user?.name || 'مستخدم'}</Text>
              <Text style={styles.drawerRole}>{roleLabel(user?.role)}</Text>
            </View>

            <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
              {drawerItems
                .filter((item) => item.show)
                .map((item) => (
                  <TouchableOpacity
                    key={item.route}
                    style={styles.drawerItem}
                    onPress={() => navigateFromDrawer(item.route)}
                  >
                    <Ionicons name={item.icon as never} size={22} color="#475569" style={styles.drawerItemIcon} />
                    <Text style={styles.drawerItemLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={() => {
                setDrawerOpen(false);
                setShowLogoutConfirm(true);
              }}
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" style={styles.drawerItemIcon} />
              <Text style={styles.signOutText}>تسجيل الخروج</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CUSTOM LOGOUT CONFIRM DIALOG */}
      <Modal
        visible={showLogoutConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="log-out-outline" size={32} color="#EF4444" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>تسجيل الخروج</Text>
            <Text style={styles.confirmSubtext}>هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك؟</Text>
            
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnYes]}
                onPress={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
              >
                <Text style={styles.confirmBtnText}>خروج</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnNo]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.confirmBtnTextNo}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  profileSection: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  profileTextContainer: {
    marginRight: 10,
    alignItems: 'flex-end',
  },
  greetText: {
    fontSize: 12,
    color: '#64748B',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: (SCREEN_WIDTH - 60) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-end',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitleCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'right',
  },
  cardTitleCompact: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 10,
  },
  donutsRow: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginBottom: 16,
  },
  donutCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  donutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 10,
  },
  donutSvgWrap: {
    marginVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutLegend: {
    marginTop: 8,
    gap: 4,
    width: '100%',
  },
  legendItemCompact: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  legendText: {
    fontSize: 10,
    color: '#475569',
  },
  chartLegendRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 10,
    marginTop: 2,
  },
  lineChartContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  xAxisRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    width: SCREEN_WIDTH - 106,
    marginTop: 6,
    paddingHorizontal: 6,
  },
  xAxisLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  chartCardRow: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginBottom: 16,
  },
  halfCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  barChartContainer: {
    height: 120,
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 4,
    marginTop: 6,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: 12,
    borderRadius: 6,
    marginBottom: 6,
  },
  barValue: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  barLabel: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'center',
    width: '100%',
  },
  yearFilterSection: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  yearsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  yearChip: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  yearChipActive: {
    backgroundColor: '#024C59',
    borderColor: '#024C59',
  },
  yearChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  yearChipTextActive: {
    color: '#FFFFFF',
  },
  tableHeader: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableCol: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tableRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#FAFBFD',
  },
  tableColData: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
  },
  quickGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  quickCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  billCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  billCardRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  billTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  billDate: {
    fontSize: 11,
    color: '#64748B',
  },
  billCardLeft: {
    alignItems: 'flex-start',
  },
  billAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#024C59',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 14,
  },

  // SLIDE MENU DRAWER STYLES
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  backdrop: {
    flex: 1,
    height: '100%',
  },
  drawerContainer: {
    width: SCREEN_WIDTH * 0.76,
    height: '100%',
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    shadowColor: '#000000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  drawerHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  drawerAvatarWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#024C59',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  drawerGreet: {
    fontSize: 12,
    color: '#64748B',
  },
  drawerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 2,
  },
  drawerRole: {
    fontSize: 11,
    color: '#024C59',
    fontWeight: '700',
    backgroundColor: '#E6F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  drawerScroll: {
    flex: 1,
    paddingVertical: 10,
  },
  drawerItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  drawerItemIcon: {
    marginLeft: 14,
  },
  drawerItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'right',
  },
  signOutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
    textAlign: 'right',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCard: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  confirmSubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnYes: {
    backgroundColor: '#EF4444',
  },
  confirmBtnNo: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  confirmBtnTextNo: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
  },
});


