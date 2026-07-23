import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, ADMIN_ROLES, STAFF_ROLES, isStaffRole } from '../middleware/auth';

const router = Router();

const typeSchema = z.object({
  name: z.string().min(1).max(40),
  monthlyFees: z.number().min(0),
  hasFloor: z.boolean().optional(),
  hasApartment: z.boolean().optional(),
  activeFlag: z.enum(['Y', 'N']).optional(),
});

// Public: active unit types for registration forms
router.get('/', async (req, res) => {
  const manage = req.query.manage === 'true';

  if (manage) {
    return authenticate(req, res, async () => {
      if (!isStaffRole(req.user?.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const types = await prisma.unitType.findMany({ orderBy: { name: 'asc' } });
      return res.json(types);
    });
  }

  const types = await prisma.unitType.findMany({
    where: { activeFlag: 'Y' },
    orderBy: { name: 'asc' },
  });
  res.json(types);
});

router.use(authenticate);

router.post('/', authorize(...STAFF_ROLES), async (req, res) => {
  const parsed = typeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.unitType.findUnique({ where: { name: parsed.data.name } });
  if (existing) return res.status(409).json({ error: 'نوع الوحدة موجود بالفعل' });

  const type = await prisma.unitType.create({
    data: {
      name: parsed.data.name,
      monthlyFees: parsed.data.monthlyFees,
      hasFloor: parsed.data.hasFloor ?? true,
      hasApartment: parsed.data.hasApartment ?? true,
      activeFlag: parsed.data.activeFlag || 'Y',
    },
  });
  res.status(201).json(type);
});

router.put('/:id', authorize(...STAFF_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = typeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.name) {
    const conflict = await prisma.unitType.findFirst({
      where: { name: parsed.data.name, NOT: { id } },
    });
    if (conflict) return res.status(409).json({ error: 'نوع الوحدة موجود بالفعل' });
  }

  const type = await prisma.unitType.update({
    where: { id },
    data: parsed.data,
  });

  if (parsed.data.monthlyFees !== undefined) {
    await prisma.resident.updateMany({
      where: { unitTypeId: id },
      data: { monthlyFees: parsed.data.monthlyFees },
    });
  }

  res.json(type);
});

router.patch('/:id/toggle', authorize(...STAFF_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await prisma.unitType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'نوع الوحدة غير موجود' });

  const type = await prisma.unitType.update({
    where: { id },
    data: { activeFlag: existing.activeFlag === 'Y' ? 'N' : 'Y' },
  });
  res.json(type);
});

router.delete('/:id', authorize(...STAFF_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await prisma.unitType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'نوع الوحدة غير موجود' });

  const inUse = await prisma.resident.count({ where: { unitTypeId: id } });
  if (inUse > 0) {
    return res.status(400).json({
      error: `لا يمكن الحذف — مرتبط بـ ${inUse} وحدة. يمكنك إيقافه بدلاً من الحذف`,
    });
  }

  await prisma.unitType.delete({ where: { id } });
  res.status(204).send();
});

export default router;
