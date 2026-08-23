import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, Modal, Dimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Notification } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { BottomTabInset } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NotificationsScreen() {
  const router = useRouter();
  const { isStaff } = useAuth();
  const insets = useSafeAreaInsets();
  const tabPad = BottomTabInset + Math.max(insets.bottom, 0);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Reminders Success Dialog Modal
  const [showRemindersSuccess, setShowRemindersSuccess] = useState(false);
  const [remindersCount, setRemindersCount] = useState(0);
  const [sendingReminders, setSendingReminders] = useState(false);

  async function load() {
    try {
      const list = await api.getNotifications();
      setNotifications(list);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, []);

  async function markRead(id: number) {
    try {
      await api.markNotificationRead(id);
      load();
    } catch (e) {
      console.error(e);
    }
  }

  async function markAll() {
    try {
      await api.markAllRead();
      load();
    } catch (e) {
      console.error(e);
    }
  }

  async function triggerReminders() {
    setSendingReminders(true);
    try {
      const res = await api.sendPaymentReminders();
      setRemindersCount(res.dueReminders);
      setShowRemindersSuccess(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل إرسال التذكيرات');
    } finally {
      setSendingReminders(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#024C59" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 1. CUSTOM TOP BACK HEADER */}
      <View style={styles.topHeader}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>الإشعارات</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-forward" size={24} color="#024C59" />
        </TouchableOpacity>
      </View>

      {/* 2. SUBHEADER BUTTONS ROW */}
      <View style={styles.subheaderActions}>
        <TouchableOpacity style={styles.markAllBtn} onPress={markAll}>
          <Text style={styles.markAllText}>تعيين الكل كمقروء</Text>
        </TouchableOpacity>

        {isStaff && (
          <TouchableOpacity
            style={styles.remindersBtn}
            onPress={triggerReminders}
            disabled={sendingReminders}
          >
            {sendingReminders ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.remindersText}>إرسال تذكيرات السداد</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* 3. NOTIFICATION LIST CARDS */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor="#024C59"
          />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: tabPad }]}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Ionicons name="notifications-off-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>لا توجد أي إشعارات حالياً</Text>
          </View>
        }
        renderItem={({ item }) => {
          const dateObj = new Date(item.createdAt);
          const dateStr = dateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/[/]/g, '-');
          const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

          return (
            <TouchableOpacity
              style={[styles.card, !item.read && styles.cardUnread]}
              onPress={() => !item.read && markRead(item.id)}
              activeOpacity={0.75}
            >
              <View style={styles.cardRow}>
                {/* Left side: status dot */}
                <View style={[styles.statusDot, item.read ? styles.statusDotRead : styles.statusDotUnread]} />

                {/* Right side: content and bell icon */}
                <View style={styles.cardMain}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>{item.title}</Text>
                    <View style={[styles.bellIconWrap, item.read ? styles.bellIconWrapRead : styles.bellIconWrapUnread]}>
                      <Ionicons
                        name={item.read ? 'notifications-outline' : 'notifications'}
                        size={18}
                        color={item.read ? '#64748B' : '#024C59'}
                      />
                    </View>
                  </View>
                  <Text style={styles.notifMessage}>{item.message}</Text>
                  <Text style={styles.notifTime}>{dateStr} · {timeStr}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* 4. SUCCESS POPUP DIALOG */}
      <Modal
        visible={showRemindersSuccess}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRemindersSuccess(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#024C59" style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>تذكيرات السداد</Text>
            <Text style={styles.confirmSubtext}>
              تم إرسال تذكيرات السداد بنجاح لجميع الملاك المستحقين.
            </Text>
            {remindersCount > 0 && (
              <Text style={styles.confirmTargetVal}>
                عدد المستلمين: {remindersCount}
              </Text>
            )}
            
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmBtnYes]}
                onPress={() => setShowRemindersSuccess(false)}
              >
                <Text style={styles.confirmBtnText}>متابعة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF3F8',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF3F8',
  },
  topHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F7FA',
  },
  subheaderActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  remindersBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#024C59',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remindersText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  markAllBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markAllText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardUnread: {
    borderColor: '#DBEAFE',
    backgroundColor: '#F8FAFC',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  statusDotUnread: {
    backgroundColor: '#EF4444',
  },
  statusDotRead: {
    backgroundColor: '#94A3B8',
  },
  cardMain: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
  },
  notifTitleUnread: {
    color: '#024C59',
  },
  bellIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIconWrapRead: {
    backgroundColor: '#F1F5F9',
  },
  bellIconWrapUnread: {
    backgroundColor: '#E6F4F6',
  },
  notifMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
    lineHeight: 19,
    marginBottom: 8,
  },
  notifTime: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'left',
  },
  emptyView: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },

  // DIALOG POPUP
  modalOverlay: {
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
  },
  confirmTargetVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#024C59',
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
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
    backgroundColor: '#024C59',
  },
  confirmBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
