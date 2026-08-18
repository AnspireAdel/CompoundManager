import { useCallback, useState } from 'react';
import { Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, UnitType } from '@/api/client';
import { Screen, ui } from '@/components/screen';

export default function UnitTypesScreen() {
  const [types, setTypes] = useState<UnitType[]>([]);
  const [name, setName] = useState('');
  const [monthlyFees, setMonthlyFees] = useState('500');
  const [hasFloor, setHasFloor] = useState(true);
  const [hasApartment, setHasApartment] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setTypes(await api.getUnitTypes(true));
  }

  useFocusEffect(useCallback(() => { load().catch(console.error); }, []));

  return (
    <Screen title="أنواع الوحدات" back refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      <View style={ui.card}>
        <TextInput style={ui.input} value={name} onChangeText={setName} placeholder="الاسم" />
        <TextInput style={ui.input} value={monthlyFees} onChangeText={setMonthlyFees} keyboardType="decimal-pad" placeholder="الرسوم الشهرية" />
        <View style={[ui.row, { marginBottom: 8 }]}>
          <Switch value={hasFloor} onValueChange={setHasFloor} />
          <Text>له دور</Text>
        </View>
        <View style={[ui.row, { marginBottom: 8 }]}>
          <Switch value={hasApartment} onValueChange={setHasApartment} />
          <Text>له وحدة</Text>
        </View>
        <TouchableOpacity style={ui.button} onPress={async () => {
          try {
            await api.createUnitType({ name: name.trim(), monthlyFees: Number(monthlyFees), hasFloor, hasApartment });
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
          <Text style={ui.meta}>{t.monthlyFees} ج.م · {t.activeFlag === 'Y' ? 'نشط' : 'موقوف'}</Text>
          <TouchableOpacity style={[ui.outline, { marginTop: 8 }]} onPress={async () => { await api.toggleUnitType(t.id); load(); }}>
            <Text style={ui.outlineText}>تفعيل / إيقاف</Text>
          </TouchableOpacity>
        </View>
      ))}
    </Screen>
  );
}
