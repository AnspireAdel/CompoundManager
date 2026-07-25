import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import PasswordInput from '@/components/PasswordInput';
import type { Resident, ServiceType, Dependent } from '@/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormRow, PageHeader } from '@/components/ui-helpers';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const RELATION_OPTIONS = ['زوج', 'زوجة', 'ابن', 'ابنة', 'والد', 'والدة'];

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export default function ProfilePage() {
  const { updateUser, isOwner } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    landLine: '',
    nationality: '',
  });
  const [resident, setResident] = useState<Partial<Resident> | null>(null);
  const [serviceForm, setServiceForm] = useState({
    serviceType: '',
    serviceName: '',
    mobile: '',
    notes: '',
  });
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [isServiceProvider, setIsServiceProvider] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [depForm, setDepForm] = useState({ name: '', relation: 'زوج', mobile: '', email: '' });
  const [editingDepId, setEditingDepId] = useState<number | null>(null);
  const [savingDep, setSavingDep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [togglingProvider, setTogglingProvider] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [me, types] = await Promise.all([
      api.getMe(),
      api.getServiceTypes(),
    ]);
    setServiceTypes(types);
    setForm({
      name: me.name || '',
      email: me.email || '',
      mobile: me.resident?.mobile || '',
      landLine: me.resident?.landLine || '',
      nationality: me.resident?.nationality || '',
    });
    setResident(me.resident || null);
    setIsServiceProvider(Boolean(me.resident?.isServiceProvider));

    if (me.role === 'OWNER') {
      const [mine, deps] = await Promise.all([api.getMyServices(), api.getDependents()]);
      setDependents(deps);
      setIsServiceProvider(mine.isServiceProvider);
      if (mine.service) {
        setServiceForm({
          serviceType: mine.service.serviceType || '',
          serviceName: mine.service.serviceName || '',
          mobile: mine.service.mobile || me.resident?.mobile || '',
          notes: mine.service.notes || '',
        });
      } else {
        setServiceForm((f) => ({
          ...f,
          serviceType: types[0]?.name || '',
          mobile: me.resident?.mobile || f.mobile,
        }));
      }
    }
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await api.updateProfile({
        name: form.name,
        email: form.email,
        mobile: form.mobile || undefined,
        landLine: form.landLine || null,
        nationality: form.nationality || undefined,
      });
      updateUser({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        status: updated.status,
        residentId: updated.residentId,
      });
      setMessage('تم حفظ الملف الشخصي');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  async function handleServiceSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingService(true);
    setError('');
    setMessage('');
    try {
      const result = await api.saveMyService({
        serviceType: serviceForm.serviceType,
        serviceName: serviceForm.serviceName,
        mobile: serviceForm.mobile,
        notes: serviceForm.notes || null,
      });
      if (isServiceProvider) {
        setMessage(`${result.message} — تظهر الآن في صفحة الخدمات`);
      } else {
        setMessage(`${result.message}. فعّل "مقدم خدمة" لإظهارها في صفحة الخدمات`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ الخدمة');
    } finally {
      setSavingService(false);
    }
  }

  async function handleProviderToggle(checked: boolean) {
    setTogglingProvider(true);
    setError('');
    setMessage('');
    try {
      if (checked && (!serviceForm.serviceType || !serviceForm.serviceName || !serviceForm.mobile)) {
        setError('احفظ بيانات الخدمة أولاً قبل التفعيل');
        setTogglingProvider(false);
        return;
      }
      if (checked && serviceForm.serviceType && serviceForm.serviceName && serviceForm.mobile) {
        await api.saveMyService({
          serviceType: serviceForm.serviceType,
          serviceName: serviceForm.serviceName,
          mobile: serviceForm.mobile,
          notes: serviceForm.notes || null,
        });
      }
      const result = await api.setServiceProvider(checked);
      setIsServiceProvider(Boolean(result.resident.isServiceProvider));
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التحديث');
    } finally {
      setTogglingProvider(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setChangingPassword(true);
    try {
      const result = await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setMessage(result.message);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تغيير كلمة المرور');
    } finally {
      setChangingPassword(false);
    }
  }

  function resetDepForm() {
    setEditingDepId(null);
    setDepForm({ name: '', relation: 'زوج', mobile: '', email: '' });
  }

  function startEditDep(d: Dependent) {
    setEditingDepId(d.id);
    setDepForm({
      name: d.name,
      relation: RELATION_OPTIONS.includes(d.relation) ? d.relation : 'زوج',
      mobile: d.mobile,
      email: d.email || '',
    });
  }

  async function handleDependentSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingDep(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        name: depForm.name.trim(),
        relation: depForm.relation.trim(),
        mobile: depForm.mobile.trim(),
        email: depForm.email.trim() || null,
      };
      if (editingDepId) {
        await api.updateDependent(editingDepId, payload);
        setMessage('تم تحديث بيانات التابع');
      } else {
        await api.createDependent(payload);
        setMessage('تم إضافة التابع');
      }
      resetDepForm();
      setDependents(await api.getDependents());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل حفظ التابع');
    } finally {
      setSavingDep(false);
    }
  }

  async function handleDeleteDep(id: number) {
    if (!window.confirm('حذف هذا التابع؟')) return;
    try {
      await api.deleteDependent(id);
      setDependents(await api.getDependents());
      if (editingDepId === id) resetDepForm();
      setMessage('تم حذف التابع');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  }

  if (loading) return <div>جاري التحميل...</div>;

  const unitType = resident?.unitType;
  const showFloor = unitType ? unitType.hasFloor : resident?.floorNo != null && resident.floorNo !== 0;
  const showApartment = unitType ? unitType.hasApartment : resident?.apartmentNo != null && resident.apartmentNo !== '' && resident.apartmentNo !== '0';

  return (
    <div className="space-y-4">
      <PageHeader title="الملف الشخصي" />

      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>بيانات التسجيل (للعرض فقط)</CardTitle>
        </CardHeader>
        <CardContent>
          {resident ? (
            <FormRow>
              <FormField label="نوع السكن">
                <Input
                  value={resident.residentType === 'T' ? 'مستأجر' : resident.residentType === 'O' ? 'مالك' : '—'}
                  readOnly
                  disabled
                />
              </FormField>
            </FormRow>
          ) : null}
          {resident && (
            <>
              <FormRow>
                <FormField label="نوع الوحدة">
                  <Input value={displayValue(unitType?.name)} readOnly disabled />
                </FormField>
                <FormField label="الرسوم الشهرية">
                  <Input
                    value={
                      (unitType?.monthlyFees ?? resident.monthlyFees) != null
                        ? `${Number(unitType?.monthlyFees ?? resident.monthlyFees).toLocaleString()} ج.م`
                        : '—'
                    }
                    readOnly
                    disabled
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="المجاورة">
                  <Input value={displayValue(resident.area)} readOnly disabled />
                </FormField>
                <FormField label="القطعة">
                  <Input value={displayValue(resident.buildingNo)} readOnly disabled />
                </FormField>
                {showFloor && (
                  <FormField label="الدور">
                    <Input value={displayValue(resident.floorNo)} readOnly disabled />
                  </FormField>
                )}
                {showApartment && (
                  <FormField label="رقم الوحدة">
                    <Input value={displayValue(resident.apartmentNo)} readOnly disabled />
                  </FormField>
                )}
              </FormRow>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تعديل البيانات</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <FormRow>
              <FormField label="الاسم">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </FormField>
              <FormField label="البريد الإلكتروني">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </FormField>
            </FormRow>
            {(isOwner || resident) && (
              <FormRow>
                <FormField label="الموبايل">
                  <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </FormField>
                <FormField label="الهاتف الأرضي">
                  <Input
                    value={form.landLine}
                    onChange={(e) => setForm({ ...form, landLine: e.target.value })}
                    placeholder="—"
                  />
                </FormField>
                <FormField label="الجنسية">
                  <Input
                    value={form.nationality}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  />
                </FormField>
              </FormRow>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>بيانات الخدمة</CardTitle>
              <CardDescription className="mt-1.5">
                أدخل تفاصيل خدمتك. عند تفعيل مقدم خدمة تظهر في صفحة الخدمات.
              </CardDescription>
            </div>
            <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={isServiceProvider}
                disabled={togglingProvider}
                onChange={(e) => handleProviderToggle(e.target.checked)}
              />
              <span>{isServiceProvider ? 'نشط' : 'غير نشط'}</span>
            </label>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleServiceSubmit} className="space-y-4">
              <FormRow>
                <FormField label="نوع الخدمة">
                  <Select
                    value={serviceForm.serviceType}
                    onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value })}
                    required
                  >
                    <option value="">اختر...</option>
                    {serviceTypes.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="اسم الخدمة">
                  <Input
                    value={serviceForm.serviceName}
                    onChange={(e) => setServiceForm({ ...serviceForm, serviceName: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="موبايل التواصل">
                  <Input
                    value={serviceForm.mobile}
                    onChange={(e) => setServiceForm({ ...serviceForm, mobile: e.target.value })}
                    required
                  />
                </FormField>
              </FormRow>
              <FormField label="ملاحظات">
                <Textarea
                  value={serviceForm.notes}
                  onChange={(e) => setServiceForm({ ...serviceForm, notes: e.target.value })}
                  rows={2}
                />
              </FormField>
              <Button type="submit" disabled={savingService}>
                {savingService ? 'جاري الحفظ...' : 'حفظ بيانات الخدمة'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>التابعون</CardTitle>
            <CardDescription>
              أفراد مرتبطون بوحدتك للتسجيل فقط — بدون إمكانية تسجيل الدخول للنظام.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleDependentSubmit} className="space-y-4">
              <FormRow>
                <FormField label="الاسم">
                  <Input
                    value={depForm.name}
                    onChange={(e) => setDepForm({ ...depForm, name: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="صلة القرابة">
                  <Select
                    value={depForm.relation}
                    onChange={(e) => setDepForm({ ...depForm, relation: e.target.value })}
                    required
                  >
                    {RELATION_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="الموبايل">
                  <Input
                    value={depForm.mobile}
                    onChange={(e) => setDepForm({ ...depForm, mobile: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="البريد">
                  <Input
                    type="email"
                    value={depForm.email}
                    onChange={(e) => setDepForm({ ...depForm, email: e.target.value })}
                  />
                </FormField>
              </FormRow>
              <div className="flex gap-2">
                <Button type="submit" disabled={savingDep}>
                  {savingDep ? 'جاري الحفظ...' : editingDepId ? 'حفظ التعديل' : 'إضافة تابع'}
                </Button>
                {editingDepId && (
                  <Button type="button" variant="outline" onClick={resetDepForm}>
                    إلغاء
                  </Button>
                )}
              </div>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>صلة القرابة</TableHead>
                  <TableHead>الموبايل</TableHead>
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
                    <TableCell>{d.email || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEditDep(d)}>
                          تعديل
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteDep(d.id)}>
                          حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {dependents.length === 0 && (
              <p className="text-sm text-muted-foreground">لا يوجد تابعون مسجلون بعد.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>تغيير كلمة المرور</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <FormRow>
              <FormField label="كلمة المرور الحالية">
                <PasswordInput
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="كلمة المرور الجديدة">
                <PasswordInput
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  minLength={6}
                  required
                />
              </FormField>
              <FormField label="تأكيد كلمة المرور">
                <PasswordInput
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  minLength={6}
                  required
                />
              </FormField>
            </FormRow>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
