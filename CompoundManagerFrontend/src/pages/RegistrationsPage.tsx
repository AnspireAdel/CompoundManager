import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { UnitType, User } from '@/types';
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

type EditForm = {
  name: string;
  email: string;
  mobile: string;
  landLine: string;
  nationality: string;
  area: string;
  buildingNo: string;
  floorNo: number;
  apartmentNo: string;
  residentType: 'O' | 'T';
  monthlyFees: number;
  unitTypeId: string | number;
};

export default function RegistrationsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [fees, setFees] = useState<Record<number, number>>({});
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api.getPendingUsers().then(setUsers).catch(console.error);
  }

  useEffect(() => {
    load();
    api.getUnitTypes(true).then(setUnitTypes).catch(console.error);
  }, []);

  function openEdit(user: User) {
    const r = user.resident;
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      mobile: r?.mobile || '',
      landLine: r?.landLine || '',
      nationality: r?.nationality || 'مصري',
      area: r?.area || '',
      buildingNo: r?.buildingNo || '',
      floorNo: r?.floorNo ?? 1,
      apartmentNo: r?.apartmentNo != null ? String(r.apartmentNo) : '1',
      residentType: r?.residentType === 'T' ? 'T' : 'O',
      monthlyFees: r?.monthlyFees ?? 0,
      unitTypeId: r?.unitTypeId || '',
    });
    setError('');
  }

  function onUnitTypeChange(unitTypeId: string) {
    if (!form) return;
    const type = unitTypes.find((t) => t.id === Number(unitTypeId));
    setForm({
      ...form,
      unitTypeId,
      monthlyFees: type ? type.monthlyFees : form.monthlyFees,
      floorNo: type && !type.hasFloor ? 0 : form.floorNo || 1,
      apartmentNo: type && !type.hasApartment ? '0' : form.apartmentNo || '1',
    });
  }

  function closeEdit() {
    setEditing(null);
    setForm(null);
    setError('');
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    setError('');
    try {
      const selectedEditType = unitTypes.find((t) => t.id === Number(form.unitTypeId));
      await api.updatePendingRegistration(editing.id, {
        ...form,
        floorNo: selectedEditType?.hasFloor ? Number(form.floorNo) : 0,
        apartmentNo: selectedEditType?.hasApartment ? String(form.apartmentNo).trim() : '0',
        monthlyFees: Number(form.monthlyFees),
        unitTypeId: form.unitTypeId ? Number(form.unitTypeId) : undefined,
        landLine: form.landLine || null,
      });
      if (form.monthlyFees) {
        setFees((prev) => ({ ...prev, [editing.id]: form.monthlyFees }));
      }
      closeEdit();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التعديل');
    } finally {
      setSaving(false);
    }
  }

  async function approve(user: User) {
    await api.approveUser(user.id, fees[user.id] ?? user.resident?.monthlyFees);
    load();
  }

  async function reject(user: User) {
    const reason = prompt('سبب الرفض؟') || 'تم رفض طلب التسجيل';
    await api.rejectUser(user.id, reason);
    load();
  }

  const selectedEditType = form
    ? unitTypes.find((t) => t.id === Number(form.unitTypeId))
    : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title="طلبات التسجيل" />

      {error && <Alert variant="destructive">{error}</Alert>}

      {editing && form && (
        <Card>
          <CardHeader>
            <CardTitle>تعديل طلب التسجيل — قبل الموافقة</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveEdit} className="space-y-4">
              <FormRow>
                <FormField label="الاسم">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
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
                <FormField label="نوع السكن">
                  <Select
                    value={form.residentType}
                    onChange={(e) =>
                      setForm({ ...form, residentType: e.target.value as 'O' | 'T' })
                    }
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
              </FormRow>
              <FormRow>
                <FormField label="الموبايل">
                  <Input
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    required
                  />
                </FormField>
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
                    maxLength={3}
                    required
                  />
                </FormField>
                {selectedEditType?.hasFloor !== false && (
                  <FormField label="الدور">
                    <Input
                      type="number"
                      value={form.floorNo}
                      onChange={(e) => setForm({ ...form, floorNo: +e.target.value })}
                      required
                    />
                  </FormField>
                )}
                {selectedEditType?.hasApartment !== false && (
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
              <FormRow>
                <FormField label="الهاتف الأرضي">
                  <Input
                    value={form.landLine}
                    onChange={(e) => setForm({ ...form, landLine: e.target.value })}
                  />
                </FormField>
                <FormField label="الجنسية">
                  <Input
                    value={form.nationality}
                    onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  />
                </FormField>
                <FormField label="الرسوم الشهرية">
                  <Input type="number" value={form.monthlyFees} readOnly disabled />
                </FormField>
              </FormRow>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </Button>
                <Button type="button" variant="outline" onClick={closeEdit}>
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {users.length === 0 ? (
            <EmptyState>لا توجد طلبات قيد المراجعة</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>نوع الوحدة</TableHead>
                  <TableHead>الوحدة</TableHead>
                  <TableHead>الموبايل</TableHead>
                  <TableHead>الرسوم الشهرية</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.resident?.residentType === 'T' ? 'مستأجر' : 'مالك'}</TableCell>
                    <TableCell>{u.resident?.unitType?.name || '—'}</TableCell>
                    <TableCell>
                      {u.resident
                        ? `${u.resident.area}-${u.resident.buildingNo} / ${u.resident.floorNo} / ${u.resident.apartmentNo}`
                        : '—'}
                    </TableCell>
                    <TableCell>{u.resident?.mobile || '—'}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="اختياري"
                        className="w-28"
                        value={fees[u.id] ?? u.resident?.monthlyFees ?? ''}
                        onChange={(e) => setFees({ ...fees, [u.id]: +e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                          تعديل
                        </Button>
                        <Button variant="success" size="sm" onClick={() => approve(u)}>
                          موافقة
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => reject(u)}>
                          رفض
                        </Button>
                      </div>
                    </TableCell>
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
