import { Router, type Request } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, isStaffRole, isResidentUser } from '../middleware/auth';
import {
  DEFAULT_TEMP_PASSWORD,
  syncDependentChatsFromOwner,
} from '../lib/residentAccess';

const router = Router();

const RELATION_OPTIONS = ['زوج', 'زوجة', 'ابن', 'ابنة', 'والد', 'والدة'] as const;

const dependentSchema = z.object({
  name: z.string().min(1).max(80),
  relation: z.enum(RELATION_OPTIONS),
  mobile: z.string().min(1).max(30),
  email: z.string().email('البريد الإلكتروني مطلوب لتسجيل الدخول'),
  residentId: z.number().int().positive().optional(),
});

const dependentUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  relation: z.enum(RELATION_OPTIONS).optional(),
  mobile: z.string().min(1).max(30).optional(),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
});

router.use(authenticate);

async function assertCanManageDependents(req: Request, residentId: number) {
  if (isStaffRole(req.user?.role)) return true;
  if (req.user?.role === 'OWNER' && req.user.residentId === residentId) return true;
  return false;
}

async function findOwnerUser(residentId: number) {
  return prisma.user.findFirst({
    where: { residentId, role: 'OWNER' },
    select: { id: true },
  });
}

router.get('/', async (req, res) => {
  const requestedResidentId = req.query.residentId ? Number(req.query.residentId) : undefined;

  let residentId: number | undefined;
  if (isResidentUser(req.user?.role)) {
    if (!req.user?.residentId) return res.status(404).json({ error: 'No resident linked' });
    residentId = req.user.residentId;
  } else if (isStaffRole(req.user?.role)) {
    residentId = requestedResidentId;
  } else {
    return res.status(403).json({ error: 'Access denied' });
  }

  const dependents = await prisma.dependent.findMany({
    where: residentId ? { residentId } : undefined,
    include: {
      resident: {
        select: { id: true, residentName: true, area: true, buildingNo: true },
      },
      user: {
        select: { id: true, email: true, mustChangePassword: true, status: true },
      },
    },
    orderBy: [{ residentId: 'asc' }, { name: 'asc' }],
  });

  res.json(dependents);
});

router.post('/', async (req, res) => {
  const parsed = dependentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let residentId: number;
  if (req.user?.role === 'OWNER') {
    if (!req.user.residentId) return res.status(404).json({ error: 'No resident linked' });
    residentId = req.user.residentId;
  } else if (isStaffRole(req.user?.role)) {
    if (!parsed.data.residentId) {
      return res.status(400).json({ error: 'معرف الوحدة مطلوب' });
    }
    residentId = parsed.data.residentId;
  } else {
    return res.status(403).json({ error: 'Access denied' });
  }

  const resident = await prisma.resident.findUnique({ where: { id: residentId } });
  if (!resident) return res.status(404).json({ error: 'الوحدة غير موجودة' });

  const email = parsed.data.email.trim().toLowerCase();
  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken) {
    return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
  }

  const hashed = await bcrypt.hash(DEFAULT_TEMP_PASSWORD, 10);

  const dependent = await prisma.$transaction(async (tx) => {
    const dep = await tx.dependent.create({
      data: {
        residentId,
        name: parsed.data.name.trim(),
        relation: parsed.data.relation.trim(),
        mobile: parsed.data.mobile.trim(),
        email,
      },
    });

    await tx.user.create({
      data: {
        email,
        password: hashed,
        name: parsed.data.name.trim(),
        role: 'DEPENDENT',
        status: 'APPROVED',
        residentId,
        dependentId: dep.id,
        mustChangePassword: true,
      },
    });

    return dep;
  });

  const depUser = await prisma.user.findUnique({ where: { dependentId: dependent.id } });
  const owner = await findOwnerUser(residentId);
  if (owner && depUser) {
    await syncDependentChatsFromOwner(owner.id, depUser.id);
  }

  const full = await prisma.dependent.findUnique({
    where: { id: dependent.id },
    include: {
      user: { select: { id: true, email: true, mustChangePassword: true, status: true } },
    },
  });

  res.status(201).json(full);
});

router.put('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = dependentUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.dependent.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!existing) return res.status(404).json({ error: 'التابع غير موجود' });

  if (!(await assertCanManageDependents(req, existing.residentId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.relation !== undefined) data.relation = parsed.data.relation.trim();
  if (parsed.data.mobile !== undefined) data.mobile = parsed.data.mobile.trim();

  let nextEmail = existing.email;
  if (parsed.data.email !== undefined) {
    nextEmail = typeof parsed.data.email === 'string' ? parsed.data.email.trim().toLowerCase() || null : null;
    data.email = nextEmail;
  }

  if (nextEmail) {
    const emailTaken = await prisma.user.findFirst({
      where: {
        email: nextEmail,
        NOT: existing.user ? { id: existing.user.id } : undefined,
      },
    });
    if (emailTaken) {
      return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    }
  }

  const dependent = await prisma.dependent.update({ where: { id }, data });

  if (existing.user) {
    await prisma.user.update({
      where: { id: existing.user.id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
        ...(nextEmail && { email: nextEmail }),
      },
    });
  } else if (nextEmail) {
    const hashed = await bcrypt.hash(DEFAULT_TEMP_PASSWORD, 10);
    const depUser = await prisma.user.create({
      data: {
        email: nextEmail,
        password: hashed,
        name: dependent.name,
        role: 'DEPENDENT',
        status: 'APPROVED',
        residentId: dependent.residentId,
        dependentId: dependent.id,
        mustChangePassword: true,
      },
    });
    const owner = await findOwnerUser(dependent.residentId);
    if (owner) await syncDependentChatsFromOwner(owner.id, depUser.id);
  }

  const full = await prisma.dependent.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, mustChangePassword: true, status: true } },
    },
  });
  res.json(full);
});

router.post('/:id/reset-password', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await prisma.dependent.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!existing) return res.status(404).json({ error: 'التابع غير موجود' });

  if (!(await assertCanManageDependents(req, existing.residentId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!existing.email && !existing.user) {
    return res.status(400).json({ error: 'لا يوجد بريد إلكتروني لإنشاء حساب دخول' });
  }

  const hashed = await bcrypt.hash(DEFAULT_TEMP_PASSWORD, 10);
  const email = (existing.user?.email || existing.email || '').toLowerCase();

  if (existing.user) {
    await prisma.user.update({
      where: { id: existing.user.id },
      data: {
        password: hashed,
        mustChangePassword: true,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  } else {
    const depUser = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: existing.name,
        role: 'DEPENDENT',
        status: 'APPROVED',
        residentId: existing.residentId,
        dependentId: existing.id,
        mustChangePassword: true,
      },
    });
    const owner = await findOwnerUser(existing.residentId);
    if (owner) await syncDependentChatsFromOwner(owner.id, depUser.id);
    await prisma.dependent.update({ where: { id }, data: { email } });
  }

  res.json({
    message: `تم إعادة تعيين كلمة المرور إلى ${DEFAULT_TEMP_PASSWORD}. سيُطلب تغييرها عند تسجيل الدخول التالي.`,
  });
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await prisma.dependent.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!existing) return res.status(404).json({ error: 'التابع غير موجود' });

  if (!(await assertCanManageDependents(req, existing.residentId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (existing.user) {
    await prisma.user.delete({ where: { id: existing.user.id } });
  }
  await prisma.dependent.delete({ where: { id } });
  res.status(204).send();
});

export default router;
