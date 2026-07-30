import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Linking,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { api, ChatGroupSummary, ChatMessage, resolveUploadUrl } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Brand } from '@/constants/theme';

const PRIMARY = Brand.primary;
const PRIMARY_DARK = Brand.primaryDark;
const BG = Brand.background;
const SURFACE = Brand.surface;
const MUTED = Brand.muted;
const BORDER = Brand.border;
const DANGER = Brand.danger;

function formatBytes(n?: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isImageMime(mime?: string | null) {
  return Boolean(mime?.startsWith('image/'));
}

function isVideoMime(mime?: string | null, name?: string | null) {
  return Boolean(mime?.startsWith('video/') || name?.match(/\.(mp4|webm|mov|m4v)$/i));
}

function isPdfMime(mime?: string | null, name?: string | null) {
  return mime === 'application/pdf' || Boolean(name?.toLowerCase().endsWith('.pdf'));
}

function isAudioMsg(item: ChatMessage) {
  return (
    item.messageType === 'AUDIO' ||
    Boolean(item.mimeType?.startsWith('audio/'))
  );
}

function groupInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'م';
  if (parts.length === 1) return parts[0].slice(0, 1);
  return (parts[0][0] + parts[1][0]).slice(0, 2);
}

function FileLink({
  url,
  label,
  size,
  mine,
}: {
  url: string;
  label: string;
  size?: number | null;
  mine: boolean;
}) {
  return (
    <TouchableOpacity onPress={() => Linking.openURL(url)} activeOpacity={0.7}>
      <Text style={[styles.fileLink, mine && styles.fileLinkMine]} numberOfLines={2}>
        {label}
        {size ? ` (${formatBytes(size)})` : ''}
      </Text>
    </TouchableOpacity>
  );
}

function VideoPreview({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
    />
  );
}

function MessageBubble({ item, mine }: { item: ChatMessage; mine: boolean }) {
  const [url, setUrl] = useState('');
  const image = isImageMime(item.mimeType);
  const video = isVideoMime(item.mimeType, item.fileName);
  const pdf = isPdfMime(item.mimeType, item.fileName);
  const audio = isAudioMsg(item);

  useEffect(() => {
    let cancelled = false;
    resolveUploadUrl(item.filePath).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [item.filePath]);

  return (
    <View style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.theirWrap]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.their]}>
        {!mine && <Text style={styles.sender}>{item.user.name}</Text>}

        {audio && url ? (
          <TouchableOpacity
            style={[styles.audioRow, mine && styles.audioRowMine]}
            onPress={() => {
              try {
                const player = createAudioPlayer(url);
                player.play();
              } catch {
                Alert.alert('خطأ', 'تعذر تشغيل الصوت');
              }
            }}
            activeOpacity={0.75}
          >
            <View style={[styles.audioIcon, mine && styles.audioIconMine]}>
              <Ionicons name="play" size={16} color={mine ? PRIMARY : '#fff'} />
            </View>
            <Text style={[styles.body, mine && styles.mineBody]}>رسالة صوتية</Text>
          </TouchableOpacity>
        ) : item.filePath && url && image ? (
          <View style={styles.mediaBlock}>
            <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
            <FileLink
              url={url}
              label={item.fileName || 'صورة'}
              size={item.fileSize}
              mine={mine}
            />
          </View>
        ) : item.filePath && url && video ? (
          <View style={styles.mediaBlock}>
            <VideoPreview url={url} />
            <FileLink
              url={url}
              label={item.fileName || 'فيديو'}
              size={item.fileSize}
              mine={mine}
            />
          </View>
        ) : item.filePath && url && pdf ? (
          <View style={styles.mediaBlock}>
            <View style={styles.pdfFrame}>
              <WebView
                source={{ uri: url }}
                style={styles.pdfWeb}
                originWhitelist={['*']}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.pdfLoading}>
                    <ActivityIndicator color={PRIMARY} />
                  </View>
                )}
              />
            </View>
            <FileLink
              url={url}
              label={item.fileName || 'PDF'}
              size={item.fileSize}
              mine={mine}
            />
          </View>
        ) : item.filePath && url && item.messageType !== 'TEXT' ? (
          <TouchableOpacity
            style={[styles.fileCard, mine && styles.fileCardMine]}
            onPress={() => Linking.openURL(url)}
            activeOpacity={0.75}
          >
            <View style={[styles.fileIconWrap, mine && styles.fileIconWrapMine]}>
              <Ionicons name="document-text-outline" size={22} color={mine ? '#fff' : PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fileName, mine && styles.mineBody]} numberOfLines={2}>
                {item.fileName || 'ملف مرفق'}
              </Text>
              {!!item.fileSize && (
                <Text style={[styles.fileMeta, mine && styles.mineMeta]}>
                  {formatBytes(item.fileSize)}
                </Text>
              )}
            </View>
            <Ionicons name="open-outline" size={18} color={mine ? 'rgba(255,255,255,0.85)' : MUTED} />
          </TouchableOpacity>
        ) : (
          <Text style={[styles.body, mine && styles.mineBody]}>{item.body}</Text>
        )}

        {item.messageType &&
          item.messageType !== 'TEXT' &&
          item.body &&
          item.body !== item.fileName &&
          item.body !== 'رسالة صوتية' && (
            <Text style={[styles.body, mine && styles.mineBody, { marginTop: 6 }]}>{item.body}</Text>
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
  const [recordSecs, setRecordSecs] = useState(0);
  const listRef = useRef<FlatList>(null);
  const discardRecordingRef = useRef(false);
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

  useEffect(() => {
    if (!recording) {
      setRecordSecs(0);
      return;
    }
    const t = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

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
        type: ['image/*', 'video/*', 'application/pdf', '*/*'],
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

  async function cancelRecording() {
    if (!recording) return;
    discardRecordingRef.current = true;
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      /* ignore */
    } finally {
      discardRecordingRef.current = false;
      setRecordSecs(0);
    }
  }

  async function toggleRecording() {
    if (!selected || sending) return;

    if (recording) {
      try {
        await audioRecorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          return;
        }
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
        setRecordSecs(0);
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

  const memberLabel = useMemo(() => {
    if (!selected) return '';
    if (selected.isMember) return `${selected.membersCount} أعضاء`;
    if (selected.myJoinRequest?.status === 'PENDING') return 'طلب قيد المراجعة';
    return 'متاحة للانضمام';
  }, [selected]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
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
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setSelected(null)}>
              <Ionicons name="chevron-forward" size={22} color={PRIMARY} />
            </TouchableOpacity>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{groupInitials(selected.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatTitle} numberOfLines={1}>{selected.name}</Text>
              <Text style={styles.chatSubtitle}>{memberLabel}</Text>
            </View>
            {selected.isMember && (
              <TouchableOpacity style={styles.headerIconBtn} onPress={handleLeave}>
                <Ionicons name="exit-outline" size={20} color={DANGER} />
              </TouchableOpacity>
            )}
          </View>

          {!selected.isMember ? (
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={36} color={PRIMARY} />
              </View>
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
                ListEmptyComponent={
                  <View style={styles.emptyMessages}>
                    <Ionicons name="chatbubble-ellipses-outline" size={32} color="#94A3B8" />
                    <Text style={styles.hint}>لا رسائل بعد — ابدأ المحادثة</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <MessageBubble item={item} mine={item.userId === user?.id} />
                )}
              />

              {recording ? (
                <View style={styles.recordBar}>
                  <TouchableOpacity style={styles.recordCancel} onPress={cancelRecording}>
                    <Ionicons name="trash-outline" size={20} color={DANGER} />
                  </TouchableOpacity>
                  <View style={styles.recordInfo}>
                    <View style={styles.recordDot} />
                    <Text style={styles.recordTimer}>{formatDuration(recordSecs)}</Text>
                    <Text style={styles.recordHint}>جاري التسجيل...</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.recordSend}
                    onPress={toggleRecording}
                    disabled={sending}
                  >
                    {sending ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Ionicons name="send" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.composer}>
                  <Pressable
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed, (sending) && styles.disabled]}
                    onPress={handleAttach}
                    disabled={sending}
                  >
                    <Ionicons name="attach" size={22} color={PRIMARY} />
                  </Pressable>
                  <TextInput
                    style={styles.input}
                    value={text}
                    onChangeText={setText}
                    placeholder="اكتب رسالة..."
                    placeholderTextColor="#94A3B8"
                    textAlign="right"
                    multiline
                    editable={!sending}
                  />
                  {text.trim() ? (
                    <TouchableOpacity
                      style={[styles.sendCircle, sending && styles.disabled]}
                      onPress={handleSend}
                      disabled={sending}
                    >
                      {sending ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Ionicons name="send" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed, sending && styles.disabled]}
                      onPress={toggleRecording}
                      disabled={sending}
                    >
                      <Ionicons name="mic" size={22} color={PRIMARY} />
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.listHeader}>
        <Text style={styles.title}>المحادثات</Text>
        <Text style={styles.listSubtitle}>{groups.length} مجموعة</Text>
      </View>
      <FlatList
        data={groups}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Ionicons name="people-outline" size={36} color="#94A3B8" />
            <Text style={styles.hint}>لا توجد مجموعات محادثة بعد</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openGroup(item)} activeOpacity={0.75}>
            <View style={styles.cardRow}>
              <View style={styles.cardAvatar}>
                <Text style={styles.cardAvatarText}>{groupInitials(item.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {!!item.description && (
                  <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
                )}
                <View style={styles.cardMetaRow}>
                  <View style={[
                    styles.badge,
                    item.isMember ? styles.badgeMember : styles.badgeGuest,
                  ]}>
                    <Text style={[
                      styles.badgeText,
                      item.isMember ? styles.badgeTextMember : styles.badgeTextGuest,
                    ]}>
                      {item.isMember
                        ? `عضو · ${item.membersCount}`
                        : item.myJoinRequest?.status === 'PENDING'
                          ? 'قيد المراجعة'
                          : 'متاحة'}
                    </Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-back" size={18} color="#94A3B8" />
            </View>
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
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'right', color: '#0F172A' },
  listSubtitle: { textAlign: 'right', color: MUTED, marginTop: 2, fontSize: 13 },
  list: { padding: 16, paddingTop: 10 },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: { color: PRIMARY_DARK, fontWeight: '800', fontSize: 15 },
  cardTitle: { fontSize: 16, fontWeight: '700', textAlign: 'right', color: '#0F172A' },
  cardDesc: { color: MUTED, textAlign: 'right', marginTop: 3, fontSize: 13 },
  cardMetaRow: { marginTop: 8, alignItems: 'flex-end' },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeMember: { backgroundColor: Brand.primarySoft },
  badgeGuest: { backgroundColor: '#F1F5F9' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextMember: { color: PRIMARY_DARK },
  badgeTextGuest: { color: MUTED },
  hint: { textAlign: 'center', color: MUTED, marginTop: 12, lineHeight: 20 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyMessages: { alignItems: 'center', paddingTop: 48 },
  joinBtn: {
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  joinBtnSmall: {
    marginTop: 12,
    alignSelf: 'flex-end',
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  joinBtnText: { color: '#fff', fontWeight: '700' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: PRIMARY_DARK, fontWeight: '800' },
  chatTitle: { fontWeight: '700', fontSize: 16, textAlign: 'right', color: '#0F172A' },
  chatSubtitle: { fontSize: 12, color: MUTED, textAlign: 'right', marginTop: 1 },
  messages: { padding: 14, paddingBottom: 10, flexGrow: 1 },
  bubbleWrap: { marginBottom: 12 },
  mineWrap: { alignItems: 'flex-start' },
  theirWrap: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mine: {
    backgroundColor: PRIMARY,
    borderBottomLeftRadius: 6,
  },
  their: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomRightRadius: 6,
  },
  sender: { fontSize: 11, color: MUTED, marginBottom: 4, textAlign: 'right', fontWeight: '600' },
  body: { fontSize: 15, color: '#0F172A', textAlign: 'right', lineHeight: 22 },
  mineBody: { color: '#fff' },
  mineMeta: { color: 'rgba(255,255,255,0.75)' },
  mediaBlock: { gap: 6 },
  image: { width: 220, height: 170, borderRadius: 12, backgroundColor: '#0F172A10' },
  video: {
    width: 240,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  pdfFrame: {
    width: 240,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
  },
  pdfWeb: { flex: 1, backgroundColor: '#fff' },
  pdfLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  fileLink: {
    fontSize: 12,
    color: PRIMARY,
    textDecorationLine: 'underline',
    textAlign: 'right',
  },
  fileLinkMine: { color: 'rgba(255,255,255,0.92)' },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
    paddingVertical: 4,
  },
  fileCardMine: {},
  fileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconWrapMine: { backgroundColor: 'rgba(255,255,255,0.2)' },
  fileName: { fontSize: 14, fontWeight: '600', textAlign: 'right', color: '#0F172A' },
  fileMeta: { fontSize: 11, color: MUTED, textAlign: 'right', marginTop: 2 },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 150,
  },
  audioRowMine: {},
  audioIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioIconMine: { backgroundColor: '#fff' },
  time: { fontSize: 10, color: '#94A3B8', marginTop: 6, textAlign: 'left' },
  mineTime: { color: 'rgba(255,255,255,0.7)' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: { opacity: 0.7 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 110,
    fontSize: 15,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
  },
  sendCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  recordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  recordCancel: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  recordDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DANGER,
  },
  recordTimer: { fontWeight: '800', color: DANGER, fontVariant: ['tabular-nums'] },
  recordHint: { color: MUTED, fontSize: 13 },
  recordSend: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
