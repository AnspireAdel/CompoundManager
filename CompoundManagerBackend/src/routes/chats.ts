import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, isSuperAdminRole } from '../middleware/auth';
import {
  addHouseholdDependentsToChat,
  removeHouseholdDependentsFromChat,
} from '../lib/residentAccess';

const router = Router();

router.use(authenticate);

const uploadsDir = path.join(process.cwd(), 'uploads', 'chats');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  memberIds: z.array(z.number().int().positive()).optional(),
});

const messageSchema = z.object({
  body: z.string().min(1).max(2000),
});

const addMembersSchema = z.object({
  userIds: z.array(z.number().int().positive()).min(1),
});

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  resident: {
    select: {
      area: true,
      buildingNo: true,
      mobile: true,
    },
  },
  dependent: {
    select: {
      mobile: true,
    },
  },
};

async function isMember(chatGroupId: number, userId: number) {
  const m = await prisma.chatMember.findUnique({
    where: { chatGroupId_userId: { chatGroupId, userId } },
  });
  return Boolean(m);
}

function detectMessageType(mime?: string | null, explicit?: string | null): 'TEXT' | 'FILE' | 'AUDIO' {
  if (explicit === 'AUDIO' || explicit === 'FILE' || explicit === 'TEXT') return explicit;
  if (!mime) return 'FILE';
  if (mime.startsWith('audio/')) return 'AUDIO';
  return 'FILE';
}

/** List chats: memberships + available groups for join (non-members). Superadmin sees all. */
router.get('/', async (req, res) => {
  const userId = req.user!.id;
  const superAdmin = isSuperAdminRole(req.user!.role);

  const groups = await prisma.chatGroup.findMany({
    include: {
      createdBy: { select: userSelect },
      _count: { select: { members: true, messages: true } },
      members: {
        where: { userId },
        select: { id: true, joinedAt: true },
      },
      joinRequests: {
        where: { userId },
        select: { id: true, status: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const result = groups.map((g) => {
    const membership = g.members[0] || null;
    const myRequest = g.joinRequests[0] || null;
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      createdBy: g.createdBy,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      membersCount: g._count.members,
      messagesCount: g._count.messages,
      isMember: Boolean(membership),
      joinedAt: membership?.joinedAt || null,
      myJoinRequest: myRequest,
      canJoin: !membership && (!myRequest || myRequest.status === 'REJECTED'),
      canManage: superAdmin,
    };
  });

  if (superAdmin) {
    return res.json(result);
  }

  // Dependents: only parent's chats they already belong to (no join requests)
  if (req.user!.role === 'DEPENDENT') {
    return res.json(
      result
        .filter((g) => g.isMember)
        .map((g) => ({ ...g, canJoin: false, myJoinRequest: null }))
    );
  }

  // Owners/admins/accountants: show joined + available to request
  res.json(result.filter((g) => g.isMember || g.canJoin || g.myJoinRequest?.status === 'PENDING'));
});

router.post('/', authorize('SUPERADMIN'), async (req, res) => {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, description, memberIds = [] } = parsed.data;
  const uniqueMemberIds = Array.from(new Set([req.user!.id, ...memberIds]));

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueMemberIds }, status: 'APPROVED' },
    select: { id: true },
  });
  const validIds = users.map((u) => u.id);

  const group = await prisma.chatGroup.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      createdById: req.user!.id,
      members: {
        create: validIds.map((userId) => ({ userId })),
      },
    },
    include: {
      createdBy: { select: userSelect },
      members: { include: { user: { select: userSelect } } },
      _count: { select: { members: true, messages: true } },
    },
  });

  for (const userId of validIds) {
    await addHouseholdDependentsToChat(group.id, userId);
  }

  const refreshed = await prisma.chatGroup.findUnique({
    where: { id: group.id },
    include: {
      createdBy: { select: userSelect },
      members: { include: { user: { select: userSelect } } },
      _count: { select: { members: true, messages: true } },
    },
  });

  res.status(201).json(refreshed);
});

router.get('/:id', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const userId = req.user!.id;
  const superAdmin = isSuperAdminRole(req.user!.role);

  const group = await prisma.chatGroup.findUnique({
    where: { id },
    include: {
      createdBy: { select: userSelect },
      members: {
        include: { user: { select: userSelect } },
        orderBy: { joinedAt: 'asc' },
      },
      joinRequests: {
        where: superAdmin ? { status: 'PENDING' } : { userId },
        include: { user: { select: userSelect } },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { members: true, messages: true } },
    },
  });
  if (!group) return res.status(404).json({ error: 'المجموعة غير موجودة' });

  const membership = group.members.find((m) => m.userId === userId);
  if (!superAdmin && !membership) {
    // Non-members can see basic group info to request join
    return res.json({
      id: group.id,
      name: group.name,
      description: group.description,
      createdBy: group.createdBy,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members: [],
      joinRequests: group.joinRequests,
      _count: group._count,
      isMember: false,
      canManage: false,
    });
  }

  res.json({
    ...group,
    isMember: Boolean(membership),
    canManage: superAdmin,
  });
});

router.put('/:id', authorize('SUPERADMIN'), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = createGroupSchema.pick({ name: true, description: true }).partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.chatGroup.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'المجموعة غير موجودة' });

  const group = await prisma.chatGroup.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name.trim() }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description?.trim() || null,
      }),
    },
    include: {
      createdBy: { select: userSelect },
      _count: { select: { members: true, messages: true } },
    },
  });
  res.json(group);
});

router.delete('/:id', authorize('SUPERADMIN'), async (req, res) => {
  const id = parseInt(String(req.params.id));
  await prisma.chatGroup.delete({ where: { id } });
  res.status(204).send();
});

/** Superadmin adds members immediately (no approval). */
router.post('/:id/members', authorize('SUPERADMIN'), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const parsed = addMembersSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const group = await prisma.chatGroup.findUnique({ where: { id } });
  if (!group) return res.status(404).json({ error: 'المجموعة غير موجودة' });

  const users = await prisma.user.findMany({
    where: { id: { in: parsed.data.userIds }, status: 'APPROVED' },
    select: { id: true },
  });

  for (const u of users) {
    await prisma.chatMember.upsert({
      where: { chatGroupId_userId: { chatGroupId: id, userId: u.id } },
      create: { chatGroupId: id, userId: u.id },
      update: {},
    });
    // Clear any pending join request
    await prisma.chatJoinRequest.deleteMany({
      where: { chatGroupId: id, userId: u.id },
    });
    await addHouseholdDependentsToChat(id, u.id);
  }

  const members = await prisma.chatMember.findMany({
    where: { chatGroupId: id },
    include: { user: { select: userSelect } },
    orderBy: { joinedAt: 'asc' },
  });
  res.json(members);
});

router.delete('/:id/members/:userId', authorize('SUPERADMIN'), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const userId = parseInt(String(req.params.userId));

  await prisma.chatMember.deleteMany({ where: { chatGroupId: id, userId } });
  await removeHouseholdDependentsFromChat(id, userId);
  res.status(204).send();
});

/** User requests to join. */
router.post('/:id/join', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const userId = req.user!.id;

  if (req.user!.role === 'DEPENDENT') {
    return res.status(403).json({ error: 'التابع يرى محادثات المالك تلقائياً ولا يمكنه طلب الانضمام' });
  }

  const group = await prisma.chatGroup.findUnique({ where: { id } });
  if (!group) return res.status(404).json({ error: 'المجموعة غير موجودة' });

  if (await isMember(id, userId)) {
    return res.status(400).json({ error: 'أنت عضو بالفعل في هذه المجموعة' });
  }

  const existing = await prisma.chatJoinRequest.findUnique({
    where: { chatGroupId_userId: { chatGroupId: id, userId } },
  });
  if (existing?.status === 'PENDING') {
    return res.status(400).json({ error: 'طلب الانضمام قيد المراجعة بالفعل' });
  }

  const request = await prisma.chatJoinRequest.upsert({
    where: { chatGroupId_userId: { chatGroupId: id, userId } },
    create: { chatGroupId: id, userId, status: 'PENDING' },
    update: {
      status: 'PENDING',
      reviewedAt: null,
      reviewedById: null,
      createdAt: new Date(),
    },
    include: { user: { select: userSelect }, chatGroup: { select: { id: true, name: true } } },
  });

  res.status(201).json(request);
});

/** Member leaves the group. */
router.post('/:id/leave', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const userId = req.user!.id;

  const deleted = await prisma.chatMember.deleteMany({
    where: { chatGroupId: id, userId },
  });
  if (deleted.count === 0) {
    return res.status(400).json({ error: 'لست عضواً في هذه المجموعة' });
  }

  await prisma.chatJoinRequest.deleteMany({ where: { chatGroupId: id, userId } });
  await removeHouseholdDependentsFromChat(id, userId);
  res.json({ message: 'تم مغادرة المجموعة' });
});

router.get('/:id/join-requests', authorize('SUPERADMIN'), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const status = (req.query.status as string) || 'PENDING';

  const requests = await prisma.chatJoinRequest.findMany({
    where: {
      chatGroupId: id,
      ...(status !== 'ALL' && { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }),
    },
    include: { user: { select: userSelect } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

router.post('/:id/join-requests/:requestId/approve', authorize('SUPERADMIN'), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const requestId = parseInt(String(req.params.requestId));

  const joinReq = await prisma.chatJoinRequest.findFirst({
    where: { id: requestId, chatGroupId: id },
  });
  if (!joinReq) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (joinReq.status !== 'PENDING') {
    return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً' });
  }

  await prisma.$transaction([
    prisma.chatJoinRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: req.user!.id,
      },
    }),
    prisma.chatMember.upsert({
      where: { chatGroupId_userId: { chatGroupId: id, userId: joinReq.userId } },
      create: { chatGroupId: id, userId: joinReq.userId },
      update: {},
    }),
  ]);

  await addHouseholdDependentsToChat(id, joinReq.userId);

  res.json({ message: 'تمت الموافقة وإضافة العضو' });
});

router.post('/:id/join-requests/:requestId/reject', authorize('SUPERADMIN'), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const requestId = parseInt(String(req.params.requestId));

  const joinReq = await prisma.chatJoinRequest.findFirst({
    where: { id: requestId, chatGroupId: id },
  });
  if (!joinReq) return res.status(404).json({ error: 'الطلب غير موجود' });
  if (joinReq.status !== 'PENDING') {
    return res.status(400).json({ error: 'تمت معالجة هذا الطلب مسبقاً' });
  }

  await prisma.chatJoinRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedById: req.user!.id,
    },
  });

  res.json({ message: 'تم رفض طلب الانضمام' });
});

router.get('/:id/messages', async (req, res) => {
  const id = parseInt(String(req.params.id));
  const userId = req.user!.id;
  const superAdmin = isSuperAdminRole(req.user!.role);

  if (!superAdmin && !(await isMember(id, userId))) {
    return res.status(403).json({ error: 'لست عضواً في هذه المجموعة' });
  }

  const take = Math.min(Number(req.query.limit) || 50, 100);
  const beforeId = req.query.beforeId ? Number(req.query.beforeId) : undefined;

  const messages = await prisma.chatMessage.findMany({
    where: {
      chatGroupId: id,
      ...(beforeId ? { id: { lt: beforeId } } : {}),
    },
    include: { user: { select: userSelect } },
    orderBy: { id: 'desc' },
    take,
  });

  res.json(messages.reverse());
});

router.post('/:id/messages', (req, res, next) => {
  const ct = String(req.headers['content-type'] || '');
  if (ct.includes('multipart/form-data')) {
    return upload.single('file')(req, res, (err) => {
      if (err) {
        const msg = err instanceof Error ? err.message : 'فشل رفع الملف';
        if ((err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'حجم الملف كبير جداً (الحد 25 ميجابايت)' });
        }
        return res.status(400).json({ error: msg });
      }
      next();
    });
  }
  next();
}, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const userId = req.user!.id;

  if (!(await isMember(id, userId))) {
    return res.status(403).json({ error: 'يجب أن تكون عضواً لإرسال رسائل' });
  }

  const file = req.file;
  const bodyRaw = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  const explicitType = typeof req.body?.messageType === 'string' ? req.body.messageType : null;

  if (!file) {
    const parsed = messageSchema.safeParse({ body: bodyRaw });
    if (!parsed.success) return res.status(400).json({ error: 'نص الرسالة مطلوب' });

    const message = await prisma.chatMessage.create({
      data: {
        chatGroupId: id,
        userId,
        body: parsed.data.body,
        messageType: 'TEXT',
      },
      include: { user: { select: userSelect } },
    });

    await prisma.chatGroup.update({ where: { id }, data: { updatedAt: new Date() } });
    return res.status(201).json(message);
  }

  const messageType = detectMessageType(file.mimetype, explicitType);
  const message = await prisma.chatMessage.create({
    data: {
      chatGroupId: id,
      userId,
      body: bodyRaw || (messageType === 'AUDIO' ? 'رسالة صوتية' : file.originalname),
      messageType,
      fileName: file.originalname,
      filePath: `/uploads/chats/${file.filename}`,
      mimeType: file.mimetype,
      fileSize: file.size,
    },
    include: { user: { select: userSelect } },
  });

  await prisma.chatGroup.update({ where: { id }, data: { updatedAt: new Date() } });
  res.status(201).json(message);
});

export default router;
