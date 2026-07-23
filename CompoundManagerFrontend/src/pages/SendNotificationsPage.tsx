import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import type { Resident } from '@/types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormRow, PageHeader } from '@/components/ui-helpers';

type Target = 'area' | 'building' | 'owner';

export default function SendNotificationsPage() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [target, setTarget] = useState<Target>('area');
  const [area, setArea] = useState('');
  const [buildingNo, setBuildingNo] = useState('');
  const [residentId, setResidentId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getResidents().then(setResidents).catch(console.error);
  }, []);

  const areas = useMemo(
    () => Array.from(new Set(residents.map((r) => r.area).filter(Boolean))).sort(),
    [residents]
  );

  const buildings = useMemo(() => {
    const list = residents
      .filter((r) => !area || r.area === area)
      .map((r) => r.buildingNo);
    return Array.from(new Set(list.filter(Boolean))).sort();
  }, [residents, area]);

  const owners = useMemo(
    () =>
      residents.filter((r) => {
        if (area && r.area !== area) return false;
        if (buildingNo && r.buildingNo !== buildingNo) return false;
        return true;
      }),
    [residents, area, buildingNo]
  );

  const previewCount = useMemo(() => {
    if (target === 'owner') return residentId ? 1 : 0;
    if (target === 'area') return area ? residents.filter((r) => r.area === area).length : 0;
    if (!area || !buildingNo) return 0;
    return residents.filter((r) => r.area === area && r.buildingNo === buildingNo).length;
  }, [target, residentId, residents, area, buildingNo]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);
    try {
      let result;
      if (target === 'area') {
        result = await api.sendNotification({ target: 'area', area, title, message });
      } else if (target === 'building') {
        result = await api.sendNotification({
          target: 'building',
          area,
          buildingNo,
          title,
          message,
        });
      } else {
        result = await api.sendNotification({
          target: 'owner',
          residentId: Number(residentId),
          title,
          message,
        });
      }
      setSuccess(`تم إرسال الإشعار إلى ${result.sent} مالك`);
      setTitle('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الإرسال');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="إرسال إشعارات" />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="نوع المستلمين">
              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    className="size-4"
                    checked={target === 'area'}
                    onChange={() => setTarget('area')}
                  />
                  ملاك مجاورة
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    className="size-4"
                    checked={target === 'building'}
                    onChange={() => setTarget('building')}
                  />
                  ملاك قطعة
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    className="size-4"
                    checked={target === 'owner'}
                    onChange={() => setTarget('owner')}
                  />
                  مالك محدد
                </label>
              </div>
            </FormField>

            <FormRow>
              {target !== 'owner' && (
                <FormField label="المجاورة">
                  <Select
                    value={area}
                    onChange={(e) => {
                      setArea(e.target.value);
                      setBuildingNo('');
                    }}
                    required
                  >
                    <option value="">اختر...</option>
                    {areas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </Select>
                </FormField>
              )}

              {target === 'building' && (
                <FormField label="القطعة">
                  <Select
                    value={buildingNo}
                    onChange={(e) => setBuildingNo(e.target.value)}
                    required
                  >
                    <option value="">اختر...</option>
                    {buildings.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </Select>
                </FormField>
              )}

              {target === 'owner' && (
                <FormField label="المالك">
                  <Select
                    value={residentId}
                    onChange={(e) => setResidentId(e.target.value)}
                    required
                  >
                    <option value="">اختر...</option>
                    {owners.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.residentName} — {r.area}-{r.buildingNo} / {r.floorNo} / {r.apartmentNo}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
            </FormRow>

            <FormField label="عنوان الإشعار">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
            </FormField>
            <FormField label="نص الإشعار">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                maxLength={1000}
              />
            </FormField>

            <p className="text-sm text-muted-foreground">
              المستلمون المتوقعون: {previewCount}
            </p>

            {error && <Alert variant="destructive">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <Button type="submit" disabled={sending}>
              {sending ? 'جاري الإرسال...' : 'إرسال الإشعار'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
