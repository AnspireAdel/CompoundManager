import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  RefreshControl, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ContactRequest } from '@/api/client';

const categoryLabel: Record<string, string> = {
  REQUEST: 'طلب',
  INQUIRY: 'استفسار',
  COMPLAINT: 'شكوى',
};

const statusLabel: Record<string, string> = {
  PENDING: 'جديد',
  IN_PROGRESS: 'قيد المعالجة',
  RESOLVED: 'تم الحل',
  CLOSED: 'مغلق',
};

const categories = [
  { value: 'REQUEST', label: 'طلب' },
  { value: 'INQUIRY', label: 'استفسار' },
  { value: 'COMPLAINT', label: 'شكوى' },
];

export default function ContactScreen() {
  const [items, setItems] = useState<ContactRequest[]>([]);
  const [category, setCategory] = useState('INQUIRY');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.getContactRequests());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال الموضوع والتفاصيل');
      return;
    }
    setSaving(true);
    try {
      await api.createContactRequest({
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubject('');
      setMessage('');
      Alert.alert('تم', 'تم إرسال الطلب بنجاح');
      await load();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الإرسال');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>تواصل معنا</Text>

        <View style={styles.form}>
          <Text style={styles.label}>النوع</Text>
          <View style={styles.chips}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, category === c.value && styles.chipActive]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>الموضوع</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="موضوع الطلب"
            textAlign="right"
          />

          <Text style={styles.label}>التفاصيل</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            placeholder="اكتب التفاصيل هنا..."
            multiline
            textAlign="right"
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submit, saving && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>إرسال</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>طلباتي السابقة</Text>
        <FlatList
          data={items}
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
          ListEmptyComponent={<Text style={styles.empty}>لا توجد طلبات بعد</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.status}>{statusLabel[item.status] || item.status}</Text>
                <Text style={styles.cat}>{categoryLabel[item.category] || item.category}</Text>
              </View>
              <Text style={styles.subject}>{item.subject}</Text>
              <Text style={styles.message}>{item.message}</Text>
              {item.staffResponse ? (
                <Text style={styles.response}>الرد: {item.staffResponse}</Text>
              ) : null}
              <Text style={styles.time}>
                {new Date(item.createdAt).toLocaleString('ar-EG')}
              </Text>
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  title: { fontSize: 22, fontWeight: '700', padding: 16, paddingBottom: 8, textAlign: 'right' },
  form: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 10, padding: 16, marginBottom: 12 },
  label: { fontWeight: '600', marginBottom: 6, textAlign: 'right', color: '#334155' },
  chips: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { color: '#64748b', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
  },
  textarea: { minHeight: 90 },
  submit: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8, textAlign: 'right' },
  list: { padding: 16, paddingTop: 0 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cat: { fontWeight: '700', color: '#2563eb' },
  status: { color: '#64748b', fontSize: 13 },
  subject: { fontWeight: '700', textAlign: 'right', marginBottom: 4 },
  message: { color: '#64748b', textAlign: 'right' },
  response: { marginTop: 8, color: '#16a34a', textAlign: 'right', fontWeight: '600' },
  time: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
  empty: { textAlign: 'center', color: '#64748b', padding: 24 },
});
