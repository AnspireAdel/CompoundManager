import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, ADMIN_ROLES, STAFF_ROLES, isResidentUser } from '../middleware/auth';
import { getResidentBalance } from '../services/billService';
import { resolveUnitNumbers } from '../lib/unitFields';
import { normalizePassword, tryNormalizePassword } from '../lib/password';
import { allocateNextSequentialUsername } from '../lib/username';

const router = Router();

/** Staff-only: never expose resident notes to owners. */
function withoutNotes<T extends { notes?: string | null }>(resident: T) {
  const { notes: _notes, ...rest } = resident;
  return rest;
}

const residentSchema = z.object({
  area: z.string().max(3),
  buildingNo: z.string().max(5),
  floorNo: z.number().int().min(0).max(99).optional(),
  apartmentNo: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).optional(),
  residentType: z
    .union([z.enum(['O', 'T']), z.literal('')])
    .optional()
    .transform((v) => (v === 'T' ? 'T' : 'O')),
  residentName: z.string().max(60),
  nationality: z.string().max(30).default('مصري'),
  mobile: z.string().max(30),
  landLine: z.string().max(30).optional(),
  email: z.string().email().optional(),
  openingBalance: z.number().default(0),
  balanceDate: z.string().datetime().optional(),
  monthlyFees: z.number().min(0).optional(),
  unitTypeId: z.number().int().positive().optional().nullable(),
  password: z.string().min(6).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const ownerProfileSchema = z.object({
  residentName: z.string().max(60).optional(),
  nationality: z.string().max(30).optional(),
  mobile: z.string().max(30).optional(),
  landLine: z.string().max(30).optional().nullable(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  currentPassword: z.string().optional(),
});

router.use(authenticate);

router.get('/', authorize(...STAFF_ROLES), async (req, res) => {
  const { area, buildingNo, search } = req.query;
  const where: Record<string, unknown> = {};
  if (area) where.area = area;
  if (buildingNo) where.buildingNo = buildingNo;
  if (search) {
    where.OR = [
      { residentName: { contains: search as string } },
      { mobile: { contains: search as string } },
      { email: { contains: search as string } },
    ];
  }

  const residents = await prisma.resident.findMany({
    where,
    include: {
      unitType: true,
      users: {
        where: { role: 'OWNER' },
        select: { id: true, email: true, username: true, mustChangePassword: true, mustChangeUsername: true },
        take: 1,
      },
    },
    orderBy: [{ area: 'asc' }, { buildingNo: 'asc' }, { floorNo: 'asc' }, { apartmentNo: 'asc' }],
  });

  const withBalance = await Promise.all(
    residents.map(async (r) => {
      const { users, ...rest } = r;
      return { ...rest, user: users[0] || null, balance: await getResidentBalance(r.id) };
    })
  );
  res.json(withBalance);
});

router.get('/me', authorize('OWNER', 'DEPENDENT'), async (req, res) => {
  if (!req.user?.residentId) return res.status(404).json({ error: 'No resident linked' });
  const resident = await prisma.resident.findUnique({ where: { id: req.user.residentId } });
  if (!resident) return res.status(404).json({ error: 'Resident not found' });
  const balance = await getResidentBalance(resident.id);
  res.json({ ...withoutNotes(resident), balance });
});

router.put('/me', authorize('OWNER'), async (req, res) => {
  if (!req.user?.residentId) return res.status(404).json({ error: 'No resident linked' });

  const parsed = ownerProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { residentName, nationality, mobile, landLine, email, password, currentPassword } = parsed.data;

  if (password) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to set a new password' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const cur = tryNormalizePassword(currentPassword);
    if (!cur.ok) return res.status(401).json({ error: 'Current password is incorrect' });
    const valid = await bcrypt.compare(cur.value, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
  }

  if (email && email !== req.user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ error: 'Email already in use' });
    }
  }

  const resident = await prisma.resident.update({
    where: { id: req.user.residentId },
    data: {
      ...(residentName !== undefined && { residentName }),
      ...(nationality !== undefined && { nationality }),
      ...(mobile !== undefined && { mobile }),
      ...(landLine !== undefined && { landLine }),
      ...(email !== undefined && { email }),
    },
  });

  const userData: Record<string, unknown> = {};
  if (residentName) userData.name = residentName;
  if (email) userData.email = email;
  if (password) {
    const pw = tryNormalizePassword(password);
    if (!pw.ok) return res.status(400).json({ error: pw.error });
    userData.password = await bcrypt.hash(pw.value, 10);
  }

  if (Object.keys(userData).length > 0) {
    await prisma.user.update({ where: { id: req.user.id }, data: userData });
  }

  const balance = await getResidentBalance(resident.id);
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, role: true, residentId: true },
  });

  res.json({ resident: { ...withoutNotes(resident), balance }, user });
});

router.get('/next-username', authorize(...STAFF_ROLES), async (_req, res) => {
  const username = await allocateNextSequentialUsername();
  res.json({ username });
});

router.get('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isResidentUser(req.user?.role) && req.user.residentId !== id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const resident = await prisma.resident.findUnique({
    where: { id },
    include: { bills: { orderBy: { period: 'desc' }, take: 12 }, services: true },
  });
  if (!resident) return res.status(404).json({ error: 'Resident not found' });
  const balance = await getResidentBalance(id);
  if (isResidentUser(req.user?.role)) {
    return res.json({ ...withoutNotes(resident), balance });
  }
  res.json({ ...resident, balance });
});

router.post('/', authorize(...STAFF_ROLES), async (req, res) => {
  const parsed = residentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  if (!data.unitTypeId) {
    return res.status(400).json({ error: 'نوع الوحدة مطلوب' });
  }

  const unitType = await prisma.unitType.findFirst({
    where: { id: data.unitTypeId, activeFlag: 'Y' },
  });
  if (!unitType) return res.status(400).json({ error: 'نوع الوحدة غير صالح' });

  let floorNo: number;
  let apartmentNo: string;
  try {
    ({ floorNo, apartmentNo } = resolveUnitNumbers(unitType, data.floorNo, data.apartmentNo));
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'بيانات الوحدة غير مكتملة' });
  }

  const { password, balanceDate, floorNo: _f, apartmentNo: _a, ...rest } = data;
  const resident = await prisma.resident.create({
    data: {
      ...rest,
      floorNo,
      apartmentNo,
      monthlyFees: data.monthlyFees ?? unitType.monthlyFees,
      unitTypeId: unitType.id,
      balanceDate: balanceDate ? new Date(balanceDate) : undefined,
    },
    include: { unitType: true },
  });

  if (data.email) {
    const plain = password ? tryNormalizePassword(password) : { ok: true as const, value: normalizePassword('123') };
    if (!plain.ok) return res.status(400).json({ error: plain.error });
    const hashed = await bcrypt.hash(plain.value, 10);
    const username = await allocateNextSequentialUsername();
    await prisma.user.create({
      data: {
        username,
        email: data.email,
        password: hashed,
        name: data.residentName,
        role: 'OWNER',
        status: 'APPROVED',
        residentId: resident.id,
        mustChangePassword: true,
        mustChangeUsername: true,
      },
    });
  }

  res.status(201).json(resident);
});

router.put('/:id', authorize(...STAFF_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = residentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.resident.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Resident not found' });

  const { password: _pw, balanceDate, ...data } = parsed.data;

  if (data.email && data.email !== existing.email) {
    const ownerUser = await prisma.user.findFirst({ where: { residentId: id, role: 'OWNER' } });
    const emailTaken = await prisma.user.findFirst({
      where: {
        email: data.email,
        ...(ownerUser ? { NOT: { id: ownerUser.id } } : {}),
      },
    });
    if (emailTaken) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
  }

  let monthlyFees = data.monthlyFees;
  let floorNo = data.floorNo;
  let apartmentNo = data.apartmentNo;

  const nextUnitTypeId = data.unitTypeId ?? existing.unitTypeId;
  if (nextUnitTypeId) {
    const unitType = await prisma.unitType.findUnique({ where: { id: nextUnitTypeId } });
    if (!unitType) return res.status(400).json({ error: 'نوع الوحدة غير صالح' });
    // Always keep resident fee in sync with نوع الوحدة when type changes
    if (data.unitTypeId !== undefined && data.unitTypeId !== existing.unitTypeId) {
      monthlyFees = unitType.monthlyFees;
    } else if (monthlyFees === undefined && data.unitTypeId) {
      monthlyFees = unitType.monthlyFees;
    }

    if (data.unitTypeId || data.floorNo !== undefined || data.apartmentNo !== undefined) {
      try {
        // On update, keep existing floor/apt when the new type doesn't use them,
        // so we don't collide with another unit at area+building with 0/0.
        ({ floorNo, apartmentNo } = resolveUnitNumbers(
          unitType,
          data.floorNo !== undefined ? data.floorNo : existing.floorNo,
          data.apartmentNo !== undefined ? data.apartmentNo : existing.apartmentNo,
          {
            preserveUnused: {
              floorNo: existing.floorNo,
              apartmentNo: existing.apartmentNo,
            },
          }
        ));
      } catch (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'بيانات الوحدة غير مكتملة' });
      }
    }
  }

  const area = data.area ?? existing.area;
  const buildingNo = data.buildingNo ?? existing.buildingNo;
  const nextFloor = floorNo ?? existing.floorNo;
  const nextApt = apartmentNo ?? existing.apartmentNo;

  const addressChanged =
    area !== existing.area ||
    buildingNo !== existing.buildingNo ||
    nextFloor !== existing.floorNo ||
    nextApt !== existing.apartmentNo;

  if (addressChanged) {
    const clash = await prisma.resident.findFirst({
      where: {
        area,
        buildingNo,
        floorNo: nextFloor,
        apartmentNo: nextApt,
        NOT: { id },
      },
    });
    if (clash) {
      const unitLabel = [
        `${clash.area}-${clash.buildingNo}`,
        clash.floorNo ? `دور ${clash.floorNo}` : null,
        clash.apartmentNo && clash.apartmentNo !== '0' ? `وحدة ${clash.apartmentNo}` : null,
      ]
        .filter(Boolean)
        .join(' / ');
      return res.status(409).json({
        error: `هذه الوحدة مسجلة بالفعل باسم «${clash.residentName}» (${unitLabel})`,
      });
    }
  }

  const { floorNo: _f, apartmentNo: _a, ...restData } = data;
  const resident = await prisma.resident.update({
    where: { id },
    data: {
      ...restData,
      ...(floorNo !== undefined && { floorNo }),
      ...(apartmentNo !== undefined && { apartmentNo }),
      ...(monthlyFees !== undefined && { monthlyFees }),
      ...(balanceDate !== undefined && { balanceDate: new Date(balanceDate) }),
    },
    include: { unitType: true },
  });

  const linkedUser = await prisma.user.findFirst({ where: { residentId: id, role: 'OWNER' } });
  if (linkedUser) {
    const userData: Record<string, unknown> = {};
    if (data.residentName) userData.name = data.residentName;
    if (data.email) userData.email = data.email;
    if (Object.keys(userData).length > 0) {
      await prisma.user.update({ where: { id: linkedUser.id }, data: userData });
    }
  } else if (data.email) {
    const hashed = await bcrypt.hash(normalizePassword('123'), 10);
    const username = await allocateNextSequentialUsername();
    await prisma.user.create({
      data: {
        username,
        email: data.email,
        password: hashed,
        name: data.residentName || resident.residentName,
        role: 'OWNER',
        status: 'APPROVED',
        residentId: resident.id,
        mustChangePassword: true,
        mustChangeUsername: true,
      },
    });
  }

  const balance = await getResidentBalance(resident.id);
  res.json({ ...resident, balance });
});

const DEFAULT_OWNER_PASSWORD = '123';

router.post('/:id/reset-password', authorize(...STAFF_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const resident = await prisma.resident.findUnique({
    where: { id },
    include: { users: { where: { role: 'OWNER' }, take: 1 } },
  });
  if (!resident) return res.status(404).json({ error: 'Resident not found' });

  const hashed = await bcrypt.hash(normalizePassword(DEFAULT_OWNER_PASSWORD), 10);
  const ownerUser = resident.users[0];

  if (ownerUser) {
    await prisma.user.update({
      where: { id: ownerUser.id },
      data: {
        password: hashed,
        mustChangePassword: true,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  } else if (resident.email) {
    const username = await allocateNextSequentialUsername();
    await prisma.user.create({
      data: {
        username,
        email: resident.email,
        password: hashed,
        name: resident.residentName,
        role: 'OWNER',
        status: 'APPROVED',
        residentId: resident.id,
        mustChangePassword: true,
        mustChangeUsername: true,
      },
    });
  } else {
    return res.status(400).json({
      error: 'لا يوجد بريد إلكتروني مرتبط بهذه الوحدة لإنشاء حساب دخول',
    });
  }

  res.json({
    message: `تم إعادة تعيين كلمة المرور إلى ${DEFAULT_OWNER_PASSWORD}. سيُطلب تغييرها عند تسجيل الدخول التالي.`,
  });
});

router.delete('/:id', authorize(...ADMIN_ROLES), async (req, res) => {
  await prisma.resident.delete({ where: { id: parseInt(String(req.params.id)) } });
  res.status(204).send();
});

export default router;
