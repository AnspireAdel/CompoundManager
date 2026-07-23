import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, ADMIN_ROLES, STAFF_ROLES, isResidentUser } from '../middleware/auth';
import {
  checkOverdueBills,
  notifyOwnersTargeted,
  sendDueReminders,
} from '../services/notificationService';

const router = Router();

router.use(authenticate);

const sendSchema = z.discriminatedUnion('target', [
  z.object({
    target: z.literal('area'),
    area: z.string().min(1),
    title: z.string().min(1).max(120),
    message: z.string().min(1).max(1000),
  }),
  z.object({
    target: z.literal('building'),
    area: z.string().min(1),
    buildingNo: z.string().min(1),
    title: z.string().min(1).max(120),
    message: z.string().min(1).max(1000),
  }),
  z.object({
    target: z.literal('owner'),
    residentId: z.number().int().positive(),
    title: z.string().min(1).max(120),
    message: z.string().min(1).max(1000),
  }),
]);

router.get('/', async (req, res) => {
  const { unreadOnly } = req.query;
  const where: Record<string, unknown> = {};

  if (isResidentUser(req.user?.role)) {
    where.OR = [{ userId: req.user.id }, { residentId: req.user.residentId }];
  } else {
    where.userId = req.user!.id;
  }
  if (unreadOnly === 'true') where.read = false;

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(notifications);
});

router.get('/unread-count', async (req, res) => {
  const where: Record<string, unknown> = { read: false };
  if (isResidentUser(req.user?.role)) {
    where.OR = [{ userId: req.user.id }, { residentId: req.user.residentId }];
  } else {
    where.userId = req.user!.id;
  }

  const count = await prisma.notification.count({ where });
  res.json({ count });
});

router.post('/send', authorize(...STAFF_ROLES), async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  let result;

  if (data.target === 'area') {
    result = await notifyOwnersTargeted({
      title: data.title,
      message: data.message,
      area: data.area,
    });
  } else if (data.target === 'building') {
    result = await notifyOwnersTargeted({
      title: data.title,
      message: data.message,
      area: data.area,
      buildingNo: data.buildingNo,
    });
  } else {
    result = await notifyOwnersTargeted({
      title: data.title,
      message: data.message,
      residentId: data.residentId,
    });
  }

  if (result.sent === 0) {
    return res.status(404).json({ error: 'لا يوجد ملاك مطابقون للإرسال' });
  }

  res.status(201).json(result);
});

router.patch('/:id/read', async (req, res) => {
  const notification = await prisma.notification.update({
    where: { id: parseInt(String(req.params.id)) },
    data: { read: true },
  });
  res.json(notification);
});

router.patch('/read-all', async (req, res) => {
  const where: Record<string, unknown> = { read: false };
  if (isResidentUser(req.user?.role)) {
    where.OR = [{ userId: req.user.id }, { residentId: req.user.residentId }];
  } else {
    where.userId = req.user!.id;
  }

  await prisma.notification.updateMany({ where, data: { read: true } });
  res.json({ success: true });
});

router.post('/run-reminders', authorize(...STAFF_ROLES), async (_req, res) => {
  const dueCount = await sendDueReminders(3);
  const overdueCount = await checkOverdueBills();
  res.json({ dueReminders: dueCount, overdueMarked: overdueCount });
});

export default router;
