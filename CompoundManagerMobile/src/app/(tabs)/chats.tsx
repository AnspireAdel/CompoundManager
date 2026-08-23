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
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { api, ChatGroupSummary, ChatMessage, resolveUploadUrl, Resident } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { BottomTabInset } from '@/constants/theme';
import { Screen } from '@/components/screen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
              <Ionicons name="play" size={16} color={mine ? '#024C59' : '#fff'} />
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
                    <ActivityIndicator color="#024C59" />
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
              <Ionicons name="document-text-outline" size={22} color={mine ? '#fff' : '#024C59'} />
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
            <Ionicons name="open-outline" size={18} color={mine ? 'rgba(255,255,255,0.85)' : '#64748B'} />
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
  const { user: authUser } = useAuth();
  const insets = useSafeAreaInsets();
  const tabPad = BottomTabInset + Math.max(insets.bottom, 0);
  const isDependent = authUser?.role === 'DEPENDENT';
  const isSuperAdmin = authUser?.role === 'SUPERADMIN';

  const [groups, setGroups] = useState<ChatGroupSummary[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
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

  // Add Group State
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showMembersPicker, setShowMembersPicker] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Leave Group Confirm State
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const list = await api.getChats();
      setGroups(list);
      if (authUser?.role === 'SUPERADMIN' || authUser?.role === 'ADMIN' || authUser?.role === 'ACCOUNTANT') {
        const listRes = await api.getResidents();
        setResidents(listRes.filter((r) => r.user !== null));
      }
      return list;
    } catch (e) {
      console.error(e);
    }
  }, [authUser?.role]);

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
      if (selected && list) {
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
      Alert.alert('تم بنجاح', 'تم إرسال طلب الانضمام وبانتظار موافقة المدير الأعلى.');
      const list = await loadGroups();
      if (list) {
        const updated = list.find((x) => x.id === g.id);
        if (updated) setSelected(updated);
      }
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل طلب الانضمام');
    }
  }

  async function handleLeave() {
    if (!selected) return;
    setLeavingGroup(true);
    try {
      await api.leaveChat(selected.id);
      setSelected(null);
      setMessages([]);
      await loadGroups();
      setShowLeaveConfirm(false);
      Alert.alert('تم', 'لقد غادرت المجموعة بنجاح.');
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل مغادرة المجموعة');
    } finally {
      setLeavingGroup(false);
    }
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

  function openCreate() {
    setGroupName('');
    setGroupDesc('');
    setSelectedMemberIds([]);
    setShowAddGroupModal(true);
  }

  async function createGroup() {
    if (!groupName) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم المجموعة');
      return;
    }
    setCreatingGroup(true);
    try {
      await api.createChatGroup({
        name: groupName.trim(),
        description: groupDesc.trim() || null,
        memberIds: selectedMemberIds,
      });
      Alert.alert('تم بنجاح', 'تم إنشاء مجموعة المحادثة بنجاح.');
      setGroupName('');
      setGroupDesc('');
      setSelectedMemberIds([]);
      setShowAddGroupModal(false);
      loadGroups();
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error ? e.message : 'فشل إنشاء المجموعة');
    } finally {
      setCreatingGroup(false);
    }
  }

  function toggleMemberSelection(userId: number) {
    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== userId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId]);
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
        <ActivityIndicator size="large" color="#024C59" />
      </View>
    );
  }

  // INNER ROOM CHAT SCREEN
  if (selected) {
    return (
      <SafeAreaView style={styles.roomContainer} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          {/* Header Bar */}
          <View style={styles.chatHeader}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setSelected(null)}>
              <Ionicons name="chevron-forward" size={22} color="#024C59" />
            </TouchableOpacity>
            
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.chatTitle} numberOfLines={1}>{selected.name}</Text>
              <Text style={styles.chatSubtitle}>{memberLabel}</Text>
            </View>

            {selected.isMember && (
              <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowLeaveConfirm(true)}>
                <Ionicons name="exit-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>

          {/* Messages list / Join view */}
          {!selected.isMember ? (
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={36} color="#024C59" />
              </View>
              <Text style={styles.hint}>
                {selected.myJoinRequest?.status === 'PENDING'
                  ? 'طلب الانضمام قيد المراجعة حالياً من الإدارة.'
                  : 'أنت لست عضواً في هذه المجموعة حالياً.'}
              </Text>
              {selected.canJoin && !isDependent && (
                <TouchableOpacity style={styles.joinBtn} onPress={() => handleJoin(selected)}>
                  <Text style={styles.joinBtnText}>طلب انضمام للمجموعة</Text>
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#024C59" />}
                ListEmptyComponent={
                  <View style={styles.emptyMessages}>
                    <Ionicons name="chatbubble-ellipses-outline" size={32} color="#94A3B8" />
                    <Text style={styles.hint}>لا توجد أي رسائل في المجموعة بعد.</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <MessageBubble item={item} mine={item.userId === authUser?.id} />
                )}
              />

              {/* Composer Inputs */}
              {recording ? (
                <View style={[styles.recordBar, { paddingBottom: 12 + tabPad }]}>
                  <TouchableOpacity style={styles.recordCancel} onPress={cancelRecording}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
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
                <View style={[styles.composer, { paddingBottom: 10 + tabPad }]}>
                  <Pressable
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed, sending && styles.disabled]}
                    onPress={handleAttach}
                    disabled={sending}
                  >
                    <Ionicons name="attach-outline" size={22} color="#024C59" />
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
                      <Ionicons name="mic-outline" size={22} color="#024C59" />
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )}

          {/* LEAVE GROUP CONFIRM MODAL */}
          <Modal
            visible={showLeaveConfirm}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowLeaveConfirm(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.confirmCard}>
                <Ionicons name="exit-outline" size={32} color="#EF4444" style={{ marginBottom: 12 }} />
                <Text style={styles.confirmTitle}>مغادرة المجموعة</Text>
                <Text style={styles.confirmSubtext}>هل أنت متأكد من مغادرة المجموعة؟</Text>
                <Text style={styles.confirmTargetVal}>
                  "{selected.name}"
                </Text>
                
                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.confirmBtnYes, { backgroundColor: '#EF4444' }]}
                    onPress={handleLeave}
                    disabled={leavingGroup}
                  >
                    {leavingGroup ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.confirmBtnText}>مغادرة</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.confirmBtnNo]}
                    onPress={() => setShowLeaveConfirm(false)}
                  >
                    <Text style={styles.confirmBtnTextNo}>إلغاء</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // GROUP LIST SCREEN VIEW
  return (
    <Screen
      title="المحادثات"
      headerShown={false} // Custom header
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await loadGroups().catch(console.error);
        setRefreshing(false);
      }}
    >
      {/* 1. CUSTOM TOP HEADER */}
      <View style={styles.topHeader}>
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
        <Text style={styles.pageTitle}>المحادثات</Text>
        {isSuperAdmin && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            <Text style={styles.addBtnText}>إضافة مجموعة</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 3. GROUP SECTION HEADER */}
      <Text style={styles.sectionSubtitle}>المجموعات</Text>

      {/* 4. CHATS LIST CARDS */}
      <View style={styles.listContainer}>
        {groups.length === 0 ? (
          <View style={styles.emptyView}>
            <Ionicons name="chatbubbles-outline" size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>لا توجد أي مجموعات محادثة مسجلة</Text>
          </View>
        ) : (
          groups.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.cardItem}
              onPress={() => openGroup(item)}
              activeOpacity={0.75}
            >
              <View style={styles.cardRow}>
                <Ionicons name="chevron-back" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                
                <Text style={styles.cardCount}>
                  {item.membersCount} أعضاء
                </Text>

                <View style={styles.cardTextContainer}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                </View>

                <Ionicons name="grid-outline" size={18} color="#64748B" style={{ marginLeft: 10 }} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* 5. ADD GROUP SHEET MODAL */}
      <Modal
        visible={showAddGroupModal}
        animationType="slide"
        onRequestClose={() => setShowAddGroupModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        >
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setShowAddGroupModal(false)}>
              <Ionicons name="chevron-forward-outline" size={24} color="#024C59" />
            </TouchableOpacity>
            <Text style={styles.formHeaderTitle}>إضافة مجموعة</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>اسم المجموعة</Text>
            <TextInput
              style={styles.fieldInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="ادخل اسم المجموعة"
              placeholderTextColor="#94A3B8"
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>الوصف</Text>
            <TextInput
              style={[styles.fieldInput, { height: 100, textAlignVertical: 'top', paddingVertical: 10 }]}
              value={groupDesc}
              onChangeText={setGroupDesc}
              placeholder="ادخل الوصف..."
              placeholderTextColor="#94A3B8"
              multiline={true}
            />

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>أعضاء</Text>
            <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowMembersPicker(true)}>
              <Text style={styles.selectTriggerText}>
                {selectedMemberIds.length > 0 ? `تم تحديد ${selectedMemberIds.length} عضو` : 'اضف أعضاء...'}
              </Text>
              <Ionicons name="chevron-down-outline" size={16} color="#64748B" />
            </TouchableOpacity>

            {/* Action buttons */}
            <View style={styles.formActionsRow}>
              <TouchableOpacity style={styles.submitBtn} onPress={createGroup} disabled={creatingGroup}>
                {creatingGroup ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>انشاء المجموعة</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddGroupModal(false)}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* 6. MULTI-SELECT MEMBERS PICKER */}
      <Modal
        visible={showMembersPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMembersPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>اختر الأعضاء</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {residents.map((r) => {
                const uId = r.user?.id;
                if (!uId) return null;
                const isSelected = selectedMemberIds.includes(uId);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                    onPress={() => toggleMemberSelection(uId)}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={18}
                      color="#024C59"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                      {r.residentName} ({r.area}-{r.buildingNo})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowMembersPicker(false)}>
              <Text style={styles.closePickerBtnText}>موافق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  roomContainer: {
    flex: 1,
    backgroundColor: '#EEF3F8',
  },
  topHeader: {
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
  addBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#024C59',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listContainer: {
    gap: 8,
    paddingBottom: 24,
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCount: {
    fontSize: 13,
    color: '#64748B',
  },
  cardTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#024C59',
  },
  emptyView: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },

  // INNER ROOM STYLES
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hint: { textAlign: 'center', color: '#64748B', marginTop: 12, lineHeight: 20 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E6F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  joinBtn: {
    marginTop: 16,
    backgroundColor: '#024C59',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  joinBtnText: { color: '#fff', fontWeight: '700' },
  chatHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7FA',
  },
  chatTitle: { fontWeight: '800', fontSize: 15, textAlign: 'right', color: '#1E293B' },
  chatSubtitle: { fontSize: 11, color: '#64748B', textAlign: 'right', marginTop: 2 },
  messages: { padding: 14, paddingBottom: 10, flexGrow: 1 },
  bubbleWrap: { marginBottom: 12 },
  mineWrap: { alignItems: 'flex-start' },
  theirWrap: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mine: {
    backgroundColor: '#024C59',
    borderBottomLeftRadius: 6,
  },
  their: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomRightRadius: 6,
  },
  sender: { fontSize: 11, color: '#64748B', marginBottom: 4, textAlign: 'right', fontWeight: '600' },
  body: { fontSize: 14, color: '#1E293B', textAlign: 'right', lineHeight: 21 },
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
    borderColor: '#E2E8F0',
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
    color: '#024C59',
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
    backgroundColor: '#E6F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconWrapMine: { backgroundColor: 'rgba(255,255,255,0.2)' },
  fileName: { fontSize: 13, fontWeight: '600', textAlign: 'right', color: '#1E293B' },
  fileMeta: { fontSize: 11, color: '#64748B', textAlign: 'right', marginTop: 2 },
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
    backgroundColor: '#024C59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioIconMine: { backgroundColor: '#fff' },
  time: { fontSize: 10, color: '#94A3B8', marginTop: 6, textAlign: 'left' },
  mineTime: { color: 'rgba(255,255,255,0.7)' },
  emptyMessages: { alignItems: 'center', paddingTop: 48 },
  composer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: { opacity: 0.7 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 110,
    fontSize: 14,
    backgroundColor: '#FAFBFD',
    color: '#1E293B',
    textAlign: 'right',
  },
  sendCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#024C59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  recordBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  recordCancel: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInfo: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  recordDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordTimer: { fontWeight: '800', color: '#EF4444', fontVariant: ['tabular-nums'] },
  recordHint: { color: '#64748B', fontSize: 13 },
  recordSend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#024C59',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // DIALOG CONFIRM MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCard: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  confirmSubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmTargetVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#024C59',
    marginTop: 10,
    marginBottom: 24,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnYes: {
    backgroundColor: '#024C59',
  },
  confirmBtnNo: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  confirmBtnTextNo: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
  },

  // SHEET FORM MODAL STYLES
  formHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  formHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  formScroll: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'right',
    marginBottom: 6,
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
  formActionsRow: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
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

  // CUSTOM SELECT PICKER LISTS
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
