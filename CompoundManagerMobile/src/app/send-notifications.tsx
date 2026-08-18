import { useCallback, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, Resident } from '@/api/client';
import { Screen, ui } from '@/components/screen';

export default function SendNotificationsScreen() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [target, setTarget] = useState<'area' | 'building' | 'owner'>('area');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [buildingArea, setBuildingArea] = useState('');
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [residentId, setResidentId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  useFocusEffect(useCallback(() => {
    api.getResidents().then(setResidents).catch(console.error);
  }, []));

  const areas = useMemo(() => Array.from(new Set(residents.map((r) => r.area).filter(Boolean))).sort(), [residents]);
  const buildings = useMemo(() => {
    if (!buildingArea) return [];
    return Array.from(new Set(residents.filter((r) => r.area === buildingArea).map((r) => r.buildingNo))).sort();
  }, [residents, buildingArea]);

  async function send() {
    try {
      let result;
      if (target === 'area') {
        result = await api.sendNotification({ target: 'area', areas: selectedAreas, title, message });
      } else if (target === 'building') {
        result = await api.sendNotification({ target: 'building', area: buildingArea, buildings: selectedBuildings, title, message });
      } else {
        result = await api.sendNotification({ target: 'owner', residentId: Number(residentId), title, message });
      }
      Alert.alert('تم', `تم الإرسال إلى ${result.sent} مستلم`);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الإرسال');
    }
  }

  return (
    <Screen title="إرسال إشعارات" back>
      <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 12 }}>
        {([
          ['area', 'مجاورة'],
          ['building', 'قطعة'],
          ['owner', 'مالك'],
        ] as const).map(([value, label]) => (
          <TouchableOpacity key={value} style={[ui.chip, target === value && ui.chipActive]} onPress={() => setTarget(value)}>
            <Text style={[ui.chipText, target === value && ui.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {target === 'area' && areas.map((a) => (
        <TouchableOpacity key={a} style={[ui.chip, selectedAreas.includes(a) && ui.chipActive, { marginBottom: 8 }]} onPress={() => setSelectedAreas((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a])}>
          <Text style={[ui.chipText, selectedAreas.includes(a) && ui.chipTextActive]}>{a}</Text>
        </TouchableOpacity>
      ))}
      {target === 'building' && (
        <>
          <Text style={ui.label}>المجاورة</Text>
          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {areas.map((a) => (
              <TouchableOpacity key={a} style={[ui.chip, buildingArea === a && ui.chipActive]} onPress={() => { setBuildingArea(a); setSelectedBuildings([]); }}>
                <Text style={[ui.chipText, buildingArea === a && ui.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {buildings.map((b) => (
            <TouchableOpacity key={b} style={[ui.chip, selectedBuildings.includes(b) && ui.chipActive, { marginBottom: 8 }]} onPress={() => setSelectedBuildings((p) => p.includes(b) ? p.filter((x) => x !== b) : [...p, b])}>
              <Text style={[ui.chipText, selectedBuildings.includes(b) && ui.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
      {target === 'owner' && (
        <>
          <Text style={ui.label}>معرف الوحدة</Text>
          <TextInput style={ui.input} value={residentId} onChangeText={setResidentId} keyboardType="number-pad" />
        </>
      )}
      <TextInput style={ui.input} value={title} onChangeText={setTitle} placeholder="العنوان" />
      <TextInput style={[ui.input, { minHeight: 90 }]} value={message} onChangeText={setMessage} placeholder="الرسالة" multiline />
      <TouchableOpacity style={ui.button} onPress={send}>
        <Text style={ui.buttonText}>إرسال</Text>
      </TouchableOpacity>
    </Screen>
  );
}
