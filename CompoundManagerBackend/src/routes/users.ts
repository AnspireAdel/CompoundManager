import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, ADMIN_ROLES, STAFF_ROLES } from '../middleware/auth';
import { createNotification } from '../services/notificationService';
import { resolveUnitNumbers } from '../lib/unitFields';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'ACCOUNTANT', 'OWNER']),
  residentId: z.number().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

router.use(authenticate);

router.get('/', authorize(...STAFF_ROLES), async (req, res) => {
  const { status } = req.query;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const users = await prisma.user.findMany({
    where,
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
    orderBy: { createdAt: 'desc' },
  });
  res.json(users.map(({ password, resetToken, ...u }) => u));
});

router.get('/pending', authorize(...ADMIN_ROLES), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { status: 'PENDING' },
    include: {
      resident: { include: { unitType: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users.map(({ password, resetToken, ...u }) => u));
});

const pendingUpdateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  email: z.string().email().optional(),
  mobile: z.string().min(1).max(30).optional(),
  landLine: z.string().max(30).optional().nullable(),
  nationality: z.string().max(30).optional(),
  area: z.string().max(3).optional(),
  buildingNo: z.string().max(3).optional(),
  floorNo: z.number().int().min(0).max(99).optional(),
  apartmentNo: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).optional(),
  residentType: z.enum(['O', 'T']).optional(),
  monthlyFees: z.number().min(0).optional(),
  unitTypeId: z.number().int().positive().optional(),
});

router.put('/:id/registration', authorize(...ADMIN_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = pendingUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id }, include: { resident: true } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.status !== 'PENDING') {
    return res.status(400).json({ error: 'يمكن تعديل طلبات التسجيل قيد المراجعة فقط' });
  }

  const data = parsed.data;

  if (data.email && data.email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email: data.email } });
    if (taken) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
  }

  if (user.residentId && user.resident) {
    let monthlyFees = data.monthlyFees;
    let floorNo = data.floorNo ?? user.resident.floorNo;
    let apartmentNo = data.apartmentNo ?? user.resident.apartmentNo;

    const nextUnitTypeId = data.unitTypeId ?? user.resident.unitTypeId;
    if (nextUnitTypeId) {
      const unitType = await prisma.unitType.findUnique({ where: { id: nextUnitTypeId } });
      if (!unitType) return res.status(400).json({ error: 'نوع الوحدة غير صالح' });
      if (monthlyFees === undefined && data.unitTypeId) monthlyFees = unitType.monthlyFees;
      try {
        ({ floorNo, apartmentNo } = resolveUnitNumbers(
          unitType,
          data.floorNo !== undefined ? data.floorNo : user.resident.floorNo,
          data.apartmentNo !== undefined ? data.apartmentNo : user.resident.apartmentNo
        ));
      } catch (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'بيانات الوحدة غير مكتملة' });
      }
    }

    const area = data.area ?? user.resident.area;
    const buildingNo = data.buildingNo ?? user.resident.buildingNo;
    const unitChanging =
      data.area !== undefined ||
      data.buildingNo !== undefined ||
      data.floorNo !== undefined ||
      data.apartmentNo !== undefined ||
      data.unitTypeId !== undefined;

    if (unitChanging) {
      const clash = await prisma.resident.findFirst({
        where: {
          area,
          buildingNo,
          floorNo,
          apartmentNo,
          NOT: { id: user.residentId },
        },
      });
      if (clash) return res.status(409).json({ error: 'هذه الوحدة مسجلة بالفعل' });
    }

    await prisma.resident.update({
      where: { id: user.residentId },
      data: {
        ...(data.name !== undefined && { residentName: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.mobile !== undefined && { mobile: data.mobile }),
        ...(data.landLine !== undefined && { landLine: data.landLine }),
        ...(data.nationality !== undefined && { nationality: data.nationality }),
        ...(data.area !== undefined && { area: data.area }),
        ...(data.buildingNo !== undefined && { buildingNo: data.buildingNo }),
        floorNo,
        apartmentNo,
        ...(data.residentType !== undefined && { residentType: data.residentType }),
        ...(data.unitTypeId !== undefined && { unitTypeId: data.unitTypeId }),
        ...(monthlyFees !== undefined && { monthlyFees }),
      },
    });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
    },
    include: { resident: { include: { unitType: true } } },
  });

  const { password, resetToken, ...safe } = updated;
  res.json(safe);
});

router.patch('/:id/approve', authorize(...ADMIN_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const { monthlyFees } = req.body as { monthlyFees?: number };

  const user = await prisma.user.findUnique({ where: { id }, include: { resident: true } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.status !== 'PENDING') {
    return res.status(400).json({ error: 'هذا الطلب ليس قيد المراجعة' });
  }

  if (user.residentId && monthlyFees !== undefined) {
    await prisma.resident.update({
      where: { id: user.residentId },
      data: { monthlyFees },
    });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: 'APPROVED' },
  });

  await createNotification({
    userId: user.id,
    residentId: user.residentId ?? undefined,
    type: 'REGISTRATION_APPROVED',
    title: 'تمت الموافقة على التسجيل',
    message: 'تم قبول طلبك. يمكنك الآن تسجيل الدخول',
  });

  const { password, resetToken, ...safe } = updated;
  res.json(safe);
});

router.patch('/:id/reject', authorize(...ADMIN_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const reason = (req.body as { reason?: string }).reason || 'تم رفض طلب التسجيل';

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.status !== 'PENDING') {
    return res.status(400).json({ error: 'هذا الطلب ليس قيد المراجعة' });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: 'REJECTED' },
  });

  await createNotification({
    userId: user.id,
    residentId: user.residentId ?? undefined,
    type: 'REGISTRATION_REJECTED',
    title: 'تم رفض طلب التسجيل',
    message: reason,
  });

  const { password, resetToken, ...safe } = updated;
  res.json(safe);
});

router.get('/:id', authorize(...ADMIN_ROLES), async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(String(req.params.id)) },
    include: { resident: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, resetToken, ...safe } = user;
  res.json(safe);
});

router.post('/', authorize(...ADMIN_ROLES), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, name, role, residentId, status } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
      role,
      residentId,
      status: status || 'APPROVED',
    },
  });
  const { password: _, resetToken, ...safe } = user;
  res.status(201).json(safe);
});

router.put('/:id', authorize(...ADMIN_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const { name, role, residentId, password, status } = req.body;
  const data: Record<string, unknown> = {};
  if (name) data.name = name;
  if (role) data.role = role;
  if (status) data.status = status;
  if (residentId !== undefined) data.residentId = residentId;
  if (password) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({ where: { id }, data });
  const { password: _, resetToken, ...safe } = user;
  res.json(safe);
});

router.delete('/:id', authorize(...ADMIN_ROLES), async (req, res) => {
  await prisma.user.delete({ where: { id: parseInt(String(req.params.id)) } });
  res.status(204).send();
});

export default router;
