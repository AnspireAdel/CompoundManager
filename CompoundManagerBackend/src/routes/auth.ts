import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, signToken } from '../middleware/auth';
import { createNotification } from '../services/notificationService';
import { resolveUnitNumbers } from '../lib/unitFields';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  client: z.enum(['mobile', 'web']).optional(),
});

const registerSchema = z.object({
  name: z.string().min(1).max(60),
  email: z.string().email(),
  password: z.string().min(6),
  mobile: z.string().min(1).max(30),
  landLine: z.string().max(30).optional(),
  nationality: z.string().max(30).optional(),
  area: z.string().max(3),
  buildingNo: z.string().max(3),
  floorNo: z.number().int().min(0).max(99).optional(),
  apartmentNo: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).optional(),
  residentType: z.enum(['O', 'T']),
  unitTypeId: z.number().int().positive(),
});

const profileSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  email: z.string().email().optional(),
  mobile: z.string().max(30).optional(),
  landLine: z.string().max(30).optional().nullable(),
  nationality: z.string().max(30).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(6),
});

const DEFAULT_OWNER_PASSWORD = '123';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });

  const unitType = await prisma.unitType.findFirst({
    where: { id: data.unitTypeId, activeFlag: 'Y' },
  });
  if (!unitType) {
    return res.status(400).json({ error: 'نوع الوحدة غير صالح' });
  }

  let floorNo: number;
  let apartmentNo: string;
  try {
    ({ floorNo, apartmentNo } = resolveUnitNumbers(unitType, data.floorNo, data.apartmentNo));
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'بيانات الوحدة غير مكتملة' });
  }

  const hashed = await bcrypt.hash(data.password, 10);

  const existingUnit = await prisma.resident.findUnique({
    where: {
      area_buildingNo_floorNo_apartmentNo: {
        area: data.area,
        buildingNo: data.buildingNo,
        floorNo,
        apartmentNo,
      },
    },
  });
  if (existingUnit?.email) {
    return res.status(409).json({ error: 'هذه الوحدة مسجلة بالفعل' });
  }

  const resident = existingUnit
    ? await prisma.resident.update({
        where: { id: existingUnit.id },
        data: {
          residentName: data.name,
          mobile: data.mobile,
          landLine: data.landLine,
          nationality: data.nationality || 'مصري',
          email: data.email,
          residentType: data.residentType,
          unitTypeId: unitType.id,
          monthlyFees: unitType.monthlyFees,
          floorNo,
          apartmentNo,
        },
      })
    : await prisma.resident.create({
        data: {
          area: data.area,
          buildingNo: data.buildingNo,
          floorNo,
          apartmentNo,
          residentName: data.name,
          mobile: data.mobile,
          landLine: data.landLine,
          nationality: data.nationality || 'مصري',
          email: data.email,
          monthlyFees: unitType.monthlyFees,
          residentType: data.residentType,
          unitTypeId: unitType.id,
        },
      });

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashed,
      name: data.name,
      role: 'OWNER',
      status: 'PENDING',
      residentId: resident.id,
    },
  });

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'APPROVED' } });
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: 'SYSTEM',
        title: 'طلب تسجيل جديد',
        message: `${data.name} يطلب التسجيل — ${data.email}`,
      })
    )
  );

  const { password: _, ...safe } = user;
  res.status(201).json({
    message: 'تم إرسال طلب التسجيل. بانتظار موافقة المدير قبل تسجيل الدخول',
    user: safe,
  });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password, client } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  }

  if (user.status === 'PENDING') {
    return res.status(403).json({ error: 'حسابك قيد المراجعة. انتظر موافقة المدير' });
  }
  if (user.status === 'REJECTED') {
    return res.status(403).json({ error: 'تم رفض طلب التسجيل. تواصل مع الإدارة' });
  }

  if (client === 'mobile' && user.role !== 'OWNER' && user.role !== 'DEPENDENT') {
    return res.status(403).json({
      error: 'تطبيق الموبايل للملاك والتابعين فقط. المدير والمحاسب يستخدمان نسخة الويب',
    });
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    residentId: user.residentId,
  });

  // Treat default temp password as requiring a change (covers older accounts)
  const usingDefaultPassword = await bcrypt.compare(DEFAULT_OWNER_PASSWORD, user.password);
  let mustChangePassword = user.mustChangePassword || usingDefaultPassword;
  if (usingDefaultPassword && !user.mustChangePassword) {
    await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: true },
    });
    mustChangePassword = true;
  }

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      residentId: user.residentId,
      mustChangePassword,
    },
  });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      resident: {
        include: { unitType: true },
      },
      dependent: true,
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { password: _, resetToken: __, ...safe } = user;

  const usingDefaultPassword = await bcrypt.compare(DEFAULT_OWNER_PASSWORD, user.password);
  let mustChangePassword = user.mustChangePassword || usingDefaultPassword;
  if (usingDefaultPassword && !user.mustChangePassword) {
    await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: true },
    });
    mustChangePassword = true;
  }

  const payload = { ...safe, mustChangePassword };

  if ((payload.role === 'OWNER' || payload.role === 'DEPENDENT') && payload.resident) {
    const { notes: _notes, ...resident } = payload.resident as typeof payload.resident & { notes?: string | null };
    return res.json({ ...payload, resident });
  }
  res.json(payload);
});

router.put('/profile', authenticate, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, email, mobile, landLine, nationality } = parsed.data;
  const userId = req.user!.id;

  if (email && email !== req.user!.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    }
  }

  const userData: Record<string, unknown> = {};
  if (name) userData.name = name;
  if (email) userData.email = email;

  const user = await prisma.user.update({
    where: { id: userId },
    data: userData,
    include: { resident: true, dependent: true },
  });

  // Dependents update their own Dependent row — not the unit/owner resident record
  if (user.role === 'DEPENDENT' && user.dependentId) {
    await prisma.dependent.update({
      where: { id: user.dependentId },
      data: {
        ...(name && { name }),
        ...(mobile !== undefined && { mobile }),
        ...(email && { email }),
      },
    });
  } else if (user.residentId && user.role === 'OWNER' && (name || mobile !== undefined || landLine !== undefined || nationality || email)) {
    await prisma.resident.update({
      where: { id: user.residentId },
      data: {
        ...(name && { residentName: name }),
        ...(mobile !== undefined && { mobile }),
        ...(landLine !== undefined && { landLine }),
        ...(nationality && { nationality }),
        ...(email && { email }),
      },
    });
  }

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      resident: {
        include: { unitType: true },
      },
    },
  });
  const { password: _, resetToken: __, ...safe } = updated!;
  if ((safe.role === 'OWNER' || safe.role === 'DEPENDENT') && safe.resident) {
    const { notes: _notes, ...resident } = safe.resident as typeof safe.resident & { notes?: string | null };
    return res.json({ ...safe, resident });
  }
  res.json(safe);
});

router.post('/change-password', authenticate, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (parsed.data.newPassword === DEFAULT_OWNER_PASSWORD) {
    return res.status(400).json({ error: 'اختر كلمة مرور مختلفة عن كلمة المرور الافتراضية' });
  }

  if (user.mustChangePassword) {
    // First login: current password optional; if sent, must match
    if (parsed.data.currentPassword) {
      const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
      if (!valid) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }
  } else {
    if (!parsed.data.currentPassword) {
      return res.status(400).json({ error: 'كلمة المرور الحالية مطلوبة' });
    }
    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(parsed.data.newPassword, 10),
      mustChangePassword: false,
    },
  });

  res.json({ message: 'تم تغيير كلمة المرور بنجاح', mustChangePassword: false });
});

router.post('/forgot-password', async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.status !== 'APPROVED') {
    return res.json({
      message: 'إذا كان البريد مسجلاً، سيتم إرسال رمز إعادة التعيين',
    });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  await createNotification({
    userId: user.id,
    type: 'SYSTEM',
    title: 'طلب إعادة تعيين كلمة المرور',
    message: 'استخدم الرمز لإعادة التعيين (صالح لمدة ساعة)',
  });

  res.json({
    message: 'تم إنشاء رمز إعادة التعيين. استخدمه خلال ساعة',
    resetToken: token,
  });
});

router.post('/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (
    !user ||
    !user.resetToken ||
    user.resetToken !== parsed.data.token ||
    !user.resetTokenExpiry ||
    user.resetTokenExpiry < new Date()
  ) {
    return res.status(400).json({ error: 'رمز إعادة التعيين غير صالح أو منتهي' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(parsed.data.newPassword, 10),
      resetToken: null,
      resetTokenExpiry: null,
      mustChangePassword: false,
    },
  });

  res.json({ message: 'تم تعيين كلمة المرور الجديدة بنجاح' });
});

export default router;
