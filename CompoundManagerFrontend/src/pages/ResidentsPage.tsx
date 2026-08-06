import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { Resident, UnitType, Dependent } from '@/types';
import { Alert } from '@/components/ui/alert';
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
import { EmptyState, FormField, FormRow, PageHeader } from '@/components/ui-helpers';
import { Textarea } from '@/components/ui/textarea';

const emptyForm = {
  area: '',
  buildingNo: '',
  floorNo: '' as string | number,
  apartmentNo: '',
  residentName: '',
  mobile: '',
  email: '',
  landLine: '',
  nationality: '',
  monthlyFees: '' as string | number,
  residentType: 'O',
  unitTypeId: '' as string | number,
  notes: '',
};

const RELATION_OPTIONS = ['زوج', 'زوجة', 'ابن', 'ابنة', 'والد', 'والدة'];

export default function ResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [depForm, setDepForm] = useState({ name: '', relation: 'زوج', mobile: '', email: '' });
  const [depPreviewUsername, setDepPreviewUsername] = useState('');
  const [savingDep, setSavingDep] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [previewUsername, setPreviewUsername] = useState('');

  function load() {
    api.getResidents(search ? { search } : undefined).then(setResidents).catch(console.error);
  }

  useEffect(() => {
    load();
    api.getUnitTypes(true).then(setUnitTypes).catch(console.error);
  }, []);

  function onUnitTypeChange(unitTypeId: string) {
    const type = unitTypes.find((t) => t.id === Number(unitTypeId));
    setForm({
      ...form,
      unitTypeId,
      monthlyFees: type ? type.monthlyFees : form.monthlyFees,
      floorNo: type && !type.hasFloor ? 0 : form.floorNo || 1,
      apartmentNo: type && !type.hasApartment ? '0' : form.apartmentNo || '1',
    });
  }

  function openCreate() {
    setEditingId(null);
    const first = unitTypes.find((t) => t.activeFlag === 'Y') || unitTypes[0];
    setForm({
      ...emptyForm,
      residentType: 'O',
      unitTypeId: first?.id || '',
      monthlyFees: first?.monthlyFees ?? 500,
    });
    setError('');
    setMessage('');
    setDependents([]);
    setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
    setPreviewUsername('');
    api.getNextUsername().then((r) => setPreviewUsername(r.username)).catch(console.error);
    setShowForm(true);
  }

  async function openEdit(r: Resident) {
    setEditingId(r.id);
    setForm({
      area: r.area,
      buildingNo: r.buildingNo,
      floorNo: r.floorNo,
      apartmentNo: r.apartmentNo,
      residentName: r.residentName,
      mobile: r.mobile,
      email: r.email || '',
      landLine: r.landLine || '',
      nationality: r.nationality || 'مصري',
      monthlyFees: r.monthlyFees,
      residentType: r.residentType || 'O',
      unitTypeId: r.unitTypeId || '',
      notes: r.notes || '',
    });
    setError('');
    setMessage('');
    setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
    setPreviewUsername(r.user?.username || '');
    api.getSuggestedUsername().then((s) => setDepPreviewUsername(s.username)).catch(console.error);
    setShowForm(true);
    try {
      setDependents(await api.getDependents(r.id));
    } catch {
      setDependents([]);
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setDependents([]);
    setError('');
    setMessage('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!form.unitTypeId) {
        setError('اختر نوع الوحدة');
        setSaving(false);
        return;
      }
      const type = unitTypes.find((t) => t.id === Number(form.unitTypeId));
      const payload = {
        ...form,
        floorNo: type?.hasFloor ? Number(form.floorNo) : 0,
        apartmentNo: type?.hasApartment ? String(form.apartmentNo).trim() : '0',
        monthlyFees: Number(form.monthlyFees),
        unitTypeId: Number(form.unitTypeId),
        residentType: form.residentType === 'T' ? 'T' : 'O',
        email: form.email || undefined,
        landLine: form.landLine || undefined,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await api.updateResident(editingId, payload);
      } else {
        await api.createResident(payload);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(r: Resident) {
    if (!r.email && !r.user) {
      setError('أضف بريداً إلكترونياً للوحدة أولاً حتى يمكن إعادة تعيين كلمة المرور');
      return;
    }
    const ok = window.confirm(
      `إعادة تعيين كلمة مرور «${r.residentName}» إلى 123؟\nسيُطلب تغييرها عند تسجيل الدخول التالي.`
    );
    if (!ok) return;
    setResettingId(r.id);
    setError('');
    setMessage('');
    try {
      const result = await api.resetResidentPassword(r.id);
      setMessage(result.message);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إعادة تعيين كلمة المرور');
    } finally {
      setResettingId(null);
    }
  }

  async function handleAddDependent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    if (!depForm.email.trim()) {
      setError('البريد الإلكتروني مطلوب لإنشاء حساب دخول للتابع');
      return;
    }
    setSavingDep(true);
    setError('');
    try {
      await api.createDependent({
        residentId: editingId,
        name: depForm.name.trim(),
        relation: depForm.relation.trim(),
        mobile: depForm.mobile.trim(),
        email: depForm.email.trim(),
      });
      const assignedUsername = depPreviewUsername;
      setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
      setDependents(await api.getDependents(editingId));
      api.getSuggestedUsername().then((s) => setDepPreviewUsername(s.username)).catch(console.error);
      setMessage(`تم إضافة التابع — اسم المستخدم: ${assignedUsername} — كلمة المرور الافتراضية 123 (يُطلب تغييرها عند أول دخول)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إضافة التابع');
    } finally {
      setSavingDep(false);
    }
  }

  async function handleResetDependentPassword(id: number) {
    if (!window.confirm('إعادة كلمة مرور هذا التابع إلى 123؟')) return;
    try {
      const res = await api.resetDependentPassword(id);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إعادة تعيين كلمة المرور');
    }
  }

  async function handleDeleteDependent(id: number) {
    if (!editingId || !window.confirm('حذف هذا التابع؟')) return;
    try {
      await api.deleteDependent(id);
      setDependents(await api.getDependents(editingId));
      setMessage('تم حذف التابع');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  }

  const selectedType = unitTypes.find((t) => t.id === Number(form.unitTypeId));

  return (
    <div className="space-y-4">
      <PageHeader title="الوحدات">
        <Button onClick={() => (showForm && !editingId ? closeForm() : openCreate())}>
          {showForm && !editingId ? 'إلغاء' : '+ إضافة وحدة'}
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive">{error}</Alert>
      )}
      {message && (
        <Alert variant="success">{message}</Alert>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'تعديل بيانات الوحدة' : 'إضافة وحدة جديدة'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormRow>
                <FormField label="الاسم">
                  <Input
                    value={form.residentName}
                    onChange={(e) => setForm({ ...form, residentName: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="الموبايل">
                  <Input
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="الهاتف الأرضي">
                  <Input
                    value={form.landLine}
                    onChange={(e) => setForm({ ...form, landLine: e.target.value })}
                  />
                </FormField>
                <FormField label="البريد">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="اسم المستخدم">
                  <Input value={previewUsername || '—'} readOnly disabled />
                </FormField>
              </FormRow>
              {!editingId && (
                <p className="text-sm text-muted-foreground">
                  كلمة المرور الافتراضية للمالك: <span className="font-semibold">123</span>
                  — يُطلب تغييرها واسم المستخدم عند أول تسجيل دخول.
                </p>
              )}
              <FormRow>
                <FormField label="الجنسية">
                  <Input
                    value={form.nationality}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  />
                </FormField>
                <FormField label="نوع السكن">
                  <Select
                    value={form.residentType}
                    onChange={(e) => setForm({ ...form, residentType: e.target.value })}
                    required
                  >
                    <option value="O">مالك</option>
                    <option value="T">مستأجر</option>
                  </Select>
                </FormField>
                <FormField label="نوع الوحدة">
                  <Select
                    value={form.unitTypeId}
                    onChange={(e) => onUnitTypeChange(e.target.value)}
                    required
                  >
                    <option value="">اختر...</option>
                    {unitTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {t.monthlyFees} ج.م
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="الرسوم الشهرية">
                  <Input type="number" value={form.monthlyFees} readOnly disabled />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="المجاورة">
                  <Input
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    maxLength={3}
                    required
                  />
                </FormField>
                <FormField label="القطعة">
                  <Input
                    value={form.buildingNo}
                    onChange={(e) => setForm({ ...form, buildingNo: e.target.value })}
                    maxLength={5}
                    required
                  />
                </FormField>
                {(selectedType?.hasFloor ?? true) && (
                  <FormField label="الدور">
                    <Input
                      type="number"
                      value={form.floorNo}
                      onChange={(e) => setForm({ ...form, floorNo: +e.target.value })}
                      required
                    />
                  </FormField>
                )}
                {(selectedType?.hasApartment ?? true) && (
                  <FormField label="رقم الوحدة">
                    <Input
                      value={form.apartmentNo}
                      onChange={(e) => setForm({ ...form, apartmentNo: e.target.value })}
                      placeholder="مثال: 12 أو A1"
                      required
                    />
                  </FormField>
                )}
              </FormRow>
              <FormField label="ملاحظات (للإدارة فقط)">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={4}
                  placeholder="ملاحظات داخلية عن المالك أو الوحدة..."
                />
              </FormField>
              {editingId && (
                <div className="space-y-3 rounded-md border p-4">
                  <div className="text-sm font-medium">التابعون (دخول عبر التطبيق)</div>
                  <p className="text-xs text-muted-foreground">
                    البريد مطلوب. اسم المستخدم يُعيَّن تلقائياً (<span className="font-mono">{depPreviewUsername || '…'}</span>).
                    كلمة المرور الافتراضية <span className="font-mono">123</span> ويُطلب تغييرها عند أول تسجيل دخول.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-5">
                    <Input
                      placeholder="الاسم"
                      value={depForm.name}
                      onChange={(e) => setDepForm({ ...depForm, name: e.target.value })}
                    />
                    <Select
                      value={depForm.relation}
                      onChange={(e) => setDepForm({ ...depForm, relation: e.target.value })}
                    >
                      {RELATION_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </Select>
                    <Input
                      placeholder="الموبايل"
                      value={depForm.mobile}
                      onChange={(e) => setDepForm({ ...depForm, mobile: e.target.value })}
                    />
                    <Input
                      placeholder="البريد (مطلوب)"
                      type="email"
                      value={depForm.email}
                      onChange={(e) => setDepForm({ ...depForm, email: e.target.value })}
                    />
                    <Input
                      placeholder="اسم المستخدم"
                      value={depPreviewUsername}
                      readOnly
                      disabled
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={savingDep || !depForm.name.trim() || !depForm.mobile.trim() || !depForm.email.trim()}
                    onClick={(e) => handleAddDependent(e)}
                  >
                    {savingDep ? '...' : 'إضافة تابع'}
                  </Button>
                  {dependents.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>الاسم</TableHead>
                          <TableHead>صلة القرابة</TableHead>
                          <TableHead>الموبايل</TableHead>
                          <TableHead>اسم المستخدم</TableHead>
                          <TableHead>البريد</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dependents.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>{d.name}</TableCell>
                            <TableCell>{d.relation}</TableCell>
                            <TableCell>{d.mobile}</TableCell>
                            <TableCell>{d.user?.username || '—'}</TableCell>
                            <TableCell>{d.email || '—'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleResetDependentPassword(d.id)}
                              >
                                إعادة كلمة المرور
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteDependent(d.id)}
                              >
                                حذف
                              </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'حفظ'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={closeForm}>
                    إلغاء
                  </Button>
                )}
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={resettingId === editingId}
                    onClick={() => {
                      const r = residents.find((x) => x.id === editingId);
                      if (r) handleResetPassword(r);
                    }}
                  >
                    {resettingId === editingId ? 'جاري التعيين...' : 'إعادة كلمة المرور إلى 123'}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="بحث بالاسم أو الموبايل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>نوع الوحدة</TableHead>
                <TableHead>الوحدة</TableHead>
                <TableHead>الموبايل</TableHead>
                <TableHead>الرسوم الشهرية</TableHead>
                <TableHead>الرصيد</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {residents.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.residentName}</TableCell>
                  <TableCell>{r.residentType === 'T' ? 'مستأجر' : 'مالك'}</TableCell>
                  <TableCell>{r.unitType?.name || '—'}</TableCell>
                  <TableCell>
                    {[
                      `${r.area}-${r.buildingNo}`,
                      r.unitType?.hasFloor !== false && r.floorNo ? `دور ${r.floorNo}` : null,
                      r.unitType?.hasApartment !== false && r.apartmentNo && r.apartmentNo !== '0' ? `وحدة ${r.apartmentNo}` : null,
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                  </TableCell>
                  <TableCell>{r.mobile}</TableCell>
                  <TableCell>{(r.unitType?.monthlyFees ?? r.monthlyFees).toLocaleString()} ج.م</TableCell>
                  <TableCell
                    className={(r.balance ?? 0) > 0 ? 'text-destructive' : 'text-emerald-600'}
                  >
                    {(r.balance ?? 0).toLocaleString()} ج.م
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                        تعديل
                      </Button>
                      {(r.user || r.email) && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={resettingId === r.id}
                          onClick={() => handleResetPassword(r)}
                        >
                          {resettingId === r.id ? '...' : 'كلمة المرور 123'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {residents.length === 0 && <EmptyState>لا توجد وحدات</EmptyState>}
        </CardContent>
      </Card>
    </div>
  );
}
