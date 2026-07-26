/**
 * Wipe Turso DB and seed only the four requested users.
 * Usage: npx tsx scripts/reset-users.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createPrismaClient } from '../src/lib/createPrismaClient';
import { normalizePassword } from '../src/lib/password';

const prisma = createPrismaClient();

async function wipe() {
  // Children first (FK-safe)
  await prisma.chatMessage.deleteMany();
  await prisma.chatJoinRequest.deleteMany();
  await prisma.chatMember.deleteMany();
  await prisma.chatGroup.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.paymentProof.deleteMany();
  await prisma.contactRequest.deleteMany();
  await prisma.financialTransaction.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.expenseType.deleteMany();
  await prisma.serviceInformation.deleteMany();
  await prisma.serviceType.deleteMany();
  await prisma.dependent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.resident.deleteMany();
  await prisma.unitType.deleteMany();
}

async function main() {
  console.log('Wiping database...');
  await wipe();

  const [saHash, adminHash, accHash, ownerHash] = await Promise.all([
    bcrypt.hash(normalizePassword('sa123'), 10),
    bcrypt.hash(normalizePassword('admin123'), 10),
    bcrypt.hash(normalizePassword('acc123'), 10),
    bcrypt.hash(normalizePassword('123456'), 10),
  ]);

  await prisma.user.create({
    data: {
      email: 'superadmin@gmail.com',
      password: saHash,
      name: 'SuperAdmin',
      role: 'SUPERADMIN',
      status: 'APPROVED',
      mustChangePassword: false,
    },
  });

  await prisma.user.create({
    data: {
      email: 'admin@gmail.com',
      password: adminHash,
      name: 'Admin',
      role: 'ADMIN',
      status: 'APPROVED',
      mustChangePassword: false,
    },
  });

  await prisma.user.create({
    data: {
      email: 'acc@gmail.com',
      password: accHash,
      name: 'Accountant',
      role: 'ACCOUNTANT',
      status: 'APPROVED',
      mustChangePassword: false,
    },
  });

  // Restore default unit types
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
    await prisma.unitType.create({ data: { ...ut, activeFlag: 'Y' } });
  }
  const villa = await prisma.unitType.findUniqueOrThrow({ where: { name: 'فيلا' } });

  // Owner needs a linked unit to use owner features
  const resident = await prisma.resident.create({
    data: {
      area: 'A',
      buildingNo: '01',
      floorNo: 0,
      apartmentNo: '0',
      residentType: 'O',
      residentName: 'ناجي ثروت',
      nationality: 'مصري',
      mobile: '01000000000',
      email: 'nagy.tharwat@gmail.com',
      monthlyFees: villa.monthlyFees,
      unitTypeId: villa.id,
      openingBalance: 0,
    },
  });

  await prisma.user.create({
    data: {
      email: 'nagy.tharwat@gmail.com',
      password: ownerHash,
      name: 'ناجي ثروت',
      role: 'OWNER',
      status: 'APPROVED',
      residentId: resident.id,
      mustChangePassword: false,
    },
  });

  const counts = {
    users: await prisma.user.count(),
    residents: await prisma.resident.count(),
    unitTypes: await prisma.unitType.count(),
    bills: await prisma.bill.count(),
    expenses: await prisma.expense.count(),
    services: await prisma.serviceInformation.count(),
  };

  console.log('Done. Counts:', counts);
  console.log('Logins:');
  console.log('  SuperAdmin  superadmin@gmail.com / sa123');
  console.log('  Admin       admin@gmail.com / admin123');
  console.log('  Accountant  acc@gmail.com / acc123');
  console.log('  Owner       nagy.tharwat@gmail.com / 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
