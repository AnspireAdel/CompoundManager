import { useCallback, useMemo, useState } from 'react';
import {
  Alert, Text, TextInput, TouchableOpacity, View, StyleSheet,
  ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, Resident } from '@/api/client';
import { Screen } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

const targetLabels: Record<string, string> = {
  area: 'ملاك مجاورة',
  building: 'ملاك قطعة',
  owner: 'مالك معين',
};

export default function SendNotificationsScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Form Fields
  const [target, setTarget] = useState<'area' | 'building' | 'owner'>('area');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [buildingArea, setBuildingArea] = useState('');
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Pickers State
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showBuildingAreaPicker, setShowBuildingAreaPicker] = useState(false);
  const [showBuildingsPicker, setShowBuildingsPicker] = useState(false);
  const [showResidentPicker, setShowResidentPicker] = useState(false);

  async function load() {
    try {
      const list = await api.getResidents();
      setResidents(list);
    } catch (e) {
      console.error(e);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const areas = useMemo(() => {
    return Array.from(new Set(residents.map((r) => r.area).filter(Boolean))).sort();
  }, [residents]);

  const buildings = useMemo(() => {
    if (!buildingArea) return [];
    return Array.from(
      new Set(
        residents
          .filter((r) => r.area === buildingArea)
          .map((r) => r.buildingNo)
          .filter(Boolean)
      )
    ).sort();
  }, [residents, buildingArea]);

  async function send() {
    if (!title.trim() || !message.trim()) {
      Alert.alert('تنبيه', 'برجاء تعبئة العنوان ونص الرسالة');
      return;
    }

    if (target === 'area' && selectedAreas.length === 0) {
      Alert.alert('تنبيه', 'برجاء اختيار مجاورة واحدة على الأقل');
      return;
    }

    if (target === 'building') {
      if (!buildingArea) {
        Alert.alert('تنبيه', 'برجاء اختيار المجاورة');
        return;
      }
      if (selectedBuildings.length === 0) {
        Alert.alert('تنبيه', 'برجاء اختيار قطعة واحدة على الأقل');
        return;
      }
    }

    if (target === 'owner' && !selectedResident) {
      Alert.alert('تنبيه', 'برجاء اختيار المالك المستهدف');
      return;
    }

    setSending(true);
    try {
      let result;
      if (target === 'area') {
        result = await api.sendNotification({
          target: 'area',
          areas: selectedAreas,
          title: title.trim(),
          message: message.trim(),
        });
      } else if (target === 'building') {
        result = await api.sendNotification({
          target: 'building',
          area: buildingArea,
          buildings: selectedBuildings,
          title: title.trim(),
          message: message.trim(),
        });
      } else {
        result = await api.sendNotification({
          target: 'owner',
          residentId: selectedResident!.id,
          title: title.trim(),
          message: message.trim(),
        });
      }
      Alert.alert('تم بنجاح', `تم إرسال الإشعار بنجاح إلى ${result.sent} مستلم.`);
      setTitle('');
      setMessage('');
      setSelectedAreas([]);
      setBuildingArea('');
      setSelectedBuildings([]);
      setSelectedResident(null);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل إرسال الإشعار');
    } finally {
      setSending(false);
    }
  }

  function toggleAreaSelection(area: string) {
    if (selectedAreas.includes(area)) {
      setSelectedAreas(selectedAreas.filter((a) => a !== area));
    } else {
      setSelectedAreas([...selectedAreas, area]);
    }
  }

  function toggleBuildingSelection(bNo: string) {
    if (selectedBuildings.includes(bNo)) {
      setSelectedBuildings(selectedBuildings.filter((b) => b !== bNo));
    } else {
      setSelectedBuildings([...selectedBuildings, bNo]);
    }
  }

  return (
    <Screen
      title="إرسال إشعارات"
      back
      headerShown={false} // Custom header
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

      {/* 2. SUBHEADER & ACTIONS */}
      <View style={styles.subHeader}>
        <Text style={styles.pageTitle}>إرسال إشعارات</Text>
      </View>

      {/* 3. FORM FIELDS CONTAINER */}
      <View style={styles.formContainer}>
        {/* Recipient Target Trigger */}
        <Text style={styles.fieldLabel}>نوع المستلمين</Text>
        <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowTargetPicker(true)}>
          <Text style={styles.selectTriggerText}>{targetLabels[target]}</Text>
          <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
        </TouchableOpacity>

        {/* TARGET = AREA INPUTS */}
        {target === 'area' && (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>المجاورات المستهدفة</Text>
            <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowAreaPicker(true)}>
              <Text style={styles.selectTriggerText}>
                {selectedAreas.length > 0 ? `تم تحديد ${selectedAreas.length} مجاورة` : 'اختر المجاورات...'}
              </Text>
              <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
            </TouchableOpacity>
          </>
        )}

        {/* TARGET = BUILDING INPUTS */}
        {target === 'building' && (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>المجاورة</Text>
            <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowBuildingAreaPicker(true)}>
              <Text style={styles.selectTriggerText}>
                {buildingArea || 'اختر المجاورة...'}
              </Text>
              <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
            </TouchableOpacity>

            {buildingArea ? (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>القطع المستهدفة</Text>
                <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowBuildingsPicker(true)}>
                  <Text style={styles.selectTriggerText}>
                    {selectedBuildings.length > 0 ? `تم تحديد ${selectedBuildings.length} قطعة` : 'اختر القطع...'}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
                </TouchableOpacity>
              </>
            ) : null}
          </>
        )}

        {/* TARGET = OWNER INPUTS */}
        {target === 'owner' && (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>المالك المستهدف</Text>
            <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowResidentPicker(true)}>
              <Text style={styles.selectTriggerText}>
                {selectedResident
                  ? `${selectedResident.residentName} (${selectedResident.area}-${selectedResident.buildingNo})`
                  : 'اختر المالك...'}
              </Text>
              <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
            </TouchableOpacity>
          </>
        )}

        {/* Title Input */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>عنوان الإشعار</Text>
        <TextInput
          style={styles.fieldInput}
          value={title}
          onChangeText={setTitle}
          placeholder="ادخل عنوان الإشعار"
          placeholderTextColor="#94A3B8"
        />

        {/* Message Input */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>نص الإشعار</Text>
        <TextInput
          style={[styles.fieldInput, { height: 120, textAlignVertical: 'top', paddingVertical: 10 }]}
          value={message}
          onChangeText={setMessage}
          placeholder="ادخل نص الإشعار..."
          placeholderTextColor="#94A3B8"
          multiline={true}
        />

        {/* Action buttons */}
        <View style={styles.formActionsRow}>
          <TouchableOpacity style={styles.submitBtn} onPress={send} disabled={sending}>
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>إرسال الإشعار</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ===================== PICKER MODALS ===================== */}

      {/* A. TARGET TYPE PICKER */}
      <Modal
        visible={showTargetPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTargetPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر نوع المستلمين</Text>
            {Object.entries(targetLabels).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.pickerItem, target === value && styles.pickerItemActive]}
                onPress={() => {
                  setTarget(value as any);
                  setSelectedAreas([]);
                  setBuildingArea('');
                  setSelectedBuildings([]);
                  setSelectedResident(null);
                  setShowTargetPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, target === value && styles.pickerItemTextActive]}>
                  {label}
                </Text>
                {target === value && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowTargetPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* B. MULTI-SELECT AREAS CHECKBOX PICKER */}
      <Modal
        visible={showAreaPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAreaPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر المجاورات</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {areas.map((a) => {
                const isSelected = selectedAreas.includes(a);
                return (
                  <TouchableOpacity
                    key={a}
                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                    onPress={() => toggleAreaSelection(a)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={18}
                      color="#024C59"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                      {a}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowAreaPicker(false)}>
              <Text style={styles.closePickerBtnText}>موافق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* C. SINGLE AREA SELECT PICKER FOR BUILDING */}
      <Modal
        visible={showBuildingAreaPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBuildingAreaPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر المجاورة</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {areas.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.pickerItem, buildingArea === a && styles.pickerItemActive]}
                  onPress={() => {
                    setBuildingArea(a);
                    setSelectedBuildings([]);
                    setShowBuildingAreaPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, buildingArea === a && styles.pickerItemTextActive]}>
                    {a}
                  </Text>
                  {buildingArea === a && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowBuildingAreaPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* D. MULTI-SELECT BUILDINGS CHECKBOX PICKER */}
      <Modal
        visible={showBuildingsPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBuildingsPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر القطع</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {buildings.map((b) => {
                const isSelected = selectedBuildings.includes(b);
                return (
                  <TouchableOpacity
                    key={b}
                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                    onPress={() => toggleBuildingSelection(b)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={18}
                      color="#024C59"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                      {b}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowBuildingsPicker(false)}>
              <Text style={styles.closePickerBtnText}>موافق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* E. RESIDENT SELECT PICKER */}
      <Modal
        visible={showResidentPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResidentPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر المالك</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {residents.map((r) => {
                const isSelected = selectedResident?.id === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                    onPress={() => {
                      setSelectedResident(r);
                      setShowResidentPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                      {r.residentName} ({r.area}-{r.buildingNo})
                    </Text>
                    {isSelected && <Ionicons name="checkmark-sharp" size={16} color="#024C59" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowResidentPicker(false)}>
              <Text style={styles.closePickerBtnText}>إلغاء</Text>
            </TouchableOpacity>
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
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 6,
  },
  selectTrigger: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFD',
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectTriggerText: {
    fontSize: 13,
    color: '#1E293B',
  },
  fieldInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FAFBFD',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#1E293B',
    textAlign: 'right',
  },
  formActionsRow: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 24,
  },
  submitBtn: {
    height: 46,
    backgroundColor: '#024C59',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelBtn: {
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '700',
  },

  // DIALOG PICKERS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  pickerItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#FAFBFD',
  },
  pickerItemActive: {
    backgroundColor: '#E6F4F6',
    borderRadius: 8,
  },
  pickerItemText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'right',
  },
  pickerItemTextActive: {
    color: '#024C59',
    fontWeight: '700',
  },
  closePickerBtn: {
    marginTop: 16,
    height: 40,
    backgroundColor: '#FAFBFD',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePickerBtnText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
  },
});
