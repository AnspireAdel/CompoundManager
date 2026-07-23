import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Mic, Paperclip, Square } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { ChatGroupDetail, ChatGroupSummary, ChatMessage, User } from '@/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, FormField, FormRow, PageHeader } from '@/components/ui-helpers';

function roleLabel(role?: string) {
  if (role === 'SUPERADMIN') return 'مدير أعلى';
  if (role === 'ADMIN') return 'مدير';
  if (role === 'ACCOUNTANT') return 'محاسب';
  if (role === 'DEPENDENT') return 'تابع';
  return 'مالك';
}

function formatBytes(n?: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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
            <img src={m.filePath} alt={m.fileName || 'صورة'} className="max-h-48 max-w-full rounded" />
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
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [addMemberId, setAddMemberId] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  const loadGroups = useCallback(async () => {
    const list = await api.getChats();
    setGroups(list);
    return list;
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    const [d, msgs] = await Promise.all([api.getChat(id), api.getChatMessages(id)]);
    setDetail(d);
    setMessages(msgs);
  }, []);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll messages while a chat is open
  useEffect(() => {
    if (!selectedId || !detail?.isMember) return;
    const t = setInterval(() => {
      api.getChatMessages(selectedId).then(setMessages).catch(() => {});
      if (isSuperAdmin) {
        api.getChat(selectedId).then(setDetail).catch(() => {});
      }
    }, 4000);
    return () => clearInterval(t);
  }, [selectedId, detail?.isMember, isSuperAdmin]);

  async function selectGroup(id: number) {
    setSelectedId(id);
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

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !messageText.trim() || sending) return;
    setSending(true);
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
    if (!selectedId || !file || sending) return;
    setSending(true);
    setError('');
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

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!selectedId || sending) return;
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
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        setRecording(false);
        stopRecordingTracks();
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        if (!selectedId || blob.size === 0) return;
        const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
        setSending(true);
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
      await loadGroups();
      setMessage('تم حذف المجموعة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  }

  if (loading) return <EmptyState>جاري التحميل...</EmptyState>;

  const memberIds = new Set(detail?.members?.map((m) => m.userId) || []);
  const addableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <div className="space-y-4">
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
        <Card>
          <CardHeader>
            <CardTitle>إنشاء مجموعة محادثة</CardTitle>
            <CardDescription>يمكنك إضافة أعضاء مباشرة بدون موافقة.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
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
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-3">
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
                      <span>
                        {u.name} — {roleLabel(u.role)}
                      </span>
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

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-[70vh] overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">المجموعات</CardTitle>
          </CardHeader>
          <CardContent className="h-[calc(100%-3.5rem)] space-y-2 overflow-y-auto">
            {groups.length === 0 && <EmptyState>لا توجد مجموعات بعد</EmptyState>}
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => selectGroup(g.id)}
                className={`w-full rounded-lg border p-3 text-right transition-colors ${
                  selectedId === g.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <div className="font-medium">{g.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
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
                    variant="outline"
                    className="mt-2"
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

        <Card className="flex h-[70vh] flex-col overflow-hidden">
          {!detail || !selectedId ? (
            <CardContent className="flex flex-1 items-center justify-center">
              <EmptyState>اختر مجموعة للمحادثة</EmptyState>
            </CardContent>
          ) : (
            <>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 border-b">
                <div>
                  <CardTitle className="text-base">{detail.name}</CardTitle>
                  {detail.description && (
                    <CardDescription className="mt-1">{detail.description}</CardDescription>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.isMember && (
                    <Button type="button" variant="outline" size="sm" onClick={() => handleLeave(detail.id)}>
                      مغادرة
                    </Button>
                  )}
                  {isSuperAdmin && (
                    <Button type="button" variant="destructive" size="sm" onClick={handleDeleteGroup}>
                      حذف المجموعة
                    </Button>
                  )}
                </div>
              </CardHeader>

              <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_220px]">
                <div className="flex min-h-0 flex-col">
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {!detail.isMember ? (
                      <EmptyState>انضم للمجموعة أولاً لعرض الرسائل</EmptyState>
                    ) : messages.length === 0 ? (
                      <EmptyState>لا رسائل بعد — ابدأ المحادثة</EmptyState>
                    ) : (
                      messages.map((m) => {
                        const mine = m.userId === user?.id;
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? 'justify-start' : 'justify-end'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                mine ? 'bg-primary text-primary-foreground' : 'bg-muted'
                              }`}
                            >
                              {!mine && (
                                <div className="mb-1 text-xs opacity-70">{m.user.name}</div>
                              )}
                              <MessageContent m={m} mine={mine} />
                              <div className={`mt-1 text-[10px] opacity-60`}>
                                {new Date(m.createdAt).toLocaleString('ar-EG')}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  {detail.isMember && (
                    <form onSubmit={handleSend} className="flex flex-col gap-2 border-t p-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
                      />
                      <div className="flex gap-2">
                        <Textarea
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          rows={2}
                          placeholder="اكتب رسالة..."
                          className="min-h-[60px]"
                          disabled={sending || recording}
                        />
                        <Button type="submit" disabled={!messageText.trim() || sending || recording}>
                          إرسال
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={sending || recording}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Paperclip className="ml-1 size-4" />
                          إرفاق ملف
                        </Button>
                        <Button
                          type="button"
                          variant={recording ? 'destructive' : 'outline'}
                          size="sm"
                          disabled={sending}
                          onClick={toggleRecording}
                        >
                          {recording ? (
                            <>
                              <Square className="ml-1 size-4" />
                              إيقاف وإرسال
                            </>
                          ) : (
                            <>
                              <Mic className="ml-1 size-4" />
                              تسجيل صوت
                            </>
                          )}
                        </Button>
                        {recording && (
                          <span className="self-center text-xs text-destructive animate-pulse">جاري التسجيل...</span>
                        )}
                      </div>
                    </form>
                  )}
                </div>

                <div className="hidden border-r lg:block overflow-y-auto p-3 text-sm">
                  <div className="mb-2 font-medium">الأعضاء ({detail.members?.length || 0})</div>
                  <div className="space-y-2">
                    {(detail.members || []).map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 rounded border p-2">
                        <div>
                          <div className="font-medium">{m.user.name}</div>
                          <div className="text-xs text-muted-foreground">{roleLabel(m.user.role)}</div>
                        </div>
                        {isSuperAdmin && m.userId !== user?.id && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveMember(m.userId)}
                          >
                            إزالة
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isSuperAdmin && (
                    <div className="mt-4 space-y-2">
                      <div className="font-medium">إضافة عضو</div>
                      <select
                        className="w-full rounded-md border bg-background px-2 py-2 text-sm"
                        value={addMemberId}
                        onChange={(e) => setAddMemberId(e.target.value)}
                      >
                        <option value="">اختر مستخدماً...</option>
                        {addableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} — {roleLabel(u.role)}
                          </option>
                        ))}
                      </select>
                      <Button type="button" size="sm" className="w-full" onClick={handleAddMember} disabled={!addMemberId}>
                        إضافة بدون موافقة
                      </Button>
                    </div>
                  )}

                  {isSuperAdmin && (detail.joinRequests || []).length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="font-medium">طلبات الانضمام</div>
                      {detail.joinRequests
                        .filter((r) => r.status === 'PENDING')
                        .map((r) => (
                          <div key={r.id} className="rounded border p-2">
                            <div className="font-medium">{r.user?.name}</div>
                            <div className="mt-2 flex gap-2">
                              <Button type="button" size="sm" onClick={() => handleApprove(r.id)}>
                                قبول
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => handleReject(r.id)}>
                                رفض
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
