import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { optionalAuthenticate } from '../middleware/auth';
import { notifyStaff } from '../services/notificationService';
import { normalizeUsername } from '../lib/username';

const router = Router();

const schema = z.object({
  username: z.string().max(80).optional(),
  email: z.string().max(120).optional(),
  reason: z.string().max(2000).optional(),
});

router.post('/', optionalAuthenticate, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني' });
  }

  let username = parsed.data.username?.trim() || '';
  let email = parsed.data.email?.trim() || '';
  const reason = parsed.data.reason?.trim() || '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'البريد الإلكتروني غير صالح' });
  }

  if (req.user) {
    username = username || req.user.username || '';
    email = email || req.user.email || '';
  }

  if (!username && !email) {
    return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني' });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(username ? [{ username: normalizeUsername(username) }] : []),
        ...(email ? [{ email: email.toLowerCase() }] : []),
      ],
    },
  });

  if (user?.residentId) {
    await prisma.contactRequest.create({
      data: {
        residentId: user.residentId,
        userId: user.id,
        category: 'REQUEST',
        subject: 'طلب حذف الحساب',
        message: [
          'طلب حذف الحساب والبيانات المرتبطة به.',
          `اسم المستخدم: ${user.username}`,
          `البريد: ${user.email}`,
          reason ? `ملاحظة: ${reason}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        status: 'PENDING',
      },
    });
  }

  await notifyStaff(
    'SYSTEM',
    'طلب حذف حساب',
    [
      `تم استلام طلب حذف حساب.`,
      `اسم المستخدم: ${username || user?.username || '—'}`,
      `البريد: ${email || user?.email || '—'}`,
      user ? `المعرّف: ${user.id} · الدور: ${user.role}` : 'لم يُعثر على حساب مطابق تلقائياً.',
      reason ? `ملاحظة: ${reason}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  );

  res.json({
    message: 'تم استلام طلب حذف الحساب. ستتواصل إدارة الكمبوند لإتمام الحذف خلال 30 يوماً.',
  });
});

export default router;
