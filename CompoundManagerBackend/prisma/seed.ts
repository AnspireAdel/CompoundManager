import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const superAdminPassword = await bcrypt.hash('superadmin123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);
  const accountantPassword = await bcrypt.hash('accountant123', 10);
  const ownerPassword = await bcrypt.hash('123456', 10);

  await prisma.user.upsert({
    where: { email: 'superadmin@compound.com' },
    update: { status: 'APPROVED', role: 'SUPERADMIN' },
    create: {
      email: 'superadmin@compound.com',
      password: superAdminPassword,
      name: 'المدير الأعلى',
      role: 'SUPERADMIN',
      status: 'APPROVED',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@compound.com' },
    update: { status: 'APPROVED' },
    create: {
      email: 'admin@compound.com',
      password: adminPassword,
      name: 'مدير النظام',
      role: 'ADMIN',
      status: 'APPROVED',
    },
  });

  await prisma.user.upsert({
    where: { email: 'accountant@compound.com' },
    update: { status: 'APPROVED' },
    create: {
      email: 'accountant@compound.com',
      password: accountantPassword,
      name: 'المحاسب',
      role: 'ACCOUNTANT',
      status: 'APPROVED',
    },
  });

  for (const name of ['طب', 'تعليم', 'صيانة', 'تجميل', 'أخرى']) {
    await prisma.serviceType.upsert({
      where: { name },
      update: {},
      create: { name, activeFlag: 'Y' },
    });
  }

  const unitTypes = [
    { name: 'شقة', monthlyFees: 500, hasFloor: true, hasApartment: true },
    { name: 'فيلا', monthlyFees: 1200, hasFloor: false, hasApartment: false },
    { name: 'بدروم', monthlyFees: 350, hasFloor: false, hasApartment: true },
    { name: 'روف', monthlyFees: 700, hasFloor: true, hasApartment: true },
    { name: 'دور', monthlyFees: 900, hasFloor: true, hasApartment: false },
    { name: 'تجارية', monthlyFees: 1500, hasFloor: true, hasApartment: true },
    { name: 'مول', monthlyFees: 2500, hasFloor: false, hasApartment: false },
  ];

  for (const ut of unitTypes) {
    await prisma.unitType.upsert({
      where: { name: ut.name },
      update: {
        monthlyFees: ut.monthlyFees,
        hasFloor: ut.hasFloor,
        hasApartment: ut.hasApartment,
      },
      create: { ...ut, activeFlag: 'Y' },
    });
  }

  const apartmentType = await prisma.unitType.findUnique({ where: { name: 'شقة' } });
  const villaType = await prisma.unitType.findUnique({ where: { name: 'فيلا' } });

  const residents = [
    { area: 'A', buildingNo: '01', floorNo: 1, apartmentNo: 1, residentName: 'أحمد محمد', mobile: '01012345678', email: 'ahmed@example.com', monthlyFees: 500, unitTypeId: apartmentType?.id },
    { area: 'A', buildingNo: '01', floorNo: 1, apartmentNo: 2, residentName: 'فاطمة علي', mobile: '01098765432', email: 'fatma@example.com', monthlyFees: 500, unitTypeId: apartmentType?.id },
    { area: 'A', buildingNo: '02', floorNo: 2, apartmentNo: 5, residentName: 'محمود حسن', mobile: '01122334455', email: 'mahmoud@example.com', monthlyFees: 1200, unitTypeId: villaType?.id },
    { area: 'B', buildingNo: '01', floorNo: 3, apartmentNo: 10, residentName: 'سارة إبراهيم', mobile: '01234567890', email: 'sara@example.com', monthlyFees: 500, unitTypeId: apartmentType?.id },
  ];

  for (const r of residents) {
    const resident = await prisma.resident.upsert({
      where: {
        area_buildingNo_floorNo_apartmentNo: {
          area: r.area,
          buildingNo: r.buildingNo,
          floorNo: r.floorNo,
          apartmentNo: r.apartmentNo,
        },
      },
      update: {},
      create: {
        ...r,
        residentType: 'O',
        nationality: 'مصري',
        openingBalance: 0,
      },
    });

    if (r.email) {
      await prisma.user.upsert({
        where: { email: r.email },
        update: { status: 'APPROVED' },
        create: {
          email: r.email,
          password: ownerPassword,
          name: r.residentName,
          role: 'OWNER',
          status: 'APPROVED',
          residentId: resident.id,
        },
      });
    }
  }

  const ahmed = await prisma.resident.findFirst({ where: { residentName: 'أحمد محمد' } });
  const fatma = await prisma.resident.findFirst({ where: { residentName: 'فاطمة علي' } });

  if (ahmed) {
    await prisma.resident.update({
      where: { id: ahmed.id },
      data: { isServiceProvider: true },
    });
    await prisma.serviceInformation.upsert({
      where: { id: 1 },
      update: {},
      create: {
        residentId: ahmed.id,
        serviceType: 'طب',
        serviceName: 'عيادة د. أحمد - طب عام',
        mobile: '01012345678',
        notes: 'كشف وعلاج عام - متاح يومياً 4-8 مساءً',
        activeFlag: 'Y',
      },
    });
  }

  if (fatma) {
    await prisma.resident.update({
      where: { id: fatma.id },
      data: { isServiceProvider: true },
    });
    await prisma.serviceInformation.upsert({
      where: { id: 2 },
      update: {},
      create: {
        residentId: fatma.id,
        serviceType: 'تعليم',
        serviceName: 'دروس خصوصية - رياضيات وعلوم',
        mobile: '01098765432',
        notes: 'للمرحلة الإعدادية والثانوية',
        activeFlag: 'Y',
      },
    });
  }

  const period = '2026-07';
  const dueDate = new Date('2026-07-15');

  for (const resident of await prisma.resident.findMany()) {
    const bill = await prisma.bill.upsert({
      where: { residentId_period: { residentId: resident.id, period } },
      update: {},
      create: {
        residentId: resident.id,
        period,
        amount: resident.monthlyFees,
        dueDate,
        status: 'ISSUED',
      },
    });

    await prisma.financialTransaction.upsert({
      where: { id: resident.id },
      update: {},
      create: {
        residentId: resident.id,
        trxType: 'BIL',
        drCr: 'D',
        trxAmount: resident.monthlyFees,
        notes: `فاتورة صيانة ${period}`,
        posted: 'Y',
        billId: bill.id,
      },
    }).catch(() => {
      // skip if transaction already exists
    });
  }

  const ahmedUser = await prisma.user.findUnique({ where: { email: 'ahmed@example.com' } });
  if (ahmedUser && ahmed) {
    await prisma.notification.create({
      data: {
        userId: ahmedUser.id,
        residentId: ahmed.id,
        type: 'BILL_ISSUED',
        title: 'فاتورة صيانة جديدة',
        message: `تم إصدار فاتورة ${period} بمبلغ ${ahmed.monthlyFees} جنيه`,
      },
    });
  }

  console.log('Seed completed successfully');
  console.log('Login credentials:');
  console.log('  Superadmin: superadmin@compound.com / superadmin123');
  console.log('  Admin:      admin@compound.com / admin123');
  console.log('  Accountant: accountant@compound.com / accountant123');
  console.log('  Owner:      ahmed@example.com / 123456');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
