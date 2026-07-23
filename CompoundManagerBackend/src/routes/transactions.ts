import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, ADMIN_ROLES, STAFF_ROLES, isResidentUser } from '../middleware/auth';
import { recordPayment } from '../services/billService';

const router = Router();

const trxSchema = z.object({
  residentId: z.number(),
  trxType: z.string().max(3).optional(),
  drCr: z.enum(['D', 'C']),
  trxAmount: z.number().positive(),
  notes: z.string().max(200).optional(),
  billId: z.number().optional(),
});

router.use(authenticate);

router.get('/', async (req, res) => {
  const { residentId, trxType, from, to } = req.query;
  const where: Record<string, unknown> = {};

  if (isResidentUser(req.user?.role)) {
    where.residentId = req.user.residentId;
  } else if (residentId) {
    where.residentId = parseInt(residentId as string);
  }
  if (trxType) where.trxType = trxType;
  if (from || to) {
    where.trxDate = {};
    if (from) (where.trxDate as Record<string, Date>).gte = new Date(from as string);
    if (to) (where.trxDate as Record<string, Date>).lte = new Date(to as string);
  }

  const transactions = await prisma.financialTransaction.findMany({
    where,
    include: { resident: { select: { id: true, residentName: true, area: true, buildingNo: true, apartmentNo: true } } },
    orderBy: { trxDate: 'desc' },
  });
  res.json(transactions);
});

router.get('/:id', async (req, res) => {
  const trx = await prisma.financialTransaction.findUnique({
    where: { id: parseInt(String(req.params.id)) },
    include: { resident: true, bill: true },
  });
  if (!trx) return res.status(404).json({ error: 'Transaction not found' });
  if (isResidentUser(req.user?.role) && trx.residentId !== req.user.residentId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(trx);
});

router.post('/', authorize(...STAFF_ROLES), async (req, res) => {
  const parsed = trxSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { residentId, trxType, drCr, trxAmount, notes, billId } = parsed.data;

  if (drCr === 'C' && billId) {
    const trx = await recordPayment(residentId, trxAmount, billId, notes);
    return res.status(201).json(trx);
  }

  const trx = await prisma.financialTransaction.create({
    data: { residentId, trxType, drCr, trxAmount, notes, posted: 'Y', billId },
  });
  res.status(201).json(trx);
});

router.patch('/:id/post', authorize(...STAFF_ROLES), async (req, res) => {
  const trx = await prisma.financialTransaction.update({
    where: { id: parseInt(String(req.params.id)) },
    data: { posted: 'Y' },
  });
  res.json(trx);
});

export default router;
