import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { ServiceType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, EmptyState, FormField } from '@/components/ui-helpers';

export default function ServiceTypesPage() {
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    api.getServiceTypes(true).then(setTypes).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.createServiceType(name.trim());
      setName('');
      setMessage('تم إضافة نوع الخدمة');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإضافة');
    }
  }

  async function handleUpdate(id: number) {
    setError('');
    try {
      await api.updateServiceType(id, { name: editName.trim() });
      setEditingId(null);
      setMessage('تم التعديل');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل التعديل');
    }
  }

  async function handleToggle(id: number) {
    await api.toggleServiceType(id);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف نوع الخدمة؟')) return;
    setError('');
    try {
      await api.deleteServiceType(id);
      setMessage('تم الحذف');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحذف');
    }
  }

  return (
    <div>
      <PageHeader title="أنواع الخدمات" />

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

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">إضافة نوع جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <FormField label="اسم النوع" className="mb-0 min-w-[200px] flex-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: طب، تعليم..."
                required
                maxLength={30}
              />
            </FormField>
            <Button type="submit">إضافة</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
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
                    <Badge variant={t.activeFlag === 'Y' ? 'success' : 'destructive'}>
                      {t.activeFlag === 'Y' ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {editingId === t.id ? (
                        <>
                          <Button variant="success" onClick={() => handleUpdate(t.id)}>
                            حفظ
                          </Button>
                          <Button variant="outline" onClick={() => setEditingId(null)}>
                            إلغاء
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingId(t.id);
                              setEditName(t.name);
                            }}
                          >
                            تعديل
                          </Button>
                          <Button variant="outline" onClick={() => handleToggle(t.id)}>
                            {t.activeFlag === 'Y' ? 'إيقاف' : 'تفعيل'}
                          </Button>
                          <Button variant="destructive" onClick={() => handleDelete(t.id)}>
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
          {types.length === 0 && <EmptyState>لا توجد أنواع خدمات</EmptyState>}
        </CardContent>
      </Card>
    </div>
  );
}
