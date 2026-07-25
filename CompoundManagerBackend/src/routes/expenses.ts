import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, STAFF_ROLES } from '../middleware/auth';

const router = Router();

const expenseInclude = {
  expenseType: true,
  resident: {
    select: {
      id: true,
      residentName: true,
      area: true,
      buildingNo: true,
      floorNo: true,
      apartmentNo: true,
      unitType: { select: { name: true, hasFloor: true, hasApartment: true } },
    },
  },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

const expenseSchema = z.object({
  expenseTypeId: z.number().int().positive(),
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  expenseDate: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
  /** null / omitted = على الكومبوند كله */
  residentId: z.number().int().positive().optional().nullable(),
  scope: z.enum(['COMPOUND', 'UNIT']).optional(),
});

router.use(authenticate);
router.use(authorize(...STAFF_ROLES));

router.get('/', async (req, res) => {
  const { residentId, expenseTypeId, scope, from, to } = req.query;
  const where: Record<string, unknown> = {};

  if (residentId) where.residentId = parseInt(String(residentId));
  if (expenseTypeId) where.expenseTypeId = parseInt(String(expenseTypeId));
  if (scope === 'COMPOUND') where.residentId = null;
  if (scope === 'UNIT') where.residentId = { not: null };

  if (from || to) {
    where.expenseDate = {
      ...(from ? { gte: new Date(String(from)) } : {}),
      ...(to ? { lte: new Date(String(to)) } : {}),
    };
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: expenseInclude,
    orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
  });
  res.json(expenses);
});

router.post('/', async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { expenseTypeId, amount, expenseDate, notes, scope } = parsed.data;
  let residentId = parsed.data.residentId ?? null;

  if (scope === 'COMPOUND') residentId = null;
  if (scope === 'UNIT' && !residentId) {
    return res.status(400).json({ error: 'اختر الوحدة عند تسجيل مصروف على وحدة' });
  }

  const type = await prisma.expenseType.findUnique({ where: { id: expenseTypeId } });
  if (!type || type.activeFlag !== 'Y') {
    return res.status(400).json({ error: 'نوع المصروف غير صالح أو غير نشط' });
  }

  if (residentId) {
    const resident = await prisma.resident.findUnique({ where: { id: residentId } });
    if (!resident) return res.status(400).json({ error: 'الوحدة غير موجودة' });
  }

  const expense = await prisma.expense.create({
    data: {
      expenseTypeId,
      amount,
      expenseDate: new Date(expenseDate),
      notes: notes?.trim() || null,
      residentId,
      createdById: req.user?.id,
    },
    include: expenseInclude,
  });
  res.status(201).json(expense);
});

router.put('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'المصروف غير موجود' });

  const data = parsed.data;
  let residentId = data.residentId;

  if (data.scope === 'COMPOUND') residentId = null;
  if (data.scope === 'UNIT') {
    if (residentId === undefined) residentId = existing.residentId;
    if (!residentId) {
      return res.status(400).json({ error: 'اختر الوحدة عند تسجيل مصروف على وحدة' });
    }
  }

  if (data.expenseTypeId) {
    const type = await prisma.expenseType.findUnique({ where: { id: data.expenseTypeId } });
    if (!type) return res.status(400).json({ error: 'نوع المصروف غير صالح' });
  }

  if (residentId) {
    const resident = await prisma.resident.findUnique({ where: { id: residentId } });
    if (!resident) return res.status(400).json({ error: 'الوحدة غير موجودة' });
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...(data.expenseTypeId !== undefined && { expenseTypeId: data.expenseTypeId }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.expenseDate !== undefined && { expenseDate: new Date(data.expenseDate) }),
      ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
      ...(residentId !== undefined && { residentId }),
      ...(data.scope === 'COMPOUND' && { residentId: null }),
    },
    include: expenseInclude,
  });
  res.json(expense);
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'المصروف غير موجود' });

  await prisma.expense.delete({ where: { id } });
  res.status(204).send();
});

export default router;
