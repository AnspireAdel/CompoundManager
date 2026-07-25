import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, STAFF_ROLES, isStaffRole } from '../middleware/auth';

const router = Router();

const typeSchema = z.object({
  name: z.string().min(1).max(50),
  activeFlag: z.enum(['Y', 'N']).optional(),
});

router.use(authenticate);
router.use(authorize(...STAFF_ROLES));

router.get('/', async (req, res) => {
  const manage = req.query.manage === 'true';
  const isStaff = isStaffRole(req.user?.role);

  if (manage && isStaff) {
    const types = await prisma.expenseType.findMany({ orderBy: { name: 'asc' } });
    return res.json(types);
  }

  const types = await prisma.expenseType.findMany({
    where: { activeFlag: 'Y' },
    orderBy: { name: 'asc' },
  });
  res.json(types);
});

router.post('/', async (req, res) => {
  const parsed = typeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.expenseType.findUnique({ where: { name: parsed.data.name } });
  if (existing) return res.status(409).json({ error: 'نوع المصروف موجود بالفعل' });

  const type = await prisma.expenseType.create({
    data: {
      name: parsed.data.name,
      activeFlag: parsed.data.activeFlag || 'Y',
    },
  });
  res.status(201).json(type);
});

router.put('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = typeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.name) {
    const conflict = await prisma.expenseType.findFirst({
      where: { name: parsed.data.name, NOT: { id } },
    });
    if (conflict) return res.status(409).json({ error: 'نوع المصروف موجود بالفعل' });
  }

  const type = await prisma.expenseType.update({
    where: { id },
    data: parsed.data,
  });
  res.json(type);
});

router.patch('/:id/toggle', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await prisma.expenseType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'نوع المصروف غير موجود' });

  const type = await prisma.expenseType.update({
    where: { id },
    data: { activeFlag: existing.activeFlag === 'Y' ? 'N' : 'Y' },
  });
  res.json(type);
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await prisma.expenseType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'نوع المصروف غير موجود' });

  const inUse = await prisma.expense.count({ where: { expenseTypeId: id } });
  if (inUse > 0) {
    return res.status(400).json({
      error: `لا يمكن الحذف — مستخدم في ${inUse} مصروف. يمكنك إيقافه بدلاً من الحذف`,
    });
  }

  await prisma.expenseType.delete({ where: { id } });
  res.status(204).send();
});

export default router;
