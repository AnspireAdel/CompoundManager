/**
 * Restore default unit types and assign owner's unit to فيلا.
 * Usage: npx tsx scripts/restore-unit-types.ts
 */
import 'dotenv/config';
import { createPrismaClient } from '../src/lib/createPrismaClient';

const prisma = createPrismaClient();

async function main() {
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
        activeFlag: 'Y',
      },
      create: { ...ut, showOnRegister: true, activeFlag: 'Y' },
    });
  }

  const villa = await prisma.unitType.findUnique({ where: { name: 'فيلا' } });
  if (!villa) throw new Error('فيلا not found');

  const owner = await prisma.user.findUnique({
    where: { email: 'nagy.tharwat@gmail.com' },
  });
  if (!owner?.residentId) throw new Error('owner resident not found');

  const resident = await prisma.resident.update({
    where: { id: owner.residentId },
    data: {
      unitTypeId: villa.id,
      monthlyFees: villa.monthlyFees,
      floorNo: 0,
      apartmentNo: '0',
      area: 'A',
      buildingNo: '01',
    },
    include: { unitType: true },
  });

  const types = await prisma.unitType.findMany({ orderBy: { id: 'asc' } });
  console.log(
    'Unit types:',
    types.map((t) => `${t.name} (${t.monthlyFees})`).join(', ')
  );
  console.log('Owner unit:', {
    name: resident.residentName,
    type: resident.unitType?.name,
    fees: resident.monthlyFees,
    address: `${resident.area}-${resident.buildingNo}`,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
