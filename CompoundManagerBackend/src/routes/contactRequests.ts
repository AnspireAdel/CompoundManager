import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, ADMIN_ROLES, STAFF_ROLES, isResidentUser } from '../middleware/auth';
import { createNotification, notifyStaff } from '../services/notificationService';

const router = Router();

router.use(authenticate);

const createSchema = z.object({
  category: z.enum(['REQUEST', 'INQUIRY', 'COMPLAINT']),
  subject: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
});

const actionSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  staffResponse: z.string().max(2000).optional(),
});

const categoryLabel: Record<string, string> = {
  REQUEST: 'طلب',
  INQUIRY: 'استفسار',
  COMPLAINT: 'شكوى',
};

const includeRelations = {
  resident: {
    select: {
      id: true,
      residentName: true,
      residentType: true,
      area: true,
      buildingNo: true,
      floorNo: true,
      apartmentNo: true,
      mobile: true,
    },
  },
  user: { select: { id: true, name: true, email: true } },
};

router.get('/', async (req, res) => {
  const { status, category } = req.query;
  const where: Record<string, unknown> = {};

  if (isResidentUser(req.user?.role)) {
    where.userId = req.user.id;
  }
  if (status && typeof status === 'string') where.status = status;
  if (category && typeof category === 'string') where.category = category;

  const items = await prisma.contactRequest.findMany({
    where,
    include: includeRelations,
    orderBy: { createdAt: 'desc' },
  });
  res.json(items);
});

router.post('/', authorize('OWNER', 'DEPENDENT'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (!req.user?.residentId) {
    return res.status(400).json({ error: 'لا توجد وحدة مرتبطة بحسابك' });
  }

  const item = await prisma.contactRequest.create({
    data: {
      residentId: req.user.residentId,
      userId: req.user.id,
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: 'PENDING',
    },
    include: includeRelations,
  });

  await notifyStaff(
    'SERVICE_INQUIRY',
    `${categoryLabel[item.category]} جديد`,
    `${item.resident.residentName}: ${item.subject}`
  );

  res.status(201).json(item);
});

router.patch('/:id', authorize(...STAFF_ROLES), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'معرف غير صالح' });
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.contactRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'الطلب غير موجود' });

  const updated = await prisma.contactRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      staffResponse: parsed.data.staffResponse ?? existing.staffResponse,
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
    },
    include: includeRelations,
  });

  const statusText: Record<string, string> = {
    PENDING: 'قيد الانتظار',
    IN_PROGRESS: 'قيد المعالجة',
    RESOLVED: 'تم الحل',
    CLOSED: 'مغلق',
  };

  await createNotification({
    userId: updated.userId,
    residentId: updated.residentId,
    type: 'SERVICE_INQUIRY',
    title: `تحديث على ${categoryLabel[updated.category]}`,
    message: parsed.data.staffResponse
      ? `${statusText[updated.status]}: ${parsed.data.staffResponse}`
      : `تم تحديث الحالة إلى: ${statusText[updated.status]}`,
  });

  res.json(updated);
});

export default router;
