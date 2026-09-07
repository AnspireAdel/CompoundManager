import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { UnitType } from '@/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, FormField, FormRow, PageHeader } from '@/components/ui-helpers';
import { cn } from '@/lib/utils';

export default function UnitTypesPage() {
  const [types, setTypes] = useState<UnitType[]>([]);
  const [name, setName] = useState('');
  const [monthlyFees, setMonthlyFees] = useState(500);
  const [hasFloor, setHasFloor] = useState(true);
  const [hasApartment, setHasApartment] = useState(true);
  const [showOnRegister, setShowOnRegister] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editFees, setEditFees] = useState(0);
  const [editHasFloor, setEditHasFloor] = useState(true);
  const [editHasApartment, setEditHasApartment] = useState(true);
  const [editShowOnRegister, setEditShowOnRegister] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    api.getUnitTypes(true).then(setTypes).catch(console.error);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.createUnitType({
        name: name.trim(),
        monthlyFees: Number(monthlyFees),
        hasFloor,
        hasApartment,
        showOnRegister,
      });
      setName('');
      setMonthlyFees(500);
      setHasFloor(true);
      setHasApartment(true);
      setShowOnRegister(true);
      setMessage('تم إضافة نوع الوحدة');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإضافة');
    }
  }

  async function handleUpdate(id: number) {
    setError('');
    try {
      await api.updateUnitType(id, {
        name: editName.trim(),
        monthlyFees: Number(editFees),
        hasFloor: editHasFloor,
        hasApartment: editHasApartment,
        showOnRegister: editShowOnRegister,
      });
      setEditingId(null);
      setMessage('تم التعديل');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التعديل');
    }
  }

  async function handleToggle(id: number) {
    await api.toggleUnitType(id);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف نوع الوحدة؟')) return;
    setError('');
    try {
      await api.deleteUnitType(id);
      setMessage('تم الحذف');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="أنواع الوحدات" />

      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>إضافة نوع جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormRow>
              <FormField label="اسم النوع">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="شقة، فيلا، بدروم، روف..."
                  required
                  maxLength={40}
                />
              </FormField>
              <FormField label="الرسوم الشهرية (ج.م)">
                <Input
                  type="number"
                  min={0}
                  value={monthlyFees}
                  onChange={(e) => setMonthlyFees(+e.target.value)}
                  required
                />
              </FormField>
            </FormRow>
            <FormRow>
              <Label className="mb-4 flex cursor-pointer items-center gap-2 font-normal">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={hasFloor}
                  onChange={(e) => setHasFloor(e.target.checked)}
                />
                يحتوي على دور
              </Label>
              <Label className="mb-4 flex cursor-pointer items-center gap-2 font-normal">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={hasApartment}
                  onChange={(e) => setHasApartment(e.target.checked)}
                />
                يحتوي على شقة
              </Label>
              <Label className="mb-4 flex cursor-pointer items-center gap-2 font-normal">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={showOnRegister}
                  onChange={(e) => setShowOnRegister(e.target.checked)}
                />
                يظهر في التسجيل الجديد
              </Label>
            </FormRow>
            <Button type="submit">إضافة</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>الرسوم الشهرية</TableHead>
                <TableHead>دور</TableHead>
                <TableHead>شقة</TableHead>
                <TableHead>التسجيل الجديد</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    {editingId === t.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      t.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === t.id ? (
                      <Input
                        type="number"
                        min={0}
                        value={editFees}
                        onChange={(e) => setEditFees(+e.target.value)}
                        className="w-32"
                      />
                    ) : (
                      `${t.monthlyFees.toLocaleString()} ج.م`
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === t.id ? (
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={editHasFloor}
                        onChange={(e) => setEditHasFloor(e.target.checked)}
                      />
                    ) : (
                      t.hasFloor ? 'نعم' : 'لا'
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === t.id ? (
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={editHasApartment}
                        onChange={(e) => setEditHasApartment(e.target.checked)}
                      />
                    ) : (
                      t.hasApartment ? 'نعم' : 'لا'
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === t.id ? (
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={editShowOnRegister}
                        onChange={(e) => setEditShowOnRegister(e.target.checked)}
                      />
                    ) : (
                      t.showOnRegister !== false ? 'نعم' : 'لا'
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold',
                        t.activeFlag === 'Y'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      )}
                    >
                      {t.activeFlag === 'Y' ? 'نشط' : 'غير نشط'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {editingId === t.id ? (
                        <>
                          <Button variant="success" size="sm" onClick={() => handleUpdate(t.id)}>
                            حفظ
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                            إلغاء
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingId(t.id);
                              setEditName(t.name);
                              setEditFees(t.monthlyFees);
                              setEditHasFloor(t.hasFloor);
                              setEditHasApartment(t.hasApartment);
                              setEditShowOnRegister(t.showOnRegister !== false);
                            }}
                          >
                            تعديل
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleToggle(t.id)}>
                            {t.activeFlag === 'Y' ? 'إيقاف' : 'تفعيل'}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(t.id)}>
                            حذف
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {types.length === 0 && <EmptyState>لا توجد أنواع وحدات</EmptyState>}
        </CardContent>
      </Card>
    </div>
  );
}
