import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Mic,
  Paperclip,
  Send,
  Square,
  Users,
  X,
  Trash2,
  LogOut,
  Plus,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { ChatGroupDetail, ChatGroupSummary, ChatMessage, ChatUserRef, User } from '@/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, FormField, FormRow, PageHeader } from '@/components/ui-helpers';
import { cn } from '@/lib/utils';

function formatBytes(n?: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function memberUnitLine(u?: ChatUserRef | null) {
  const area = u?.resident?.area;
  const building = u?.resident?.buildingNo;
  if (!area && !building) return null;
  return [building, area].filter(Boolean).join(' / ');
}

function memberPhone(u?: ChatUserRef | null) {
  return u?.dependent?.mobile || u?.resident?.mobile || null;
}

function MessageContent({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const linkClass = mine ? 'underline opacity-90' : 'underline text-primary';
  const type = m.messageType || 'TEXT';
  if (type === 'AUDIO' && m.filePath) {
    return (
      <div className="space-y-1">
        <audio controls src={m.filePath} className="max-w-full" preload="metadata" />
        {m.body && m.body !== 'رسالة صوتية' && (
          <div className="whitespace-pre-wrap">{m.body}</div>
        )}
      </div>
    );
  }
  if (type === 'FILE' && m.filePath) {
    const isImage = Boolean(m.mimeType?.startsWith('image/'));
    return (
      <div className="space-y-1">
        {isImage ? (
          <a href={m.filePath} target="_blank" rel="noreferrer">
            <img src={m.filePath} alt={m.fileName || 'صورة'} className="max-h-48 max-w-full rounded-md" />
          </a>
        ) : (
          <a href={m.filePath} target="_blank" rel="noreferrer" className={linkClass} download={m.fileName || undefined}>
            📎 {m.fileName || 'ملف مرفق'}
            {m.fileSize ? ` (${formatBytes(m.fileSize)})` : ''}
          </a>
        )}
        {m.body && m.body !== m.fileName && (
          <div className="whitespace-pre-wrap">{m.body}</div>
        )}
      </div>
    );
  }
  return <div className="whitespace-pre-wrap">{m.body}</div>;
}

function sameMessages(a: ChatMessage[], b: ChatMessage[]) {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  return lastA.id === lastB.id && a[0].id === b[0].id;
}

export default function ChatsPage() {
  const { user, isSuperAdmin } = useAuth();
  const [groups, setGroups] = useState<ChatGroupSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ChatGroupDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [addMemberId, setAddMemberId] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const discardRecordingRef = useRef(false);
  const recordTimerRef = useRef<number | null>(null);

  const loadGroups = useCallback(async () => {
    const list = await api.getChats();
    setGroups(list);
    return list;
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    const [d, msgs] = await Promise.all([api.getChat(id), api.getChatMessages(id)]);
    setDetail(d);
    setMessages(msgs);
    stickToBottomRef.current = true;
  }, []);

  function scrollMessagesToBottom(smooth = false) {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }

  function handleMessagesScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  }

  useEffect(() => {
    (async () => {
      try {
        const list = await loadGroups();
        if (isSuperAdmin) {
          const users = await api.getUsers({ status: 'APPROVED' });
          setAllUsers(users.filter((u) => u.id !== user?.id));
        }
        const firstMember = list.find((g) => g.isMember);
        if (firstMember) {
          setSelectedId(firstMember.id);
          await loadDetail(firstMember.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل التحميل');
      } finally {
        setLoading(false);
      }
    })();
  }, [isSuperAdmin, loadDetail, loadGroups, user?.id]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollMessagesToBottom(false);
  }, [messages, selectedId]);

  useEffect(() => {
    if (!selectedId || !detail?.isMember) return;
    const t = setInterval(() => {
      api.getChatMessages(selectedId).then((msgs) => {
        setMessages((prev) => (sameMessages(prev, msgs) ? prev : msgs));
      }).catch(() => {});
      if (isSuperAdmin) {
        api.getChat(selectedId).then(setDetail).catch(() => {});
      }
    }, 4000);
    return () => clearInterval(t);
  }, [selectedId, detail?.isMember, isSuperAdmin]);

  useEffect(() => {
    if (!recording) {
      setRecordSecs(0);
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      return;
    }
    setRecordSecs(0);
    recordTimerRef.current = window.setInterval(() => {
      setRecordSecs((s) => s + 1);
    }, 1000);
    return () => {
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    };
  }, [recording]);

  async function selectGroup(id: number) {
    setSelectedId(id);
    setShowMembers(false);
    setError('');
    setMessage('');
    try {
      await loadDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل فتح المجموعة');
      setDetail(null);
      setMessages([]);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await api.createChat({
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        memberIds: selectedMemberIds,
      });
      setCreateForm({ name: '', description: '' });
      setSelectedMemberIds([]);
      setShowCreate(false);
      await loadGroups();
      setSelectedId(created.id);
      await loadDetail(created.id);
      setMessage('تم إنشاء المجموعة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإنشاء');
    } finally {
      setSaving(false);
    }
  }

  async function handleJoin(id: number) {
    try {
      await api.requestChatJoin(id);
      setMessage('تم إرسال طلب الانضمام — بانتظار موافقة المدير الأعلى');
      await loadGroups();
      if (selectedId === id) await loadDetail(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل طلب الانضمام');
    }
  }

  async function handleLeave(id: number) {
    if (!window.confirm('مغادرة هذه المجموعة؟')) return;
    try {
      await api.leaveChat(id);
      setMessage('تمت مغادرة المجموعة');
      setShowMembers(false);
      const list = await loadGroups();
      if (selectedId === id) {
        const next = list.find((g) => g.isMember);
        if (next) {
          setSelectedId(next.id);
          await loadDetail(next.id);
        } else {
          setSelectedId(null);
          setDetail(null);
          setMessages([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل المغادرة');
    }
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    if (!selectedId || !messageText.trim() || sending || recording) return;
    setSending(true);
    stickToBottomRef.current = true;
    try {
      const msg = await api.sendChatMessage(selectedId, messageText.trim());
      setMessages((prev) => [...prev, msg]);
      setMessageText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  }

  async function handleFileSelected(file: File | null) {
    if (!selectedId || !file || sending || recording) return;
    setSending(true);
    setError('');
    stickToBottomRef.current = true;
    try {
      const msg = await api.sendChatAttachment(selectedId, file, {
        messageType: file.type.startsWith('audio/') ? 'AUDIO' : 'FILE',
      });
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل رفع الملف');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function stopRecordingTracks() {
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordingStreamRef.current = null;
  }

  function cancelRecording() {
    if (!recording) return;
    discardRecordingRef.current = true;
    mediaRecorderRef.current?.stop();
  }

  function finishRecording() {
    if (!recording) return;
    discardRecordingRef.current = false;
    mediaRecorderRef.current?.stop();
  }

  async function startRecording() {
    if (!selectedId || sending || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mime =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      discardRecordingRef.current = false;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        setRecording(false);
        stopRecordingTracks();
        const discarded = discardRecordingRef.current;
        discardRecordingRef.current = false;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        if (discarded || !selectedId || blob.size === 0) return;
        const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
        setSending(true);
        stickToBottomRef.current = true;
        try {
          const msg = await api.sendChatAttachment(selectedId, file, { messageType: 'AUDIO' });
          setMessages((prev) => [...prev, msg]);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'فشل إرسال التسجيل');
        } finally {
          setSending(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('تعذر الوصول إلى الميكروفون');
      stopRecordingTracks();
      setRecording(false);
    }
  }

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        discardRecordingRef.current = true;
        mediaRecorderRef.current.stop();
      }
      stopRecordingTracks();
    };
  }, []);

  async function handleAddMember() {
    if (!selectedId || !addMemberId) return;
    try {
      await api.addChatMembers(selectedId, [Number(addMemberId)]);
      setAddMemberId('');
      await loadDetail(selectedId);
      await loadGroups();
      setMessage('تمت إضافة العضو');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إضافة العضو');
    }
  }

  async function handleRemoveMember(userId: number) {
    if (!selectedId || !window.confirm('إزالة هذا العضو من المجموعة؟')) return;
    try {
      await api.removeChatMember(selectedId, userId);
      await loadDetail(selectedId);
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إزالة العضو');
    }
  }

  async function handleApprove(requestId: number) {
    if (!selectedId) return;
    try {
      await api.approveChatJoin(selectedId, requestId);
      await loadDetail(selectedId);
      await loadGroups();
      setMessage('تمت الموافقة على الطلب');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الموافقة');
    }
  }

  async function handleReject(requestId: number) {
    if (!selectedId) return;
    try {
      await api.rejectChatJoin(selectedId, requestId);
      await loadDetail(selectedId);
      setMessage('تم رفض الطلب');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الرفض');
    }
  }

  async function handleDeleteGroup() {
    if (!selectedId || !window.confirm('حذف هذه المجموعة نهائياً؟')) return;
    try {
      await api.deleteChat(selectedId);
      setSelectedId(null);
      setDetail(null);
      setMessages([]);
      setShowMembers(false);
      await loadGroups();
      setMessage('تم حذف المجموعة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  }

  if (loading) return <EmptyState>جاري التحميل...</EmptyState>;

  const memberIds = new Set(detail?.members?.map((m) => m.userId) || []);
  const addableUsers = allUsers.filter((u) => !memberIds.has(u.id));
  const pendingJoins = (detail?.joinRequests || []).filter((r) => r.status === 'PENDING');
  const recordLabel = `${String(Math.floor(recordSecs / 60)).padStart(2, '0')}:${String(recordSecs % 60).padStart(2, '0')}`;

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-[520px] flex-col gap-3">
      <PageHeader title="المحادثات">
        {isSuperAdmin && (
          <Button onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'إلغاء' : '+ مجموعة جديدة'}
          </Button>
        )}
      </PageHeader>

      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      {showCreate && isSuperAdmin && (
        <Card className="shrink-0">
          <CardHeader className="py-3">
            <CardTitle className="text-base">إنشاء مجموعة محادثة</CardTitle>
            <CardDescription>يمكنك إضافة أعضاء مباشرة بدون موافقة.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <FormRow>
                <FormField label="اسم المجموعة">
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="الوصف">
                  <Input
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </FormField>
              </FormRow>
              <div>
                <div className="mb-2 text-sm font-medium">أعضاء (اختياري)</div>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-3">
                  {allUsers.map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(u.id)}
                        onChange={(e) => {
                          setSelectedMemberIds((prev) =>
                            e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                          );
                        }}
                      />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'جاري الإنشاء...' : 'إنشاء'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[156px_minmax(0,1fr)]">
        {/* Groups list */}
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0 border-b py-3">
            <CardTitle className="text-sm">المجموعات</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {groups.length === 0 && <EmptyState>لا توجد مجموعات بعد</EmptyState>}
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => selectGroup(g.id)}
                className={cn(
                  'w-full rounded-lg px-3 py-2.5 text-right transition-colors',
                  selectedId === g.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <div className="truncate text-sm font-medium">{g.name}</div>
                <div
                  className={cn(
                    'mt-0.5 text-[11px]',
                    selectedId === g.id ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}
                >
                  {g.isMember
                    ? `${g.membersCount} أعضاء`
                    : g.myJoinRequest?.status === 'PENDING'
                      ? 'طلب قيد المراجعة'
                      : 'متاحة للانضمام'}
                </div>
                {!g.isMember && g.canJoin && (
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedId === g.id ? 'secondary' : 'outline'}
                    className="mt-2 h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoin(g.id);
                    }}
                  >
                    طلب انضمام
                  </Button>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Chat pane */}
        <Card className="relative flex min-h-0 flex-col overflow-hidden">
          {!detail || !selectedId ? (
            <CardContent className="flex flex-1 items-center justify-center">
              <EmptyState>اختر مجموعة للمحادثة</EmptyState>
            </CardContent>
          ) : (
            <>
              {/* Compact header */}
              <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold leading-tight">{detail.name}</div>
                  {detail.description ? (
                    <div className="truncate text-[11px] text-muted-foreground">{detail.description}</div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">
                      {detail.members?.length || 0} أعضاء
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {detail.isMember && (
                    <Button
                      type="button"
                      variant={showMembers ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 gap-1 px-2"
                      onClick={() => setShowMembers((v) => !v)}
                    >
                      <Users className="size-3.5" />
                      الأعضاء
                      {pendingJoins.length > 0 && (
                        <span className="rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">
                          {pendingJoins.length}
                        </span>
                      )}
                    </Button>
                  )}
                  {detail.isMember && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="مغادرة"
                      onClick={() => handleLeave(detail.id)}
                    >
                      <LogOut className="size-3.5" />
                    </Button>
                  )}
                  {isSuperAdmin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      title="حذف المجموعة"
                      onClick={handleDeleteGroup}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages — only this area scrolls */}
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3"
              >
                {!detail.isMember ? (
                  <EmptyState>انضم للمجموعة أولاً لعرض الرسائل</EmptyState>
                ) : messages.length === 0 ? (
                  <EmptyState>لا رسائل بعد — ابدأ المحادثة</EmptyState>
                ) : (
                  messages.map((m) => {
                    const mine = m.userId === user?.id;
                    return (
                      <div key={m.id} className={cn('flex', mine ? 'justify-start' : 'justify-end')}>
                        <div
                          className={cn(
                            'max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                            mine
                              ? 'rounded-ss-md bg-primary text-primary-foreground'
                              : 'rounded-se-md bg-muted'
                          )}
                        >
                          {!mine && (
                            <div className="mb-0.5 text-[11px] font-medium opacity-70">{m.user.name}</div>
                          )}
                          <MessageContent m={m} mine={mine} />
                          <div className="mt-1 text-[10px] opacity-55">
                            {new Date(m.createdAt).toLocaleString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Composer */}
              {detail.isMember && (
                <div className="shrink-0 border-t bg-background p-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
                  />

                  {recording ? (
                    <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
                      <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
                      <span className="flex-1 text-sm font-medium text-destructive">
                        جاري التسجيل {recordLabel}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground"
                        onClick={cancelRecording}
                      >
                        <X className="ml-1 size-4" />
                        إلغاء
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8"
                        onClick={finishRecording}
                        disabled={sending}
                      >
                        <Square className="ml-1 size-3.5" />
                        إرسال
                      </Button>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSend}
                      className="flex items-end gap-1.5 rounded-xl border bg-muted/30 p-1.5"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 text-muted-foreground"
                        disabled={sending}
                        title="إرفاق ملف"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 text-muted-foreground"
                        disabled={sending}
                        title="تسجيل صوت"
                        onClick={startRecording}
                      >
                        <Mic className="size-4" />
                      </Button>
                      <Textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        rows={1}
                        placeholder="اكتب رسالة..."
                        className="min-h-[36px] max-h-28 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
                        disabled={sending}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <Button
                        type="submit"
                        size="icon"
                        className="size-9 shrink-0"
                        disabled={!messageText.trim() || sending}
                        title="إرسال"
                      >
                        <Send className="size-4" />
                      </Button>
                    </form>
                  )}
                </div>
              )}

              {/* Members drawer — only when requested */}
              {showMembers && (
                <>
                  <button
                    type="button"
                    className="absolute inset-0 z-10 bg-black/25"
                    aria-label="إغلاق الأعضاء"
                    onClick={() => setShowMembers(false)}
                  />
                  <aside className="absolute inset-y-0 start-0 z-20 flex w-[min(100%,208px)] flex-col border-e bg-background shadow-xl">
                    <div className="flex items-center justify-between border-b px-3 py-2.5">
                      <div className="text-sm font-semibold">
                        الأعضاء ({detail.members?.length || 0})
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setShowMembers(false)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>

                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                      {(detail.members || []).map((m) => {
                        const unit = memberUnitLine(m.user);
                        const phone = memberPhone(m.user);
                        return (
                          <div
                            key={m.id}
                            className="flex items-start justify-between gap-2 rounded-lg border p-2.5"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{m.user.name}</div>
                              {unit && (
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {unit}
                                </div>
                              )}
                              {phone && (
                                <div className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                                  {phone}
                                </div>
                              )}
                              {!unit && !phone && (
                                <div className="mt-0.5 text-xs text-muted-foreground">—</div>
                              )}
                            </div>
                            {isSuperAdmin && m.userId !== user?.id && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0"
                                onClick={() => handleRemoveMember(m.userId)}
                              >
                                إزالة
                              </Button>
                            )}
                          </div>
                        );
                      })}

                      {isSuperAdmin && (
                        <div className="space-y-2 rounded-lg border border-dashed p-2.5">
                          <div className="text-xs font-medium text-muted-foreground">إضافة عضو</div>
                          <select
                            className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                            value={addMemberId}
                            onChange={(e) => setAddMemberId(e.target.value)}
                          >
                            <option value="">اختر مستخدماً...</option>
                            {addableUsers.map((u) => {
                              const unit = [u.resident?.buildingNo, u.resident?.area]
                                .filter(Boolean)
                                .join(' / ');
                              return (
                                <option key={u.id} value={u.id}>
                                  {u.name}{unit ? ` — ${unit}` : ''}
                                </option>
                              );
                            })}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            className="w-full"
                            onClick={handleAddMember}
                            disabled={!addMemberId}
                          >
                            <Plus className="ml-1 size-3.5" />
                            إضافة بدون موافقة
                          </Button>
                        </div>
                      )}

                      {isSuperAdmin && pendingJoins.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-muted-foreground">طلبات الانضمام</div>
                          {pendingJoins.map((r) => (
                            <div key={r.id} className="rounded-lg border p-2.5">
                              <div className="text-sm font-medium">{r.user?.name}</div>
                              <div className="mt-2 flex gap-2">
                                <Button type="button" size="sm" className="h-7" onClick={() => handleApprove(r.id)}>
                                  قبول
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7"
                                  onClick={() => handleReject(r.id)}
                                >
                                  رفض
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </aside>
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
