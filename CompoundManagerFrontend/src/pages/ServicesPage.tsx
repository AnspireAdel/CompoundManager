import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { Resident, Service, ServiceType } from '@/types';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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

export default function ServicesPage() {
  const { isAdmin, isAccountant } = useAuth();
  const isStaff = isAdmin || isAccountant;

  const [services, setServices] = useState<Service[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    serviceType: '',
    serviceName: '',
    mobile: '',
    notes: '',
    residentId: '' as string | number,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      if (isStaff) {
        const [all, people, types] = await Promise.all([
          api.getServices(true),
          api.getResidents(),
          api.getServiceTypes(true),
        ]);
        setServices(all);
        setResidents(people);
        setServiceTypes(types);
      } else {
        const [list, types] = await Promise.all([
          api.getServices(),
          api.getServiceTypes(),
        ]);
        setServices(list);
        setServiceTypes(types);
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { load(); }, [isStaff]);

  const typeOptions = useMemo(() => {
    const fromApi = serviceTypes.map((t) => t.name);
    const fromData = services.map((s) => s.serviceType);
    return Array.from(new Set([...fromApi, ...fromData])).filter(Boolean).sort();
  }, [serviceTypes, services]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (typeFilter && s.serviceType !== typeFilter) return false;
      if (isStaff && statusFilter === 'active' && s.activeFlag !== 'Y') return false;
      if (isStaff && statusFilter === 'inactive' && s.activeFlag === 'Y') return false;
      if (!q) return true;
      const haystack = [
        s.serviceType,
        s.serviceName,
        s.mobile,
        s.notes,
        s.resident?.residentName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [services, typeFilter, statusFilter, search, isStaff]);

  function startEdit(s: Service) {
    setEditingId(s.id);
    setForm({
      serviceType: s.serviceType,
      serviceName: s.serviceName,
      mobile: s.mobile,
      notes: s.notes || '',
      residentId: s.residentId ?? '',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ serviceType: '', serviceName: '', mobile: '', notes: '', residentId: '' });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        serviceType: form.serviceType,
        serviceName: form.serviceName,
        mobile: form.mobile,
        notes: form.notes || undefined,
        residentId: form.residentId ? Number(form.residentId) : null,
      };
      if (editingId) {
        await api.updateService(editingId, payload);
        setMessage('تم تعديل الخدمة');
      } else {
        await api.createService(payload);
        setMessage('تم إضافة الخدمة');
      }
      cancelForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الحفظ');
    }
  }

  async function handleToggleActive(id: number) {
    await api.toggleService(id);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('حذف هذه الخدمة؟')) return;
    await api.deleteService(id);
    load();
  }

  function onResidentChange(residentId: string) {
    const resident = residents.find((r) => r.id === Number(residentId));
    setForm({
      ...form,
      residentId,
      mobile: resident?.mobile || form.mobile,
    });
  }

  function clearFilters() {
    setTypeFilter('');
    setStatusFilter('');
    setSearch('');
  }

  const hasFilters = Boolean(typeFilter || statusFilter || search);

  return (
    <div className="space-y-4">
      <PageHeader title="خدمات الوحدات">
        {isStaff && (
          <Button onClick={() => showForm ? cancelForm() : setShowForm(true)}>
            {showForm ? 'إلغاء' : '+ إضافة خدمة'}
          </Button>
        )}
      </PageHeader>

      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      {showForm && isStaff && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'تعديل خدمة' : 'إضافة خدمة'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormRow>
                <FormField label="نوع الخدمة">
                  <Select
                    value={form.serviceType}
                    onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
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
                    value={form.serviceName}
                    onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="مقدم الخدمة (اختياري)">
                  <Select value={form.residentId} onChange={(e) => onResidentChange(e.target.value)}>
                    <option value="">بدون مقدم خدمة</option>
                    {residents.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.residentName} — {r.area}-{r.buildingNo}/{r.apartmentNo}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="الموبايل">
                  <Input
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    required
                  />
                </FormField>
              </FormRow>
              <FormField label="ملاحظات">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </FormField>
              <div className="flex gap-2">
                <Button type="submit">حفظ</Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={cancelForm}>إلغاء</Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <FormRow className="items-end">
            <FormField label="نوع الخدمة" className="mb-0">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">الكل</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormField>
            {isStaff && (
              <FormField label="الحالة" className="mb-0">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">الكل</option>
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </Select>
              </FormField>
            )}
            <FormField label="بحث" className="mb-0 sm:col-span-2 lg:col-span-1">
              <Input
                placeholder="اسم الخدمة، المالك، الموبايل..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </FormField>
            {hasFilters && (
              <div className="flex items-end pb-0.5">
                <Button type="button" variant="outline" onClick={clearFilters}>
                  مسح الفلتر
                </Button>
              </div>
            )}
          </FormRow>
          <p className="mt-3 text-sm text-muted-foreground">
            عرض {filtered.length} من {services.length}
          </p>
        </CardContent>
      </Card>

      {isStaff ? (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النوع</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>المالك</TableHead>
                  <TableHead>الموبايل</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.serviceType}</TableCell>
                    <TableCell>{s.serviceName}</TableCell>
                    <TableCell>{s.resident?.residentName || '—'}</TableCell>
                    <TableCell>{s.mobile}</TableCell>
                    <TableCell>
                      <Badge variant={s.activeFlag === 'Y' ? 'success' : 'destructive'}>
                        {s.activeFlag === 'Y' ? 'نشط' : 'غير نشط'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(s)}>
                          تعديل
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleToggleActive(s.id)}>
                          {s.activeFlag === 'Y' ? 'إيقاف' : 'تفعيل'}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(s.id)}>
                          حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length === 0 && <EmptyState>لا توجد خدمات مطابقة</EmptyState>}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-6">
                  <div className="mb-2 flex justify-between">
                    <Badge variant="info">{s.serviceType}</Badge>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{s.serviceName}</h3>
                  {s.resident && (
                    <p className="text-sm text-muted-foreground">
                      {s.resident.residentName}
                      {s.resident.area != null && (
                        <> — المجاورة {s.resident.area} / القطعة {s.resident.buildingNo}</>
                      )}
                    </p>
                  )}
                  <p className="mt-2">📞 {s.mobile}</p>
                  {s.notes && (
                    <p className="mt-2 text-sm text-muted-foreground">{s.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {filtered.length === 0 && <EmptyState>لا توجد خدمات مطابقة</EmptyState>}
        </>
      )}
    </div>
  );
}
