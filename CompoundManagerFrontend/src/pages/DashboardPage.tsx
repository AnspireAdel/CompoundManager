import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { DashboardStats, Bill } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui-helpers';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusLabel: Record<string, string> = {
  ISSUED: 'مستحقة',
  DUE: 'مستحقة',
  PAID: 'مدفوعة',
  OVERDUE: 'متأخرة',
  PARTIAL: 'جزئية',
  DRAFT: 'مسودة',
  PENDING_REVIEW: 'بانتظار المراجعة',
};

const CHART_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
const STATUS_COLORS: Record<string, string> = {
  مدفوعة: '#16a34a',
  مستحقة: '#2563eb',
  متأخرة: '#dc2626',
  جزئية: '#d97706',
  'بانتظار المراجعة': '#7c3aed',
  مسودة: '#64748b',
};

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="h-[240px] w-full min-w-0 sm:h-[280px]">{children}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      لا توجد بيانات كافية للرسم
    </div>
  );
}

export default function DashboardPage() {
  const { isOwner, isAdmin, isAccountant } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [myBills, setMyBills] = useState<Bill[]>([]);
  const [unread, setUnread] = useState(0);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loadingYear, setLoadingYear] = useState(false);

  useEffect(() => {
    if (isAdmin || isAccountant) {
      setLoadingYear(true);
      api
        .getDashboard(selectedYear)
        .then(setStats)
        .catch(console.error)
        .finally(() => setLoadingYear(false));
    }
    if (isOwner) {
      api.getBills().then(setMyBills).catch(console.error);
    }
    api.getUnreadCount().then((r) => setUnread(r.count)).catch(console.error);
  }, [isAdmin, isAccountant, isOwner, selectedYear]);

  const ownerStatusChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of myBills) {
      const label = statusLabel[b.status] || b.status;
      map.set(label, (map.get(label) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [myBills]);

  if (isOwner) {
    const unpaid = myBills.filter((b) => !['PAID'].includes(b.status));
    return (
      <div className="space-y-4">
        <PageHeader title="مرحباً بك" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">فواتير غير مدفوعة</div>
              <div className="text-2xl font-bold">{unpaid.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">إشعارات جديدة</div>
              <div className="text-2xl font-bold">{unread}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard title="حالة فواتيري">
            {ownerStatusChart.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={ownerStatusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {ownerStatusChart.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || CHART_COLORS[0]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">فواتيري الأخيرة</CardTitle>
          </CardHeader>
          <CardContent>
            {myBills.length === 0 ? (
              <EmptyState>لا توجد فواتير</EmptyState>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>الفاتورة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>تاريخ الاستحقاق</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myBills.slice(0, 5).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.billType === 'EXTRA' ? 'إضافية' : 'شهرية'}</TableCell>
                      <TableCell>{b.billType === 'EXTRA' ? (b.title || 'فاتورة إضافية') : b.period}</TableCell>
                      <TableCell>{b.amount} ج.م</TableCell>
                      <TableCell>{new Date(b.dueDate).toLocaleDateString('ar-EG')}</TableCell>
                      <TableCell><StatusBadge status={b.status} /></TableCell>
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

  if (!stats) return <EmptyState>جاري التحميل...</EmptyState>;

  const unitCountData = (stats.unitTypeBreakdown || []).map((r) => ({
    name: r.name,
    count: r.count,
    value: r.totalValue,
  }));
  const billStatusData = (stats.billStatusBreakdown || []).map((s) => ({
    name: s.name,
    value: s.count,
    amount: s.amount,
  }));
  const residentTypeData = (stats.residentTypeBreakdown || []).map((r) => ({
    name: r.name,
    value: r.count,
  }));
  const trendData = stats.monthlyTrend || [];
  const yearlyRows = stats.yearlyMonthly || [];
  const yearlyTotals = stats.yearlyTotals;
  const years = stats.availableYears?.length
    ? stats.availableYears
    : [selectedYear];

  return (
    <div className="space-y-4">
      <PageHeader title="لوحة التحكم" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5 text-center">
            <div className="text-sm text-muted-foreground">عدد الوحدات</div>
            <div className="text-2xl font-bold">{stats.totalUnits ?? stats.totalResidents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <div className="text-sm text-muted-foreground">الصيانة الشهرية</div>
            <div className="text-2xl font-bold break-words">{(stats.monthlyMaintenance ?? 0).toLocaleString()} ج.م</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <div className="text-sm text-muted-foreground">عدد الفواتير المتبقية</div>
            <div className="text-2xl font-bold text-destructive">{stats.unpaidBills}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <div className="text-sm text-muted-foreground">إجمالي المستحقات</div>
            <div className="text-2xl font-bold break-words">{stats.totalOutstanding.toLocaleString()} ج.م</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">الصيانة حسب نوع الوحدة</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نوع الوحدة</TableHead>
                <TableHead>عدد الوحدات</TableHead>
                <TableHead>قيمة الصيانة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stats.unitTypeBreakdown || []).map((row) => (
                <TableRow key={row.name}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.count}</TableCell>
                  <TableCell>{row.totalValue.toLocaleString()} ج.م</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>الإجمالي</TableCell>
                <TableCell>{stats.totals?.count ?? 0}</TableCell>
                <TableCell>{(stats.totals?.value ?? 0).toLocaleString()} ج.م</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">الملخص الشهري</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="dashboard-year" className="text-muted-foreground">السنة</Label>
            <Select
              id="dashboard-year"
              className="w-28"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              disabled={loadingYear}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingYear ? (
            <EmptyState>جاري التحميل...</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الشهر</TableHead>
                  <TableHead>المُصدره</TableHead>
                  <TableHead>المحصّله</TableHead>
                  <TableHead>المتبقيه</TableHead>
                  <TableHead>المصاريف</TableHead>
                  <TableHead>الصافي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearlyRows.map((row) => (
                  <TableRow key={row.monthKey}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell>{row.issued.toLocaleString()} ج.م</TableCell>
                    <TableCell>{row.collected.toLocaleString()} ج.م</TableCell>
                    <TableCell>{row.remaining.toLocaleString()} ج.م</TableCell>
                    <TableCell>{(row.expenses ?? 0).toLocaleString()} ج.م</TableCell>
                    <TableCell className={(row.net ?? 0) < 0 ? 'text-destructive' : undefined}>
                      {(row.net ?? 0).toLocaleString()} ج.م
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {yearlyTotals && (
                <TableFooter>
                  <TableRow>
                    <TableCell>الإجمالي</TableCell>
                    <TableCell>{yearlyTotals.issued.toLocaleString()} ج.م</TableCell>
                    <TableCell>{yearlyTotals.collected.toLocaleString()} ج.م</TableCell>
                    <TableCell>{yearlyTotals.remaining.toLocaleString()} ج.م</TableCell>
                    <TableCell>{(yearlyTotals.expenses ?? 0).toLocaleString()} ج.م</TableCell>
                    <TableCell className={(yearlyTotals.net ?? 0) < 0 ? 'text-destructive' : undefined}>
                      {(yearlyTotals.net ?? 0).toLocaleString()} ج.م
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="الإصدار والتحصيل (آخر 6 أشهر)">
          {trendData.every((d) => d.issued === 0 && d.collected === 0) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `${Number(v).toLocaleString()} ج.م`} />
                <Legend />
                <Line type="monotone" dataKey="issued" name="مُصدر" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="collected" name="محصّل" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="حالة الفواتير">
          {billStatusData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={billStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ value, payload }) =>
                    `${value} · ${(payload.amount || 0).toLocaleString()} ج.م`
                  }
                >
                  {billStatusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || CHART_COLORS[0]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(_v, _n, item) => {
                    const p = item.payload as { value: number; amount: number; name: string };
                    return [
                      `${p.value} فاتورة — ${(p.amount || 0).toLocaleString()} ج.م`,
                      p.name,
                    ];
                  }}
                />
                <Legend
                  formatter={(value, entry) => {
                    const amount = (entry.payload as { amount?: number } | undefined)?.amount || 0;
                    return `${value} (${amount.toLocaleString()} ج.م)`;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="عدد الوحدات حسب النوع">
          {unitCountData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer>
              <BarChart data={unitCountData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="عدد الوحدات" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="قيمة الصيانة حسب النوع">
          {unitCountData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer>
              <BarChart data={unitCountData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `${Number(v).toLocaleString()} ج.م`} />
                <Bar dataKey="value" name="قيمة الصيانة" fill="#0891b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {residentTypeData.length > 0 && (
          <ChartCard title="مالك / مستأجر">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={residentTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {residentTypeData.map((entry, i) => (
                    <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {stats.overdueBills?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">فواتير متأخرة</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الساكن</TableHead>
                  <TableHead>الوحدة</TableHead>
                  <TableHead>الموبايل</TableHead>
                  <TableHead>الفترة</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الاستحقاق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.overdueBills.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div>{b.resident?.residentName}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.resident?.residentType === 'T' ? 'مستأجر' : 'مالك'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {b.resident
                        ? `${b.resident.area}-${b.resident.buildingNo} / ${b.resident.floorNo} / ${b.resident.apartmentNo}`
                        : '—'}
                    </TableCell>
                    <TableCell>{b.resident?.mobile || '—'}</TableCell>
                    <TableCell>{b.billType === 'EXTRA' ? (b.title || b.period) : b.period}</TableCell>
                    <TableCell>{b.amount} ج.م</TableCell>
                    <TableCell>{new Date(b.dueDate).toLocaleDateString('ar-EG')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
