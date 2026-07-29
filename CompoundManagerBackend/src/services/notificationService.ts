import { NotificationType } from '@prisma/client';
import { prisma } from '../lib/prisma';

export async function createNotification(params: {
  userId?: number;
  residentId?: number;
  type: NotificationType;
  title: string;
  message: string;
}) {
  return prisma.notification.create({ data: params });
}

export async function notifyResident(
  residentId: number,
  type: NotificationType,
  title: string,
  message: string
) {
  const user = await prisma.user.findFirst({ where: { residentId } });
  return createNotification({
    userId: user?.id,
    residentId,
    type,
    title,
    message,
  });
}

export async function notifyAllOwners(type: NotificationType, title: string, message: string) {
  const owners = await prisma.user.findMany({ where: { role: 'OWNER', status: 'APPROVED' } });
  return Promise.all(
    owners.map((u) =>
      createNotification({
        userId: u.id,
        residentId: u.residentId ?? undefined,
        type,
        title,
        message,
      })
    )
  );
}

export async function notifyStaff(type: NotificationType, title: string, message: string) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPERADMIN', 'ACCOUNTANT'] }, status: 'APPROVED' },
  });
  return Promise.all(
    staff.map((u) =>
      createNotification({
        userId: u.id,
        type,
        title,
        message,
      })
    )
  );
}

/** Notify approved owners linked to residents matching areas / buildings / residentId. */
export async function notifyOwnersTargeted(params: {
  title: string;
  message: string;
  type?: NotificationType;
  area?: string;
  areas?: string[];
  buildingNo?: string;
  buildings?: string[];
  residentId?: number;
}) {
  const { title, message, type = 'SYSTEM', area, areas, buildingNo, buildings, residentId } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    role: 'OWNER',
    status: 'APPROVED',
    residentId: { not: null },
  };

  if (residentId) {
    where.residentId = residentId;
  } else if (areas && areas.length > 0) {
    where.resident = { area: { in: areas } };
  } else if (area && buildings && buildings.length > 0) {
    where.resident = { area, buildingNo: { in: buildings } };
  } else if (area || buildingNo) {
    where.resident = {};
    if (area) where.resident.area = area;
    if (buildingNo) where.resident.buildingNo = buildingNo;
  }

  const owners = await prisma.user.findMany({
    where,
    include: { resident: { select: { id: true, residentName: true, area: true, buildingNo: true } } },
  });

  const created = await Promise.all(
    owners.map((u) =>
      createNotification({
        userId: u.id,
        residentId: u.residentId ?? undefined,
        type,
        title,
        message,
      })
    )
  );

  return {
    sent: created.length,
    recipients: owners.map((u) => ({
      userId: u.id,
      name: u.name,
      residentId: u.residentId,
      residentName: u.resident?.residentName,
      area: u.resident?.area,
      buildingNo: u.resident?.buildingNo,
    })),
  };
}

export async function checkOverdueBills() {
  const now = new Date();
  const overdue = await prisma.bill.findMany({
    where: { status: { in: ['ISSUED', 'DUE'] }, dueDate: { lt: now } },
    include: { resident: true },
  });

  for (const bill of overdue) {
    await prisma.bill.update({ where: { id: bill.id }, data: { status: 'OVERDUE' } });
    await notifyResident(
      bill.residentId,
      'BILL_OVERDUE',
      'فاتورة متأخرة',
      `فاتورة ${bill.period} بمبلغ ${bill.amount} جنيه متأخرة عن السداد`
    );
  }

  return overdue.length;
}

export async function sendDueReminders(daysBefore = 3) {
  const target = new Date();
  target.setDate(target.getDate() + daysBefore);
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  const dueSoon = await prisma.bill.findMany({
    where: {
      status: { in: ['ISSUED', 'DUE'] },
      dueDate: { gte: start, lte: end },
    },
  });

  for (const bill of dueSoon) {
    await prisma.bill.update({ where: { id: bill.id }, data: { status: 'DUE' } });
    await notifyResident(
      bill.residentId,
      'BILL_DUE',
      'تذكير بموعد السداد',
      `فاتورة ${bill.period} مستحقة خلال ${daysBefore} أيام — المبلغ ${bill.amount} جنيه`
    );
  }

  return dueSoon.length;
}
