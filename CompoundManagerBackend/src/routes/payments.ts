import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, ADMIN_ROLES, STAFF_ROLES, isResidentUser } from '../middleware/auth';
import { recordPayment } from '../services/billService';
import { createNotification, notifyResident } from '../services/notificationService';
import { decodeUploadName } from '../lib/uploadName';

const router = Router();

const uploadsDir = path.join(process.cwd(), 'uploads', 'payments');
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
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('يسمح فقط بملفات الصور أو PDF'));
  },
});

router.use(authenticate);

router.get('/', async (req, res) => {
  const { status, billId } = req.query;
  const where: Record<string, unknown> = {};

  if (isResidentUser(req.user?.role)) {
    where.userId = req.user.id;
  }
  if (status) where.status = status;
  if (billId) where.billId = parseInt(billId as string);

  const proofs = await prisma.paymentProof.findMany({
    where,
    include: {
      bill: true,
      resident: {
        select: { id: true, residentName: true, area: true, buildingNo: true, apartmentNo: true },
      },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(proofs);
});

router.get('/:id', async (req, res) => {
  const proof = await prisma.paymentProof.findUnique({
    where: { id: parseInt(String(req.params.id)) },
    include: { bill: true, resident: true, user: { select: { id: true, name: true, email: true } } },
  });
  if (!proof) return res.status(404).json({ error: 'Payment proof not found' });
  if (isResidentUser(req.user?.role) && proof.residentId !== req.user.residentId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(proof);
});

router.post('/', authorize('OWNER', 'DEPENDENT', ...STAFF_ROLES), upload.single('file'), async (req, res) => {
  const billId = parseInt(String(req.body.billId));
  const amount = parseFloat(String(req.body.amount));
  const notes = req.body.notes ? String(req.body.notes) : undefined;

  if (!billId || Number.isNaN(billId) || !amount || amount <= 0) {
    return res.status(400).json({ error: 'billId and amount are required' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'يجب رفع صورة أو ملف PDF لإثبات الدفع' });
  }

  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  if (isResidentUser(req.user?.role) && bill.residentId !== req.user.residentId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const pending = await prisma.paymentProof.findFirst({
    where: { billId, status: 'PENDING' },
  });
  if (pending) {
    return res.status(409).json({ error: 'يوجد مستند دفع قيد المراجعة لهذه الفاتورة' });
  }

  const proof = await prisma.paymentProof.create({
    data: {
      billId,
      residentId: bill.residentId,
      userId: req.user!.id,
      amount,
      fileName: decodeUploadName(req.file.originalname),
      filePath: `/uploads/payments/${req.file.filename}`,
      fileMime: req.file.mimetype,
      notes,
      status: 'PENDING',
    },
  });

  await prisma.bill.update({
    where: { id: billId },
    data: { status: 'PENDING_REVIEW' },
  });

  const accountants = await prisma.user.findMany({
    where: { role: { in: ['ACCOUNTANT', 'ADMIN', 'SUPERADMIN'] }, status: 'APPROVED' },
  });
  await Promise.all(
    accountants.map((u) =>
      createNotification({
        userId: u.id,
        type: 'SYSTEM',
        title: 'مستند دفع جديد للمراجعة',
        message: `فاتورة #${billId} — مبلغ ${amount} ج.م بانتظار المراجعة`,
      })
    )
  );

  res.status(201).json(proof);
});

router.patch('/:id/approve', authorize(...STAFF_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const reviewNotes = (req.body as { reviewNotes?: string }).reviewNotes;

  const proof = await prisma.paymentProof.findUnique({ where: { id }, include: { bill: true } });
  if (!proof) return res.status(404).json({ error: 'Payment proof not found' });
  if (proof.status !== 'PENDING') {
    return res.status(400).json({ error: 'هذا المستند تمت مراجعته مسبقاً' });
  }

  await recordPayment(proof.residentId, proof.amount, proof.billId, proof.notes || 'دفعة بمستند مرفق');

  const updated = await prisma.paymentProof.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewNotes,
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
    },
    include: { bill: true },
  });

  await createNotification({
    userId: proof.userId,
    residentId: proof.residentId,
    type: 'PAYMENT_RECEIVED',
    title: 'تم قبول مستند الدفع',
    message: `تم اعتماد دفعة ${proof.amount} ج.م للفاتورة`,
  });

  res.json(updated);
});

router.patch('/:id/reject', authorize(...STAFF_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const reviewNotes = (req.body as { reviewNotes?: string }).reviewNotes || 'المستند غير صالح';

  const proof = await prisma.paymentProof.findUnique({ where: { id } });
  if (!proof) return res.status(404).json({ error: 'Payment proof not found' });
  if (proof.status !== 'PENDING') {
    return res.status(400).json({ error: 'هذا المستند تمت مراجعته مسبقاً' });
  }

  const updated = await prisma.paymentProof.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewNotes,
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
    },
  });

  const bill = await prisma.bill.findUnique({ where: { id: proof.billId } });
  if (bill && bill.status === 'PENDING_REVIEW') {
    const newStatus = bill.dueDate < new Date() ? 'OVERDUE' : bill.paidAmount > 0 ? 'PARTIAL' : 'ISSUED';
    await prisma.bill.update({ where: { id: bill.id }, data: { status: newStatus } });
  }

  await notifyResident(
    proof.residentId,
    'PAYMENT_REJECTED',
    'تم رفض مستند الدفع',
    reviewNotes
  );

  res.json(updated);
});

export default router;
