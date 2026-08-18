import { useCallback, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, User } from '@/api/client';
import { Screen, ui } from '@/components/screen';

export default function RegistrationsScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setUsers(await api.getPendingUsers());
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, []));

  return (
    <Screen
      title="طلبات التسجيل"
      back
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(console.error);
        setRefreshing(false);
      }}
    >
      {users.length === 0 ? <Text style={ui.empty}>لا توجد طلبات قيد المراجعة</Text> : users.map((u) => (
        <View key={u.id} style={ui.card}>
          <Text style={ui.name}>{u.name}</Text>
          <Text style={ui.meta}>@{u.username} · {u.email}</Text>
          {u.resident ? (
            <Text style={ui.meta}>{u.resident.area}-{u.resident.buildingNo} · {u.resident.mobile}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TouchableOpacity
              style={[ui.button, { flex: 1, backgroundColor: '#16a34a' }]}
              onPress={async () => {
                try {
                  await api.approveUser(u.id, u.resident?.monthlyFees);
                  load();
                } catch (e) {
                  Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الموافقة');
                }
              }}
            >
              <Text style={ui.buttonText}>موافقة</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ui.danger, { flex: 1 }]}
              onPress={async () => {
                try {
                  await api.rejectUser(u.id, 'تم رفض الطلب');
                  load();
                } catch (e) {
                  Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الرفض');
                }
              }}
            >
              <Text style={ui.buttonText}>رفض</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </Screen>
  );
}
