import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import type { Expense, ExpenseType, Resident } from '@/types';
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
import { EmptyState, FormField, FormRow, PageHeader } from '@/components/ui-helpers';

function unitLabel(r: Partial<Resident> & { unitType?: { hasFloor?: boolean; hasApartment?: boolean } | null }) {
  if (!r.residentName) return '—';
  const parts = [
    r.residentName,
    r.area && r.buildingNo ? `${r.area}-${r.buildingNo}` : null,
    r.unitType?.hasFloor !== false && r.floorNo ? `دور ${r.floorNo}` : null,
    r.unitType?.hasApartment !== false && r.apartmentNo && r.apartmentNo !== '0'
      ? `وحدة ${r.apartmentNo}`
      : null,
  ];
  return parts.filter(Boolean).join(' / ');
}

const emptyForm = {
  scope: 'COMPOUND' as 'COMPOUND' | 'UNIT',
  expenseTypeId: '',
  residentId: '',
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  notes: '',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterScope, setFilterScope] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    const params: Record<string, string> = {};
    if (filterScope) params.scope = filterScope;
    api.getExpenses(Object.keys(params).length ? params : undefined).then(setExpenses).catch(console.error);
  }

  useEffect(() => {
    load();
    api.getExpenseTypes().then(setTypes).catch(console.error);
    api.getResidents().then(setResidents).catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [filterScope]);

  function resetForm() {
    setForm({ ...emptyForm, expenseDate: new Date().toISOString().slice(0, 10) });
    setEditingId(null);
  }

  function openEdit(e: Expense) {
    setEditingId(e.id);
    setForm({
      scope: e.residentId ? 'UNIT' : 'COMPOUND',
      expenseTypeId: String(e.expenseTypeId),
      residentId: e.residentId ? String(e.residentId) : '',
      amount: String(e.amount),
      expenseDate: e.expenseDate.slice(0, 10),
      notes: e.notes || '',
    });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (!form.expenseTypeId) {
        setError('اختر نوع المصروف');
        setSaving(false);
        return;
      }
      if (form.scope === 'UNIT' && !form.residentId) {
        setError('اختر الوحدة');
        setSaving(false);
        return;
      }
      const payload = {
        expenseTypeId: Number(form.expenseTypeId),
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        notes: form.notes.trim() || null,
        scope: form.scope,
        residentId: form.scope === 'UNIT' ? Number(form.residentId) : null,
      };
      if (editingId) {
        await api.updateExpense(editingId, payload);
        setMessage('تم تحديث المصروف');
      } else {
        await api.createExpense(payload);
        setMessage('تم تسجيل المصروف');
      }
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذا المصروف؟')) return;
    setError('');
    try {
      await api.deleteExpense(id);
      setMessage('تم الحذف');
      if (editingId === id) resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  }

  const activeTypes = types.filter((t) => t.activeFlag === 'Y');
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="المصاريف" />

      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? 'تعديل مصروف' : 'تسجيل مصروف جديد'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormRow>
              <FormField label="النطاق">
                <Select
                  value={form.scope}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      scope: e.target.value as 'COMPOUND' | 'UNIT',
                      residentId: e.target.value === 'COMPOUND' ? '' : form.residentId,
                    })
                  }
                  required
                >
                  <option value="COMPOUND">على الكومبوند كله</option>
                  <option value="UNIT">على وحدة محددة</option>
                </Select>
              </FormField>
              {form.scope === 'UNIT' && (
                <FormField label="الوحدة">
                  <Select
                    value={form.residentId}
                    onChange={(e) => setForm({ ...form, residentId: e.target.value })}
                    required
                  >
                    <option value="">اختر الوحدة...</option>
                    {residents.map((r) => (
                      <option key={r.id} value={r.id}>
                        {unitLabel(r)}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              <FormField label="نوع المصروف">
                <Select
                  value={form.expenseTypeId}
                  onChange={(e) => setForm({ ...form, expenseTypeId: e.target.value })}
                  required
                >
                  <option value="">اختر...</option>
                  {activeTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  {editingId &&
                    form.expenseTypeId &&
                    !activeTypes.some((t) => String(t.id) === form.expenseTypeId) && (
                      <option value={form.expenseTypeId}>
                        {types.find((t) => String(t.id) === form.expenseTypeId)?.name || 'نوع موقوف'}
                      </option>
                    )}
                </Select>
              </FormField>
              <FormField label="المبلغ">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="التاريخ">
                <Input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  required
                />
              </FormField>
            </FormRow>
            <FormField label="ملاحظات">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="اختياري"
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || activeTypes.length === 0}>
                {saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'تسجيل'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  إلغاء
                </Button>
              )}
            </div>
            {activeTypes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                أضف نوع مصروف أولاً من شاشة «أنواع المصاريف».
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <FormField label="تصفية بالنطاق" className="mb-0 min-w-[180px]">
            <Select value={filterScope} onChange={(e) => setFilterScope(e.target.value)}>
              <option value="">الكل</option>
              <option value="COMPOUND">الكومبوند فقط</option>
              <option value="UNIT">الوحدات فقط</option>
            </Select>
          </FormField>
          <div className="text-sm text-muted-foreground">
            الإجمالي المعروض: <span className="font-semibold text-foreground">{total.toLocaleString()} ج.م</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>النطاق</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{new Date(e.expenseDate).toLocaleDateString('ar-EG')}</TableCell>
                  <TableCell>{e.expenseType?.name || '—'}</TableCell>
                  <TableCell>
                    {e.residentId && e.resident ? unitLabel(e.resident) : 'الكومبوند كله'}
                  </TableCell>
                  <TableCell>{e.amount.toLocaleString()} ج.م</TableCell>
                  <TableCell className="max-w-[200px] truncate">{e.notes || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(e)}>
                        تعديل
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(e.id)}>
                        حذف
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {expenses.length === 0 && <EmptyState>لا توجد مصاريف مسجلة</EmptyState>}
        </CardContent>
      </Card>
    </div>
  );
}
