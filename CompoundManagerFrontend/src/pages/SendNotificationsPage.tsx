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
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [buildingArea, setBuildingArea] = useState('');
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
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
    if (!buildingArea) return [];
    const list = residents
      .filter((r) => r.area === buildingArea)
      .map((r) => r.buildingNo);
    return Array.from(new Set(list.filter(Boolean))).sort();
  }, [residents, buildingArea]);

  const owners = useMemo(() => residents, [residents]);

  function toggleArea(a: string) {
    setSelectedAreas((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  function toggleBuilding(b: string) {
    setSelectedBuildings((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  }

  const previewCount = useMemo(() => {
    if (target === 'owner') return residentId ? 1 : 0;
    if (target === 'area') {
      if (selectedAreas.length === 0) return 0;
      return residents.filter((r) => selectedAreas.includes(r.area)).length;
    }
    if (!buildingArea || selectedBuildings.length === 0) return 0;
    return residents.filter(
      (r) => r.area === buildingArea && selectedBuildings.includes(r.buildingNo)
    ).length;
  }, [target, residentId, residents, selectedAreas, buildingArea, selectedBuildings]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);
    try {
      let result;
      if (target === 'area') {
        if (selectedAreas.length === 0) {
          setError('اختر مجاورة واحدة على الأقل');
          setSending(false);
          return;
        }
        result = await api.sendNotification({
          target: 'area',
          areas: selectedAreas,
          title,
          message,
        });
      } else if (target === 'building') {
        if (!buildingArea || selectedBuildings.length === 0) {
          setError('اختر المجاورة والقطع');
          setSending(false);
          return;
        }
        result = await api.sendNotification({
          target: 'building',
          area: buildingArea,
          buildings: selectedBuildings,
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
                    onChange={() => {
                      setTarget('area');
                      setSelectedBuildings([]);
                      setBuildingArea('');
                      setResidentId('');
                    }}
                  />
                  ملاك مجاورة
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    className="size-4"
                    checked={target === 'building'}
                    onChange={() => {
                      setTarget('building');
                      setSelectedAreas([]);
                      setResidentId('');
                    }}
                  />
                  ملاك قطعة
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    className="size-4"
                    checked={target === 'owner'}
                    onChange={() => {
                      setTarget('owner');
                      setSelectedAreas([]);
                      setSelectedBuildings([]);
                      setBuildingArea('');
                    }}
                  />
                  مالك محدد
                </label>
              </div>
            </FormField>

            {target === 'area' && (
              <FormField label="المجاورات (اختر واحدة أو أكتر)">
                <div className="flex flex-wrap gap-2 rounded-md border p-3">
                  {areas.length === 0 && (
                    <span className="text-sm text-muted-foreground">لا توجد مجاورات</span>
                  )}
                  {areas.map((a) => (
                    <label
                      key={a}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                    >
                      <input
                        type="checkbox"
                        className="size-3.5"
                        checked={selectedAreas.includes(a)}
                        onChange={() => toggleArea(a)}
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </FormField>
            )}

            {target === 'building' && (
              <FormRow>
                <FormField label="المجاورة">
                  <Select
                    value={buildingArea}
                    onChange={(e) => {
                      setBuildingArea(e.target.value);
                      setSelectedBuildings([]);
                    }}
                    required
                  >
                    <option value="">اختر المجاورة...</option>
                    {areas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </Select>
                </FormField>
                {buildingArea && (
                  <FormField label="القطع (اختر واحدة أو أكتر)">
                    <div className="flex flex-wrap gap-2 rounded-md border p-3">
                      {buildings.length === 0 && (
                        <span className="text-sm text-muted-foreground">لا توجد قطع</span>
                      )}
                      {buildings.map((b) => (
                        <label
                          key={b}
                          className="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                        >
                          <input
                            type="checkbox"
                            className="size-3.5"
                            checked={selectedBuildings.includes(b)}
                            onChange={() => toggleBuilding(b)}
                          />
                          {b}
                        </label>
                      ))}
                    </div>
                  </FormField>
                )}
              </FormRow>
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
