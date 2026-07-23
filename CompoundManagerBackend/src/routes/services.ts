import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, ADMIN_ROLES, STAFF_ROLES, isStaffRole } from '../middleware/auth';

const router = Router();

const serviceSchema = z.object({
  serviceType: z.string().max(30),
  serviceName: z.string().max(50),
  mobile: z.string().max(30),
  landLine: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
  residentId: z.number().optional().nullable(),
  activeFlag: z.enum(['Y', 'N']).optional(),
});

function providerCard(resident: {
  id: number;
  residentName: string;
  mobile: string;
  landLine: string | null;
  email: string | null;
  area: string;
  buildingNo: string;
  floorNo: number;
  apartmentNo: number;
  isServiceProvider: boolean;
  services?: Array<{
    id: number;
    serviceType: string;
    serviceName: string;
    mobile: string;
    notes: string | null;
    activeFlag: string;
  }>;
}) {
  const activeServices = (resident.services || []).filter((s) => s.activeFlag === 'Y');
  return activeServices.map((s) => ({
    id: s.id,
    residentId: resident.id,
    serviceType: s.serviceType,
    serviceName: s.serviceName,
    mobile: s.mobile || resident.mobile,
    notes: s.notes,
    activeFlag: 'Y' as const,
    resident: {
      id: resident.id,
      residentName: resident.residentName,
      area: resident.area,
      buildingNo: resident.buildingNo,
      floorNo: resident.floorNo,
      apartmentNo: resident.apartmentNo,
      isServiceProvider: true,
      mobile: resident.mobile,
      landLine: resident.landLine,
      email: resident.email,
    },
  }));
}

// Public directory: owners who enabled "service provider"
router.get('/', authenticate, async (req, res) => {
  const manage = req.query.manage === 'true';
  const isStaff = isStaffRole(req.user?.role);

  if (manage && isStaff) {
    const services = await prisma.serviceInformation.findMany({
      include: {
        resident: {
          select: {
            id: true,
            residentName: true,
            area: true,
            buildingNo: true,
            floorNo: true,
            apartmentNo: true,
            isServiceProvider: true,
            mobile: true,
          },
        },
      },
      orderBy: { registerDate: 'desc' },
    });
    return res.json(services);
  }

  const providers = await prisma.resident.findMany({
    where: { isServiceProvider: true },
    include: {
      services: true,
    },
    orderBy: { residentName: 'asc' },
  });

  const listings = providers.flatMap((r) => providerCard(r));
  res.json(listings);
});

router.get('/my', authenticate, authorize('OWNER', 'DEPENDENT'), async (req, res) => {
  if (!req.user?.residentId) return res.json({ isServiceProvider: false, services: [], service: null });
  const resident = await prisma.resident.findUnique({
    where: { id: req.user.residentId },
    select: {
      id: true,
      isServiceProvider: true,
      residentName: true,
      mobile: true,
      area: true,
      buildingNo: true,
      floorNo: true,
      apartmentNo: true,
    },
  });
  const services = await prisma.serviceInformation.findMany({
    where: { residentId: req.user.residentId },
    orderBy: { registerDate: 'desc' },
  });
  res.json({
    isServiceProvider: resident?.isServiceProvider ?? false,
    services,
    service: services[0] || null,
    resident,
  });
});

const ownerServiceSchema = z.object({
  serviceType: z.string().min(1).max(30),
  serviceName: z.string().min(1).max(50),
  mobile: z.string().min(1).max(30),
  notes: z.string().max(200).optional().nullable(),
});

// Owner upserts their own service details from profile
router.put('/my', authenticate, authorize('OWNER', 'DEPENDENT'), async (req, res) => {
  if (!req.user?.residentId) {
    return res.status(400).json({ error: 'لا يوجد وحدة مرتبطة بحسابك' });
  }

  const parsed = ownerServiceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.serviceInformation.findFirst({
    where: { residentId: req.user.residentId },
    orderBy: { registerDate: 'asc' },
  });

  const service = existing
    ? await prisma.serviceInformation.update({
        where: { id: existing.id },
        data: {
          serviceType: parsed.data.serviceType,
          serviceName: parsed.data.serviceName,
          mobile: parsed.data.mobile,
          notes: parsed.data.notes || undefined,
          activeFlag: 'Y',
        },
      })
    : await prisma.serviceInformation.create({
        data: {
          residentId: req.user.residentId,
          serviceType: parsed.data.serviceType,
          serviceName: parsed.data.serviceName,
          mobile: parsed.data.mobile,
          notes: parsed.data.notes || undefined,
          activeFlag: 'Y',
        },
      });

  res.json({
    message: 'تم حفظ بيانات الخدمة',
    service,
  });
});

router.patch('/provider', authenticate, authorize('OWNER', 'DEPENDENT'), async (req, res) => {
  if (!req.user?.residentId) {
    return res.status(400).json({ error: 'لا يوجد وحدة مرتبطة بحسابك' });
  }

  const enabled = Boolean(req.body.enabled ?? req.body.isServiceProvider);
  const resident = await prisma.resident.update({
    where: { id: req.user.residentId },
    data: { isServiceProvider: enabled },
    select: {
      id: true,
      residentName: true,
      isServiceProvider: true,
      mobile: true,
      area: true,
      buildingNo: true,
      floorNo: true,
      apartmentNo: true,
    },
  });

  res.json({
    message: enabled
      ? 'تم تفعيل حسابك كمقدم خدمة. ستظهر بياناتك في صفحة الخدمات'
      : 'تم إيقاف ظهورك في صفحة الخدمات',
    resident,
  });
});

router.get('/:id', authenticate, async (req, res) => {
  const service = await prisma.serviceInformation.findUnique({
    where: { id: parseInt(String(req.params.id)) },
    include: { resident: true },
  });
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

router.post('/', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const parsed = serviceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  if (data.residentId) {
    const resident = await prisma.resident.findUnique({ where: { id: data.residentId } });
    if (!resident) return res.status(404).json({ error: 'Resident not found' });
  }

  const service = await prisma.serviceInformation.create({
    data: {
      serviceType: data.serviceType,
      serviceName: data.serviceName,
      mobile: data.mobile,
      landLine: data.landLine || undefined,
      email: data.email || undefined,
      notes: data.notes || undefined,
      residentId: data.residentId || undefined,
      activeFlag: data.activeFlag || 'Y',
    },
    include: { resident: true },
  });
  res.status(201).json(service);
});

router.put('/:id', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await prisma.serviceInformation.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Service not found' });

  const parsed = serviceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const service = await prisma.serviceInformation.update({
    where: { id },
    data: parsed.data,
    include: { resident: true },
  });
  res.json(service);
});

router.patch('/:id/toggle', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id));
  const existing = await prisma.serviceInformation.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Service not found' });

  const service = await prisma.serviceInformation.update({
    where: { id },
    data: { activeFlag: existing.activeFlag === 'Y' ? 'N' : 'Y' },
    include: { resident: true },
  });
  res.json(service);
});

router.delete('/:id', authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  await prisma.serviceInformation.delete({ where: { id: parseInt(String(req.params.id)) } });
  res.status(204).send();
});

export default router;
