import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, ADMIN_ROLES, STAFF_ROLES, isResidentUser } from '../middleware/auth';
import { issueMonthlyBills, recordPayment } from '../services/billService';
import { notifyResident } from '../services/notificationService';

const router = Router();

const billSchema = z.object({
  residentId: z.number(),
  period: z.string(),
  amount: z.number().positive(),
  dueDate: z.string(),
  notes: z.string().optional(),
});

const extraBillSchema = z.object({
  residentId: z.number(),
  title: z.string().min(1).max(100),
  amount: z.number().positive(),
  dueDate: z.string(),
  notes: z.string().max(200).optional(),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  notes: z.string().optional(),
});

router.use(authenticate);

router.get('/', async (req, res) => {
  const { status, period, residentId } = req.query;
  const where: Record<string, unknown> = {};

  if (isResidentUser(req.user?.role)) {
    where.residentId = req.user.residentId;
  } else {
    if (residentId) where.residentId = parseInt(residentId as string);
  }
  if (status) where.status = status;
  if (period) where.period = period;

  const bills = await prisma.bill.findMany({
    where,
    include: {
      resident: {
        select: {
          id: true,
          residentName: true,
          residentType: true,
          area: true,
          buildingNo: true,
          floorNo: true,
          apartmentNo: true,
          mobile: true,
        },
      },
      paymentProofs: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
    orderBy: { dueDate: 'desc' },
  });
  res.json(bills);
});

router.get('/:id', async (req, res) => {
  const bill = await prisma.bill.findUnique({
    where: { id: parseInt(String(req.params.id)) },
    include: { resident: true, transactions: true },
  });
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  if (isResidentUser(req.user?.role) && bill.residentId !== req.user.residentId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(bill);
});

router.post('/', authorize(...STAFF_ROLES), async (req, res) => {
  const parsed = billSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { residentId, period, amount, dueDate, notes } = parsed.data;
  const bill = await prisma.bill.create({
    data: {
      residentId,
      period,
      amount,
      dueDate: new Date(dueDate),
      notes,
      status: 'ISSUED',
      billType: 'MONTHLY',
      title: `صيانة ${period}`,
    },
  });
  res.status(201).json(bill);
});

router.post('/extra', authorize(...STAFF_ROLES), async (req, res) => {
  const parsed = extraBillSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { residentId, title, amount, dueDate, notes } = parsed.data;
  const resident = await prisma.resident.findUnique({ where: { id: residentId } });
  if (!resident) return res.status(404).json({ error: 'الوحدة غير موجودة' });

  const period = `EXTRA-${Date.now()}`;
  const bill = await prisma.bill.create({
    data: {
      residentId,
      period,
      title,
      amount,
      dueDate: new Date(dueDate),
      notes,
      status: 'ISSUED',
      billType: 'EXTRA',
    },
    include: {
      resident: {
        select: {
          id: true,
          residentName: true,
          area: true,
          buildingNo: true,
          floorNo: true,
          apartmentNo: true,
          mobile: true,
        },
      },
    },
  });

  await prisma.financialTransaction.create({
    data: {
      residentId,
      trxType: 'BIL',
      drCr: 'D',
      trxAmount: amount,
      notes: notes || title,
      posted: 'Y',
      billId: bill.id,
    },
  });

  await notifyResident(
    residentId,
    'BILL_ISSUED',
    'فاتورة إضافية',
    `تم إصدار فاتورة إضافية «${title}» بمبلغ ${amount} جنيه`
  );

  res.status(201).json(bill);
});

router.post('/issue-monthly', authorize(...STAFF_ROLES), async (req, res) => {
  const { period, dueDate } = req.body;
  if (!period || !dueDate) {
    return res.status(400).json({ error: 'period and dueDate are required' });
  }
  const bills = await issueMonthlyBills(period, new Date(dueDate));
  res.status(201).json({ issued: bills.length, bills });
});

router.post('/:id/pay', authorize(...STAFF_ROLES, 'OWNER'), async (req, res) => {
  const billId = parseInt(String(req.params.id));
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  if (isResidentUser(req.user?.role) && bill.residentId !== req.user.residentId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const trx = await recordPayment(bill.residentId, parsed.data.amount, billId, parsed.data.notes);
  const updated = await prisma.bill.findUnique({ where: { id: billId } });
  res.json({ transaction: trx, bill: updated });
});

router.patch('/:id/status', authorize(...STAFF_ROLES), async (req, res) => {
  const { status } = req.body;
  const bill = await prisma.bill.update({
    where: { id: parseInt(String(req.params.id)) },
    data: { status },
  });
  res.json(bill);
});

export default router;
