import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { Bill, Resident } from '@/types';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FormField, FormRow, PageHeader, StatusBadge } from '@/components/ui-helpers';

function billLabel(b: Bill) {
  if (b.billType === 'EXTRA') return b.title || 'فاتورة إضافية';
  return b.period;
}

export default function BillsPage() {
  const { isAdmin, isAccountant, isOwner, isDependent } = useAuth();
  const isStaff = isAdmin || isAccountant;
  const isHousehold = isOwner || isDependent;
  const [bills, setBills] = useState<Bill[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [issueForm, setIssueForm] = useState({ period: '2026-08', dueDate: '2026-08-15' });
  const [showExtra, setShowExtra] = useState(false);
  const [extraForm, setExtraForm] = useState({
    residentId: '',
    title: '',
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [uploadBill, setUploadBill] = useState<Bill | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingExtra, setSavingExtra] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.getBills().then(setBills).catch(console.error);
  }

  useEffect(() => {
    load();
    if (isStaff) {
      api.getResidents().then(setResidents).catch(console.error);
    }
  }, [isStaff]);

  async function handleIssue() {
    await api.issueMonthlyBills(issueForm.period, issueForm.dueDate);
    load();
    alert('تم إصدار الفواتير');
  }

  async function handleDirectPay(bill: Bill) {
    const remaining = bill.amount - bill.paidAmount;
    if (!confirm(`تحصيل نقدي بمبلغ ${remaining} ج.م؟`)) return;
    await api.payBill(bill.id, remaining);
    load();
  }

  async function handleCreateExtra(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSavingExtra(true);
    try {
      await api.createExtraBill({
        residentId: Number(extraForm.residentId),
        title: extraForm.title.trim(),
        amount: Number(extraForm.amount),
        dueDate: extraForm.dueDate,
        notes: extraForm.notes || undefined,
      });
      setShowExtra(false);
      setExtraForm({
        residentId: '',
        title: '',
        amount: '',
        dueDate: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء الفاتورة');
    } finally {
      setSavingExtra(false);
    }
  }

  function openUpload(bill: Bill) {
    setUploadBill(bill);
    setAmount(bill.amount - bill.paidAmount);
    setFile(null);
    setNotes('');
  }

  async function submitProof(e: FormEvent) {
    e.preventDefault();
    if (!uploadBill || !file) return;
    setUploading(true);
    try {
      await api.uploadPaymentProof(uploadBill.id, amount, file, notes || undefined);
      setUploadBill(null);
      load();
      alert('تم رفع مستند الدفع وبانتظار موافقة المحاسب');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل الرفع');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="الفواتير">
        {isStaff && (
          <>
            <Input
              value={issueForm.period}
              onChange={(e) => setIssueForm({ ...issueForm, period: e.target.value })}
              placeholder="2026-08"
              className="w-32"
            />
            <Input
              type="date"
              value={issueForm.dueDate}
              onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })}
              className="w-40"
            />
            <Button onClick={handleIssue}>إصدار فواتير شهرية</Button>
            <Button variant="outline" onClick={() => setShowExtra(!showExtra)}>
              {showExtra ? 'إلغاء' : '+ فاتورة إضافية'}
            </Button>
          </>
        )}
      </PageHeader>

      {error && <Alert variant="destructive">{error}</Alert>}

      {showExtra && isStaff && (
        <Card>
          <CardHeader>
            <CardTitle>إضافة فاتورة إضافية (مرة واحدة)</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateExtra} className="space-y-4">
              <FormRow>
                <FormField label="المالك / الوحدة">
                  <Select
                    value={extraForm.residentId}
                    onChange={(e) => setExtraForm({ ...extraForm, residentId: e.target.value })}
                    required
                  >
                    <option value="">اختر...</option>
                    {residents.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.residentName} — {r.area}-{r.buildingNo}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="عنوان الفاتورة">
                  <Input
                    value={extraForm.title}
                    onChange={(e) => setExtraForm({ ...extraForm, title: e.target.value })}
                    placeholder="مثال: صيانة مصعد"
                    required
                  />
                </FormField>
                <FormField label="المبلغ">
                  <Input
                    type="number"
                    min={1}
                    value={extraForm.amount}
                    onChange={(e) => setExtraForm({ ...extraForm, amount: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="تاريخ الاستحقاق">
                  <Input
                    type="date"
                    value={extraForm.dueDate}
                    onChange={(e) => setExtraForm({ ...extraForm, dueDate: e.target.value })}
                    required
                  />
                </FormField>
              </FormRow>
              <FormField label="ملاحظات">
                <Input
                  value={extraForm.notes}
                  onChange={(e) => setExtraForm({ ...extraForm, notes: e.target.value })}
                />
              </FormField>
              <Button type="submit" disabled={savingExtra}>
                {savingExtra ? 'جاري الحفظ...' : 'إنشاء الفاتورة'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {uploadBill && (
        <Card>
          <CardHeader>
            <CardTitle>رفع إثبات الدفع — {billLabel(uploadBill)}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitProof} className="space-y-4">
              <FormRow>
                <FormField label="المبلغ">
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(+e.target.value)}
                    required
                    min={1}
                  />
                </FormField>
                <FormField label="صورة أو PDF">
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                  />
                </FormField>
              </FormRow>
              <FormField label="ملاحظات">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </FormField>
              <div className="flex gap-2">
                <Button type="submit" disabled={uploading}>
                  {uploading ? 'جاري الرفع...' : 'رفع للمراجعة'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setUploadBill(null)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الساكن</TableHead>
                <TableHead>الوحدة</TableHead>
                <TableHead>الموبايل</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الفاتورة</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>المدفوع</TableHead>
                <TableHead>الاستحقاق</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div>{b.resident?.residentName || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.resident?.residentType === 'T' ? 'مستأجر' : 'مالك'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {b.resident
                      ? `${b.resident.area}-${b.resident.buildingNo} / ${b.resident.floorNo} / ${b.resident.apartmentNo}`
                      : '—'}
                  </TableCell>
                  <TableCell>{b.resident?.mobile || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={b.billType === 'EXTRA' ? 'warning' : 'info'}>
                      {b.billType === 'EXTRA' ? 'إضافية' : 'شهرية'}
                    </Badge>
                  </TableCell>
                  <TableCell>{billLabel(b)}</TableCell>
                  <TableCell>{b.amount} ج.م</TableCell>
                  <TableCell>{b.paidAmount} ج.م</TableCell>
                  <TableCell>{new Date(b.dueDate).toLocaleDateString('ar-EG')}</TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                  </TableCell>
                  <TableCell>
                    {b.status !== 'PAID' && b.status !== 'PENDING_REVIEW' && isHousehold && (
                      <Button variant="success" size="sm" onClick={() => openUpload(b)}>
                        رفع إثبات دفع
                      </Button>
                    )}
                    {b.status !== 'PAID' && isStaff && (
                      <Button variant="outline" size="sm" onClick={() => handleDirectPay(b)}>
                        تحصيل نقدي
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
