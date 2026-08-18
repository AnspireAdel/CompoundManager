import { useCallback, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, ExpenseType } from '@/api/client';
import { Screen, ui } from '@/components/screen';

export default function ExpenseTypesScreen() {
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [name, setName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setTypes(await api.getExpenseTypes(true));
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, []));

  return (
    <Screen title="أنواع المصاريف" back refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <View style={ui.card}>
        <TextInput style={ui.input} value={name} onChangeText={setName} placeholder="اسم النوع" />
        <TouchableOpacity style={ui.button} onPress={async () => {
          try {
            await api.createExpenseType(name.trim());
            setName('');
            load();
          } catch (e) {
            Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل');
          }
        }}>
          <Text style={ui.buttonText}>إضافة</Text>
        </TouchableOpacity>
      </View>
      {types.map((t) => (
        <View key={t.id} style={ui.card}>
          <Text style={ui.name}>{t.name}</Text>
          <Text style={ui.meta}>{t.activeFlag === 'Y' ? 'نشط' : 'موقوف'}</Text>
          <TouchableOpacity style={[ui.outline, { marginTop: 8 }]} onPress={async () => { await api.toggleExpenseType(t.id); load(); }}>
            <Text style={ui.outlineText}>تفعيل / إيقاف</Text>
          </TouchableOpacity>
        </View>
      ))}
    </Screen>
  );
}
