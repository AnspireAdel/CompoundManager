import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, ADMIN_ROLES, STAFF_ROLES } from '../middleware/auth';
import { getResidentBalance } from '../services/billService';

const router = Router();

router.use(authenticate);
router.use(authorize(...STAFF_ROLES));

const STATUS_LABELS: Record<string, string> = {
  ISSUED: 'مستحقة',
  DUE: 'مستحقة',
  OVERDUE: 'متأخرة',
  PARTIAL: 'جزئية',
  PENDING_REVIEW: 'بانتظار المراجعة',
  PAID: 'مدفوعة',
  DRAFT: 'مسودة',
};

const MONTH_NAMES_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' });
}

async function buildYearlyMonthly(year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [bills, payments, expenses] = await Promise.all([
    prisma.bill.findMany({
      where: { issuedAt: { gte: start, lt: end } },
      select: {
        issuedAt: true,
        amount: true,
        paidAmount: true,
        status: true,
      },
    }),
    prisma.financialTransaction.findMany({
      where: {
        trxType: 'PAY',
        posted: 'Y',
        trxDate: { gte: start, lt: end },
      },
      select: { trxDate: true, trxAmount: true },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: start, lt: end } },
      select: { expenseDate: true, amount: true },
    }),
  ]);

  type MonthRow = {
    month: number;
    monthKey: string;
    label: string;
    issuedCount: number;
    collectedCount: number;
    issued: number;
    collected: number;
    remaining: number;
    expenses: number;
    net: number;
  };

  const rows: MonthRow[] = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    return {
      month: i + 1,
      monthKey: key,
      label: MONTH_NAMES_AR[i],
      issuedCount: 0,
      collectedCount: 0,
      issued: 0,
      collected: 0,
      remaining: 0,
      expenses: 0,
      net: 0,
    };
  });

  for (const b of bills) {
    const m = new Date(b.issuedAt).getMonth();
    const row = rows[m];
    row.issuedCount += 1;
    row.issued += b.amount;
    row.remaining += Math.max(0, b.amount - (b.paidAmount || 0));
  }

  for (const p of payments) {
    const m = new Date(p.trxDate).getMonth();
    rows[m].collectedCount += 1;
    rows[m].collected += p.trxAmount;
  }

  for (const e of expenses) {
    const m = new Date(e.expenseDate).getMonth();
    rows[m].expenses += e.amount;
  }

  return rows.map((r) => {
    const issued = Math.round(r.issued);
    const collected = Math.round(r.collected);
    const remaining = Math.round(r.remaining);
    const expensesAmount = Math.round(r.expenses);
    return {
      ...r,
      issued,
      collected,
      remaining,
      expenses: expensesAmount,
      net: collected - expensesAmount,
    };
  });
}

router.get('/stats', async (req, res) => {
  const now = new Date();
  const requestedYear = Number(req.query.year);
  const year = Number.isFinite(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
    ? requestedYear
    : now.getFullYear();

  const residents = await prisma.resident.findMany({
    include: { unitType: true },
  });

  const totalUnits = residents.length;

  const unpaidBills = await prisma.bill.count({
    where: { status: { in: ['ISSUED', 'DUE', 'OVERDUE', 'PARTIAL', 'PENDING_REVIEW'] } },
  });

  let totalOutstanding = 0;
  for (const r of residents) {
    const balance = await getResidentBalance(r.id);
    if (balance > 0) totalOutstanding += balance;
  }

  // Maintenance values come from أنواع الوحدات (UnitType.monthlyFees), not bill/resident fee snapshots
  const unitTypes = await prisma.unitType.findMany({
    where: { activeFlag: 'Y' },
    include: { _count: { select: { residents: true } } },
    orderBy: { name: 'asc' },
  });

  const unitTypeBreakdown = unitTypes.map((t) => ({
    name: t.name,
    count: t._count.residents,
    monthlyFees: t.monthlyFees,
    totalValue: t._count.residents * t.monthlyFees,
  }));

  const untypedResidents = residents.filter((r) => !r.unitTypeId);
  if (untypedResidents.length > 0) {
    unitTypeBreakdown.push({
      name: 'غير محدد',
      count: untypedResidents.length,
      monthlyFees: 0,
      totalValue: untypedResidents.reduce((sum, r) => sum + (r.monthlyFees || 0), 0),
    });
  }

  unitTypeBreakdown.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const totalTypeCount = unitTypeBreakdown.reduce((s, t) => s + t.count, 0);
  const totalTypeValue = unitTypeBreakdown.reduce((s, t) => s + t.totalValue, 0);
  const monthlyMaintenance = totalTypeValue;

  const statusGroups = await prisma.bill.groupBy({
    by: ['status'],
    _count: { _all: true },
    _sum: { amount: true },
  });
  const statusMap = new Map<string, { name: string; count: number; amount: number }>();
  for (const g of statusGroups) {
    const key = g.status === 'DUE' ? 'ISSUED' : g.status;
    const label = STATUS_LABELS[key] || g.status;
    const current = statusMap.get(key) || { name: label, count: 0, amount: 0 };
    current.count += g._count._all;
    current.amount += g._sum.amount || 0;
    statusMap.set(key, current);
  }
  const billStatusBreakdown = Array.from(statusMap.values()).filter((s) => s.count > 0);

  const residentTypeBreakdown = [
    {
      name: 'مالك',
      count: residents.filter((r) => r.residentType === 'O').length,
    },
    {
      name: 'مستأجر',
      count: residents.filter((r) => r.residentType === 'T').length,
    },
  ].filter((r) => r.count > 0);

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [recentBills, recentPayments, billYears, paymentYears] = await Promise.all([
    prisma.bill.findMany({
      where: { issuedAt: { gte: rangeStart } },
      select: { issuedAt: true, amount: true },
    }),
    prisma.financialTransaction.findMany({
      where: {
        trxType: 'PAY',
        posted: 'Y',
        trxDate: { gte: rangeStart },
      },
      select: { trxDate: true, trxAmount: true },
    }),
    prisma.bill.findMany({ select: { issuedAt: true } }),
    prisma.financialTransaction.findMany({
      where: { trxType: 'PAY', posted: 'Y' },
      select: { trxDate: true },
    }),
  ]);

  const issuedByMonth = new Map<string, number>();
  const collectedByMonth = new Map<string, number>();
  for (const m of months) {
    issuedByMonth.set(m, 0);
    collectedByMonth.set(m, 0);
  }
  for (const b of recentBills) {
    const key = monthKey(new Date(b.issuedAt));
    if (issuedByMonth.has(key)) {
      issuedByMonth.set(key, (issuedByMonth.get(key) || 0) + b.amount);
    }
  }
  for (const p of recentPayments) {
    const key = monthKey(new Date(p.trxDate));
    if (collectedByMonth.has(key)) {
      collectedByMonth.set(key, (collectedByMonth.get(key) || 0) + p.trxAmount);
    }
  }

  const monthlyTrend = months.map((key) => ({
    month: key,
    label: monthLabel(key),
    issued: Math.round(issuedByMonth.get(key) || 0),
    collected: Math.round(collectedByMonth.get(key) || 0),
  }));

  const yearSet = new Set<number>([now.getFullYear(), year]);
  for (const b of billYears) yearSet.add(new Date(b.issuedAt).getFullYear());
  for (const p of paymentYears) yearSet.add(new Date(p.trxDate).getFullYear());
  const availableYears = Array.from(yearSet).sort((a, b) => b - a);

  const yearlyMonthly = await buildYearlyMonthly(year);
  const yearlyTotals = yearlyMonthly.reduce(
    (acc, row) => ({
      issuedCount: acc.issuedCount + row.issuedCount,
      collectedCount: acc.collectedCount + row.collectedCount,
      issued: acc.issued + row.issued,
      collected: acc.collected + row.collected,
      remaining: acc.remaining + row.remaining,
      expenses: acc.expenses + row.expenses,
      net: acc.net + row.net,
    }),
    { issuedCount: 0, collectedCount: 0, issued: 0, collected: 0, remaining: 0, expenses: 0, net: 0 }
  );

  const overdueBills = await prisma.bill.findMany({
    where: { status: 'OVERDUE' },
    include: {
      resident: {
        select: {
          residentName: true,
          residentType: true,
          area: true,
          buildingNo: true,
          floorNo: true,
          apartmentNo: true,
          mobile: true,
        },
      },
    },
    take: 10,
  });

  res.json({
    totalUnits,
    monthlyMaintenance,
    unpaidBills,
    totalOutstanding,
    unitTypeBreakdown,
    totals: {
      count: totalTypeCount,
      value: totalTypeValue,
    },
    billStatusBreakdown,
    residentTypeBreakdown,
    monthlyTrend,
    selectedYear: year,
    availableYears,
    yearlyMonthly,
    yearlyTotals,
    totalResidents: totalUnits,
    totalServices: 0,
    overdueBills,
  });
});

export default router;
