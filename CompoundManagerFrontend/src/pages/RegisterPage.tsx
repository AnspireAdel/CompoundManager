import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import PasswordInput from '@/components/PasswordInput';
import { FormRow } from '@/components/ui-helpers';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { UnitType } from '@/types';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    mobile: '',
    landLine: '',
    nationality: 'مصري',
    area: '',
    buildingNo: '',
    floorNo: 1,
    apartmentNo: 1,
    residentType: 'O' as 'O' | 'T',
    unitTypeId: '' as string | number,
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getUnitTypes().then((types) => {
      setUnitTypes(types);
      if (types[0]) setForm((f) => ({ ...f, unitTypeId: types[0].id }));
    }).catch(console.error);
  }, []);

  const selectedType = unitTypes.find((t) => t.id === Number(form.unitTypeId));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (form.password !== form.confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (!form.unitTypeId) {
      setError('اختر نوع الوحدة');
      return;
    }
    setLoading(true);
    try {
      const { confirmPassword: _, ...payload } = form;
      const result = await api.register({
        ...payload,
        floorNo: selectedType?.hasFloor ? Number(form.floorNo) : 0,
        apartmentNo: selectedType?.hasApartment ? Number(form.apartmentNo) : 0,
        unitTypeId: Number(form.unitTypeId),
        landLine: form.landLine || undefined,
      });
      setMessage(result.message);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التسجيل');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">تسجيل حساب جديد</CardTitle>
          <CardDescription>بعد التسجيل يجب موافقة المدير قبل الدخول</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              {error}
            </Alert>
          )}
          {message && (
            <Alert variant="success" className="mb-4">
              {message}
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormRow>
              <div className="space-y-2">
                <Label htmlFor="name">الاسم</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">الموبايل</Label>
                <Input
                  id="mobile"
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  required
                />
              </div>
            </FormRow>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <PasswordInput
                id="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <PasswordInput
                id="confirmPassword"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                minLength={6}
                required
              />
            </div>
            <FormRow>
              <div className="space-y-2">
                <Label htmlFor="residentType">نوع السكن</Label>
                <Select
                  id="residentType"
                  value={form.residentType}
                  onChange={(e) => setForm({ ...form, residentType: e.target.value as 'O' | 'T' })}
                  required
                >
                  <option value="O">مالك</option>
                  <option value="T">مستأجر</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitTypeId">نوع الوحدة</Label>
                <Select
                  id="unitTypeId"
                  value={form.unitTypeId}
                  onChange={(e) => setForm({ ...form, unitTypeId: e.target.value })}
                  required
                >
                  <option value="">اختر...</option>
                  {unitTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.monthlyFees} ج.م/شهر
                    </option>
                  ))}
                </Select>
                {selectedType && (
                  <p className="text-xs text-muted-foreground">
                    الرسوم الشهرية: {selectedType.monthlyFees.toLocaleString()} ج.م
                  </p>
                )}
              </div>
            </FormRow>
            <FormRow>
              <div className="space-y-2">
                <Label htmlFor="area">المجاورة</Label>
                <Input
                  id="area"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  maxLength={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buildingNo">القطعة</Label>
                <Input
                  id="buildingNo"
                  value={form.buildingNo}
                  onChange={(e) => setForm({ ...form, buildingNo: e.target.value })}
                  maxLength={3}
                  required
                />
              </div>
              {selectedType?.hasFloor !== false && (
                <div className="space-y-2">
                  <Label htmlFor="floorNo">الدور</Label>
                  <Input
                    id="floorNo"
                    type="number"
                    value={form.floorNo}
                    onChange={(e) => setForm({ ...form, floorNo: +e.target.value })}
                    required
                  />
                </div>
              )}
              {selectedType?.hasApartment !== false && (
                <div className="space-y-2">
                  <Label htmlFor="apartmentNo">الشقة</Label>
                  <Input
                    id="apartmentNo"
                    type="number"
                    value={form.apartmentNo}
                    onChange={(e) => setForm({ ...form, apartmentNo: +e.target.value })}
                    required
                  />
                </div>
              )}
            </FormRow>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'جاري الإرسال...' : 'إرسال طلب التسجيل'}
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              العودة لتسجيل الدخول
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
