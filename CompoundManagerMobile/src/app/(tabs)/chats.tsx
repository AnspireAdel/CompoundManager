import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, RefreshControl,
  Linking, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { api, ChatGroupSummary, ChatMessage, UPLOADS_BASE } from '@/api/client';
import { useAuth } from '@/context/AuthContext';

function fileUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${UPLOADS_BASE}${path}`;
}

function MessageBubble({ item, mine }: { item: ChatMessage; mine: boolean }) {
  const url = fileUrl(item.filePath);
  const isImage = Boolean(item.mimeType?.startsWith('image/'));

  return (
    <View style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.theirWrap]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.their]}>
        {!mine && <Text style={styles.sender}>{item.user.name}</Text>}

        {(item.messageType === 'AUDIO' || (!item.messageType && item.mimeType?.startsWith('audio/'))) && url ? (
          <TouchableOpacity
            onPress={() => {
              try {
                const player = createAudioPlayer(url);
                player.play();
              } catch {
                Alert.alert('خطأ', 'تعذر تشغيل الصوت');
              }
            }}
          >
            <Text style={[styles.body, mine && styles.mineBody]}>▶ رسالة صوتية</Text>
          </TouchableOpacity>
        ) : (item.messageType === 'FILE' || item.filePath) && url && isImage ? (
          <TouchableOpacity onPress={() => Linking.openURL(url)}>
            <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
          </TouchableOpacity>
        ) : item.filePath && url && item.messageType !== 'TEXT' ? (
          <TouchableOpacity onPress={() => Linking.openURL(url)}>
            <Text style={[styles.link, mine && styles.mineBody]}>
              📎 {item.fileName || 'ملف مرفق'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.body, mine && styles.mineBody]}>{item.body}</Text>
        )}

        {item.messageType &&
          item.messageType !== 'TEXT' &&
          item.body &&
          item.body !== item.fileName &&
          item.body !== 'رسالة صوتية' && (
            <Text style={[styles.body, mine && styles.mineBody, { marginTop: 4 }]}>{item.body}</Text>
          )}

        <Text style={[styles.time, mine && styles.mineTime]}>
          {new Date(item.createdAt).toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

export default function ChatsScreen() {
  const { user } = useAuth();
  const isDependent = user?.role === 'DEPENDENT';
  const [groups, setGroups] = useState<ChatGroupSummary[]>([]);
  const [selected, setSelected] = useState<ChatGroupSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const recording = recorderState.isRecording;

  const loadGroups = useCallback(async () => {
    const list = await api.getChats();
    setGroups(list);
    return list;
  }, []);

  const loadMessages = useCallback(async (id: number) => {
    const msgs = await api.getChatMessages(id);
    setMessages(msgs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          await loadGroups();
        } catch (e) {
          Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل التحميل');
        } finally {
          setLoading(false);
        }
      })();
    }, [loadGroups])
  );

  useEffect(() => {
    if (!selected?.isMember) return;
    const t = setInterval(() => {
      loadMessages(selected.id).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [selected?.id, selected?.isMember, loadMessages]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      const list = await loadGroups();
      if (selected) {
        const updated = list.find((g) => g.id === selected.id) || null;
        setSelected(updated);
        if (updated?.isMember) await loadMessages(updated.id);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function openGroup(g: ChatGroupSummary) {
    setSelected(g);
    setMessages([]);
    if (g.isMember) {
      try {
        await loadMessages(g.id);
      } catch (e) {
        Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل فتح المحادثة');
      }
    }
  }

  async function handleJoin(g: ChatGroupSummary) {
    if (isDependent) return;
    try {
      await api.requestChatJoin(g.id);
      Alert.alert('تم', 'تم إرسال طلب الانضمام وبانتظار موافقة المدير الأعلى');
      const list = await loadGroups();
      const updated = list.find((x) => x.id === g.id);
      if (updated) setSelected(updated);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل طلب الانضمام');
    }
  }

  async function handleLeave() {
    if (!selected) return;
    Alert.alert('تأكيد', 'مغادرة هذه المجموعة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'مغادرة',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.leaveChat(selected.id);
            setSelected(null);
            setMessages([]);
            await loadGroups();
          } catch (e) {
            Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل المغادرة');
          }
        },
      },
    ]);
  }

  async function handleSend() {
    if (!selected || !text.trim()) return;
    setSending(true);
    try {
      const msg = await api.sendChatMessage(selected.id, text.trim());
      setMessages((prev) => [...prev, msg]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل الإرسال');
    } finally {
      setSending(false);
    }
  }

  async function handleAttach() {
    if (!selected || sending || recording) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const uri =
        file.uri.startsWith('file://') || file.uri.startsWith('content://')
          ? file.uri
          : `file://${file.uri}`;

      setSending(true);
      const msg = await api.sendChatAttachment(
        selected.id,
        {
          uri,
          name: file.name || `file-${Date.now()}`,
          mimeType: file.mimeType || undefined,
        },
        {
          messageType: file.mimeType?.startsWith('audio/') ? 'AUDIO' : 'FILE',
        }
      );
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل رفع الملف');
    } finally {
      setSending(false);
    }
  }

  async function toggleRecording() {
    if (!selected || sending) return;

    if (recording) {
      try {
        await audioRecorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        const uri = audioRecorder.uri;
        if (!uri) return;
        setSending(true);
        const msg = await api.sendChatAttachment(
          selected.id,
          {
            uri,
            name: `voice-${Date.now()}.m4a`,
            mimeType: 'audio/m4a',
          },
          { messageType: 'AUDIO' }
        );
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      } catch (e) {
        Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل إرسال التسجيل');
      } finally {
        setSending(false);
      }
      return;
    }

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('تنبيه', 'يلزم السماح بالوصول إلى الميكروفون');
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'تعذر بدء التسجيل');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (selected) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.back}>رجوع</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatTitle}>{selected.name}</Text>
            </View>
            {selected.isMember && (
              <TouchableOpacity onPress={handleLeave}>
                <Text style={styles.leave}>مغادرة</Text>
              </TouchableOpacity>
            )}
          </View>

          {!selected.isMember ? (
            <View style={styles.center}>
              <Text style={styles.hint}>
                {selected.myJoinRequest?.status === 'PENDING'
                  ? 'طلب الانضمام قيد المراجعة'
                  : 'لست عضواً في هذه المجموعة'}
              </Text>
              {selected.canJoin && !isDependent && (
                <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoin(selected)}>
                  <Text style={styles.joinBtnText}>طلب انضمام</Text>
                </TouchableOpacity>
              )}
              {isDependent && !selected.isMember && (
                <Text style={styles.hint}>تعرض محادثات المالك فقط بعد انضمامه</Text>
              )}
            </View>
          ) : (
            <>
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.messages}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={<Text style={styles.hint}>لا رسائل بعد</Text>}
                renderItem={({ item }) => (
                  <MessageBubble item={item} mine={item.userId === user?.id} />
                )}
              />
              <View style={styles.composerCol}>
                <View style={styles.composer}>
                  <TextInput
                    style={styles.input}
                    value={text}
                    onChangeText={setText}
                    placeholder="اكتب رسالة..."
                    textAlign="right"
                    multiline
                    editable={!sending && !recording}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, (!text.trim() || sending || recording) && styles.sendDisabled]}
                    onPress={handleSend}
                    disabled={!text.trim() || sending || recording}
                  >
                    {sending && !recording ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.sendText}>إرسال</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, (sending || recording) && styles.sendDisabled]}
                    onPress={handleAttach}
                    disabled={sending || recording}
                  >
                    <Text style={styles.actionText}>📎 ملف</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, recording && styles.recordingBtn, sending && styles.sendDisabled]}
                    onPress={toggleRecording}
                    disabled={sending}
                  >
                    <Text style={[styles.actionText, recording && styles.recordingText]}>
                      {recording ? '⏹ إيقاف وإرسال' : '🎙 تسجيل'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>المحادثات</Text>
      <FlatList
        data={groups}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.hint}>لا توجد مجموعات محادثة بعد</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openGroup(item)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            {!!item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
            <Text style={styles.cardMeta}>
              {item.isMember
                ? `عضو · ${item.membersCount} أعضاء`
                : item.myJoinRequest?.status === 'PENDING'
                  ? 'طلب قيد المراجعة'
                  : 'متاحة للانضمام'}
            </Text>
            {!item.isMember && item.canJoin && !isDependent && (
              <TouchableOpacity
                style={styles.joinBtnSmall}
                onPress={() => handleJoin(item)}
              >
                <Text style={styles.joinBtnText}>طلب انضمام</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'right', padding: 16, paddingBottom: 8 },
  list: { padding: 16, paddingTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', textAlign: 'right' },
  cardDesc: { color: '#64748b', textAlign: 'right', marginTop: 4, fontSize: 13 },
  cardMeta: { color: '#2563eb', textAlign: 'right', marginTop: 8, fontSize: 12, fontWeight: '600' },
  hint: { textAlign: 'center', color: '#64748b', marginTop: 24 },
  joinBtn: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  joinBtnSmall: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  joinBtnText: { color: '#fff', fontWeight: '600' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  back: { color: '#2563eb', fontWeight: '600' },
  leave: { color: '#dc2626', fontWeight: '600' },
  chatTitle: { fontWeight: '700', fontSize: 16, textAlign: 'right' },
  messages: { padding: 16, paddingBottom: 8 },
  bubbleWrap: { marginBottom: 10 },
  mineWrap: { alignItems: 'flex-start' },
  theirWrap: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { backgroundColor: '#2563eb' },
  their: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  sender: { fontSize: 11, color: '#64748b', marginBottom: 2, textAlign: 'right' },
  body: { fontSize: 15, color: '#0f172a', textAlign: 'right' },
  mineBody: { color: '#fff' },
  link: { fontSize: 15, color: '#0f172a', textDecorationLine: 'underline', textAlign: 'right' },
  image: { width: 200, height: 160, borderRadius: 8 },
  time: { fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'left' },
  mineTime: { color: 'rgba(255,255,255,0.7)' },
  composerCol: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingBottom: 8,
  },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  recordingBtn: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  actionText: { color: '#0f172a', fontWeight: '600', fontSize: 13 },
  recordingText: { color: '#dc2626' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 64,
    alignItems: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '600' },
});
