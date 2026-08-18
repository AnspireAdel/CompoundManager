import { useCallback, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, ContactRequest } from '@/api/client';
import { Screen, ui } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const categoryLabel: Record<string, string> = { REQUEST: 'طلب', INQUIRY: 'استفسار', COMPLAINT: 'شكوى' };
const statusLabel: Record<string, string> = { PENDING: 'جديد', IN_PROGRESS: 'قيد المعالجة', RESOLVED: 'تم الحل', CLOSED: 'مغلق' };

export default function ContactScreen() {
  const { isStaff, isOwner, isDependent } = useAuth();
  const isHousehold = isOwner || isDependent;
  const [items, setItems] = useState<ContactRequest[]>([]);
  const [category, setCategory] = useState('INQUIRY');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [response, setResponse] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setItems(await api.getContactRequests());
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, []));

  return (
    <Screen
      title={isHousehold ? 'تواصل معنا' : 'الطلبات والشكاوى'}
      back
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(console.error);
        setRefreshing(false);
      }}
    >
      {!isStaff && (
        <View style={ui.card}>
          <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 10 }}>
            {Object.entries(categoryLabel).map(([value, label]) => (
              <TouchableOpacity key={value} style={[ui.chip, category === value && ui.chipActive]} onPress={() => setCategory(value)}>
                <Text style={[ui.chipText, category === value && ui.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={ui.input} value={subject} onChangeText={setSubject} placeholder="الموضوع" />
          <TextInput style={[ui.input, { minHeight: 80 }]} value={message} onChangeText={setMessage} placeholder="التفاصيل" multiline />
          <TouchableOpacity
            style={ui.button}
            onPress={async () => {
              try {
                await api.createContactRequest({ category, subject: subject.trim(), message: message.trim() });
                setSubject('');
                setMessage('');
                load();
              } catch (e) {
                Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الإرسال');
              }
            }}
          >
            <Text style={ui.buttonText}>إرسال</Text>
          </TouchableOpacity>
        </View>
      )}
      {items.map((item) => (
        <View key={item.id} style={ui.card}>
          <View style={ui.row}>
            <Text style={ui.meta}>{statusLabel[item.status] || item.status}</Text>
            <Text style={ui.name}>{categoryLabel[item.category] || item.category}</Text>
          </View>
          <Text style={ui.name}>{item.subject}</Text>
          <Text style={ui.meta}>{item.message}</Text>
          {item.resident ? <Text style={ui.meta}>{item.resident.residentName}</Text> : null}
          {item.staffResponse ? <Text style={[ui.meta, { color: '#16a34a', fontWeight: '700' }]}>الرد: {item.staffResponse}</Text> : null}
          {isStaff && (
            <>
              {actionId === item.id ? (
                <>
                  <TextInput style={ui.input} value={response} onChangeText={setResponse} placeholder="رد الإدارة" />
                  <TouchableOpacity
                    style={ui.button}
                    onPress={async () => {
                      await api.updateContactRequest(item.id, { status: 'RESOLVED', staffResponse: response });
                      setActionId(null);
                      setResponse('');
                      load();
                    }}
                  >
                    <Text style={ui.buttonText}>حفظ الرد</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={[ui.outline, { marginTop: 8 }]} onPress={() => setActionId(item.id)}>
                  <Text style={ui.outlineText}>الرد / تحديث الحالة</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      ))}
    </Screen>
  );
}
