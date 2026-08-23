import { useCallback, useState } from 'react';
import { Text, View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Transaction } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TransactionsScreen() {
  const { isStaff, user: authUser } = useAuth();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setRows(await api.getTransactions());
    } catch (e) {
      console.error(e);
    }
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, []));

  return (
    <Screen
      title="المعاملات المالية"
      back
      headerShown={false} // Premium custom header
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(console.error);
        setRefreshing(false);
      }}
    >
      {/* 1. CUSTOM TOP HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="notifications-outline" size={24} color="#024C59" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.profileTextContainer}>
            <Text style={styles.greetText}>مرحباً،</Text>
            <Text style={styles.userName}>{authUser?.name || 'مستخدم'}</Text>
          </View>
          <Ionicons name="person-circle" size={44} color="#024C59" />
        </View>
      </View>

      {/* 2. SUBHEADER */}
      <View style={styles.subHeader}>
        <Text style={styles.pageTitle}>المعاملات المالية</Text>
      </View>

      {/* 3. HORIZONTAL SCROLLABLE DATA TABLE */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
        <View style={styles.tableContainer}>
          {/* Table Headers */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thCol, { width: 90, textAlign: 'center' }]}>التاريخ</Text>
            {isStaff && <Text style={[styles.thCol, { width: 130, textAlign: 'right' }]}>الساكن</Text>}
            <Text style={[styles.thCol, { width: 70, textAlign: 'center' }]}>النوع</Text>
            <Text style={[styles.thCol, { width: 80, textAlign: 'center' }]}>مدين/دائن</Text>
            <Text style={[styles.thCol, { width: 80, textAlign: 'left' }]}>المبلغ</Text>
            <Text style={[styles.thCol, { width: 180, textAlign: 'right' }]}>ملاحظات</Text>
          </View>

          {/* Table Rows */}
          {rows.length === 0 ? (
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>لا توجد أي معاملات مسجلة</Text>
            </View>
          ) : (
            rows.map((t, idx) => {
              const isDebit = t.drCr === 'D';
              return (
                <View key={t.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                  {/* Date */}
                  <Text style={[styles.tdCol, { width: 90, textAlign: 'center' }]}>
                    {new Date(t.trxDate).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/[/]/g, '-')}
                  </Text>
                  {/* Resident Name (Staff only) */}
                  {isStaff && (
                    <Text style={[styles.tdCol, { width: 130, textAlign: 'right', fontWeight: '700' }]} numberOfLines={1}>
                      {t.resident?.residentName || '—'}
                    </Text>
                  )}
                  {/* Type */}
                  <Text style={[styles.tdCol, { width: 70, textAlign: 'center' }]}>
                    {t.trxType === 'BIL' ? 'فاتورة' : t.trxType === 'PAY' ? 'دفعة' : t.trxType}
                  </Text>
                  {/* Dr/Cr status */}
                  <Text style={[styles.tdCol, { width: 80, textAlign: 'center', color: isDebit ? '#EF4444' : '#10B981', fontWeight: '800' }]}>
                    {isDebit ? 'مدين' : 'دائن'}
                  </Text>
                  {/* Amount */}
                  <Text style={[styles.tdCol, { width: 80, textAlign: 'left', fontWeight: '700' }]}>
                    {t.trxAmount} ج.م
                  </Text>
                  {/* Notes */}
                  <Text style={[styles.tdCol, { width: 180, textAlign: 'right', color: '#64748B' }]} numberOfLines={1}>
                    {t.notes || '—'}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
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
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F7FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'right',
  },
  tableScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  tableContainer: {
    flexDirection: 'column',
  },
  tableHeader: {
    flexDirection: 'row-reverse',
    backgroundColor: '#EBF5FF',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  thCol: {
    fontSize: 12,
    fontWeight: '700',
    color: '#024C59',
  },
  tableRow: {
    flexDirection: 'row-reverse',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tableRowAlt: {
    backgroundColor: '#FAFBFD',
  },
  tdCol: {
    fontSize: 12,
    color: '#334155',
  },
  emptyView: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },
});

