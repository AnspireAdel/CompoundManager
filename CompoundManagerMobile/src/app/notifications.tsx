import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api, Notification } from '@/api/client';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setNotifications(await api.getNotifications());
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, []);

  async function markRead(id: number) {
    await api.markNotificationRead(id);
    load();
  }

  async function markAll() {
    await api.markAllRead();
    load();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>الإشعارات</Text>
        <TouchableOpacity onPress={markAll}>
          <Text style={styles.markAll}>تعيين الكل كمقروء</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<Text style={styles.empty}>لا توجد إشعارات</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.read && styles.unread]}
            onPress={() => !item.read && markRead(item.id)}
          >
            <Text style={styles.notifTitle}>{item.title}</Text>
            <Text style={styles.notifMessage}>{item.message}</Text>
            <Text style={styles.notifTime}>
              {new Date(item.createdAt).toLocaleString('ar-EG')}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, gap: 8 },
  back: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
  title: { fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },
  markAll: { color: '#2563eb', fontWeight: '600', fontSize: 12 },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 10 },
  unread: { backgroundColor: '#eff6ff', borderRightWidth: 3, borderRightColor: '#2563eb' },
  notifTitle: { fontWeight: '700', fontSize: 15, textAlign: 'right' },
  notifMessage: { color: '#64748b', marginTop: 4, textAlign: 'right' },
  notifTime: { color: '#94a3b8', fontSize: 12, marginTop: 8, textAlign: 'left' },
  empty: { textAlign: 'center', color: '#64748b', padding: 40 },
});
