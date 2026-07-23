import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { ContactRequest } from '@/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, FormField, FormRow, PageHeader, StatusBadge } from '@/components/ui-helpers';

const categoryLabel: Record<string, string> = {
  REQUEST: 'طلب',
  INQUIRY: 'استفسار',
  COMPLAINT: 'شكوى',
};

export default function ContactPage() {
  const { isOwner, isAdmin, isAccountant } = useAuth();
  const isStaff = isAdmin || isAccountant;
  const [items, setItems] = useState<ContactRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState({
    category: 'INQUIRY',
    subject: '',
    message: '',
  });
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [actionForm, setActionForm] = useState({ status: 'IN_PROGRESS', staffResponse: '' });
  const [error, setError] = useState('');

  function load() {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    api.getContactRequests(params).then(setItems).catch(console.error);
  }

  useEffect(() => {
    load();
  }, [statusFilter, categoryFilter]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createContactRequest({
        category: form.category as ContactRequest['category'],
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setForm({ category: 'INQUIRY', subject: '', message: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإرسال');
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(e: FormEvent) {
    e.preventDefault();
    if (!actionId) return;
    setSaving(true);
    try {
      await api.updateContactRequest(actionId, {
        status: actionForm.status as ContactRequest['status'],
        staffResponse: actionForm.staffResponse || undefined,
      });
      setActionId(null);
      setActionForm({ status: 'IN_PROGRESS', staffResponse: '' });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل التحديث');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={isStaff ? 'الطلبات والشكاوى' : 'تواصل معنا'} />

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>إرسال طلب / استفسار / شكوى</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <FormRow>
                <FormField label="النوع">
                  <Select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                  >
                    <option value="REQUEST">طلب</option>
                    <option value="INQUIRY">استفسار</option>
                    <option value="COMPLAINT">شكوى</option>
                  </Select>
                </FormField>
                <FormField label="الموضوع">
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    required
                    maxLength={120}
                  />
                </FormField>
              </FormRow>
              <FormField label="التفاصيل">
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  required
                  rows={4}
                  maxLength={2000}
                />
              </FormField>
              {error && <Alert variant="destructive">{error}</Alert>}
              <Button type="submit" disabled={saving}>
                {saving ? 'جاري الإرسال...' : 'إرسال'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isStaff && (
        <Card>
          <CardContent className="pt-6">
            <FormRow>
              <FormField label="الحالة">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">الكل</option>
                  <option value="PENDING">جديد</option>
                  <option value="IN_PROGRESS">قيد المعالجة</option>
                  <option value="RESOLVED">تم الحل</option>
                  <option value="CLOSED">مغلق</option>
                </Select>
              </FormField>
              <FormField label="النوع">
                <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">الكل</option>
                  <option value="REQUEST">طلب</option>
                  <option value="INQUIRY">استفسار</option>
                  <option value="COMPLAINT">شكوى</option>
                </Select>
              </FormField>
            </FormRow>
          </CardContent>
        </Card>
      )}

      {actionId && isStaff && (
        <Card>
          <CardHeader>
            <CardTitle>اتخاذ إجراء</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAction} className="space-y-4">
              <FormRow>
                <FormField label="الحالة الجديدة">
                  <Select
                    value={actionForm.status}
                    onChange={(e) => setActionForm({ ...actionForm, status: e.target.value })}
                    required
                  >
                    <option value="IN_PROGRESS">قيد المعالجة</option>
                    <option value="RESOLVED">تم الحل</option>
                    <option value="CLOSED">مغلق</option>
                    <option value="PENDING">جديد</option>
                  </Select>
                </FormField>
              </FormRow>
              <FormField label="الرد / الملاحظات">
                <Textarea
                  value={actionForm.staffResponse}
                  onChange={(e) => setActionForm({ ...actionForm, staffResponse: e.target.value })}
                  rows={3}
                />
              </FormField>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setActionId(null)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isStaff ? 'قائمة الطلبات' : 'طلباتي السابقة'}</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState>لا توجد عناصر</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isStaff && <TableHead>المالك</TableHead>}
                  <TableHead>النوع</TableHead>
                  <TableHead>الموضوع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الرد</TableHead>
                  {isStaff && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    {isStaff && (
                      <TableCell>
                        <div>{item.resident?.residentName}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.resident
                            ? `${item.resident.area}-${item.resident.buildingNo}`
                            : ''}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>{categoryLabel[item.category] || item.category}</TableCell>
                    <TableCell>
                      <div>{item.subject}</div>
                      <div className="text-sm text-muted-foreground">{item.message}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleString('ar-EG')}</TableCell>
                    <TableCell>{item.staffResponse || '—'}</TableCell>
                    {isStaff && (
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActionId(item.id);
                            setActionForm({
                              status: item.status === 'PENDING' ? 'IN_PROGRESS' : item.status,
                              staffResponse: item.staffResponse || '',
                            });
                          }}
                        >
                          إجراء
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
