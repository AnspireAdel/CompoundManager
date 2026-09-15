import 'dotenv/config';
import { createPrismaClient } from '../src/lib/createPrismaClient';

const prisma = createPrismaClient();

async function main() {
  console.log('Seeding test payment proofs...');

  // 1. Ensure an accountant/admin user exists to attach to or review
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPERADMIN', 'ADMIN', 'ACCOUNTANT'] } },
  });

  const testResidentsData = [
    {
      name: 'عمرو المهدي',
      amount: 200,
      billCode: 'EXTRA-23654876',
      area: '1',
      bld: '10',
      apt: '101',
      fileName: 'receipt_bank_transfer.jpg',
      filePath: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=900',
      fileMime: 'image/jpeg',
      notes: 'إشعار تحويل بنكي فوري لحساب الصيانة',
    },
    {
      name: 'احمد ناجي ثروت',
      amount: 300,
      billCode: 'EXTRA-23654877',
      area: '1',
      bld: '11',
      apt: '102',
      fileName: 'Haddaj Privacy Policy.pdf',
      filePath: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileMime: 'application/pdf',
      notes: 'مرفق مستند إثبات السداد بصيغة PDF',
    },
    {
      name: 'نادي 16',
      amount: 220000,
      billCode: 'EXTRA-23654878',
      area: '2',
      bld: '16',
      apt: 'CLUB',
      fileName: 'bank_deposit_slip.png',
      filePath: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=900',
      fileMime: 'image/png',
      notes: 'إيداع نقدي بفرع البنك الأهلي المصري',
    },
    {
      name: 'احمد ندا',
      amount: 500,
      billCode: 'EXTRA-23654879',
      area: '2',
      bld: '20',
      apt: '201',
      fileName: 'payment_receipt.pdf',
      filePath: 'https://pdfobject.com/pdf/sample.pdf',
      fileMime: 'application/pdf',
      notes: 'سداد رسوم الخدمات الإضافية لشهر 9',
    },
    {
      name: 'عمرو فايد',
      amount: 500,
      billCode: 'EXTRA-23654880',
      area: '2',
      bld: '21',
      apt: '202',
      fileName: 'instapay_confirmation.jpg',
      filePath: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=900',
      fileMime: 'image/jpeg',
      notes: 'تحويل عن طريق إنستاباي InstaPay',
    },
    {
      name: 'د جمال حسن',
      amount: 500,
      billCode: 'EXTRA-23654881',
      area: '3',
      bld: '30',
      apt: '301',
      fileName: 'maintenance_invoice.pdf',
      filePath: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileMime: 'application/pdf',
      notes: 'فاتورة سداد إلكتروني معتمدة',
    },
    {
      name: 'ناجي عبدالخالق ثروت',
      amount: 500,
      billCode: 'EXTRA-23654882',
      area: '3',
      bld: '31',
      apt: '302',
      fileName: 'bank_transfer_receipt.jpg',
      filePath: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=900',
      fileMime: 'image/jpeg',
      notes: 'إيصال سداد إلكتروني عبر تطبيق البنك',
    },
  ];

  for (let i = 0; i < testResidentsData.length; i++) {
    const item = testResidentsData[i];

    // Find or create resident
    let resident = await prisma.resident.findFirst({
      where: { residentName: item.name },
    });

    if (!resident) {
      resident = await prisma.resident.create({
        data: {
          residentName: item.name,
          area: item.area,
          buildingNo: item.bld,
          floorNo: 1,
          apartmentNo: item.apt,
          mobile: `0100002211${i}`,
          monthlyFees: item.amount,
          residentType: 'O',
        },
      });
    }

    // Find or create user for resident
    let user = await prisma.user.findFirst({
      where: { residentId: resident.id },
    });

    if (!user) {
      const email = `resident${resident.id}@compound.com`;
      user = await prisma.user.upsert({
        where: { email },
        update: { residentId: resident.id },
        create: {
          username: `user_${resident.id}`,
          email,
          password: 'hashed_password_dummy',
          name: resident.residentName,
          role: 'OWNER',
          status: 'APPROVED',
          residentId: resident.id,
        },
      });
    }

    // Find or create bill
    let bill = await prisma.bill.findFirst({
      where: { residentId: resident.id, period: item.billCode },
    });

    if (!bill) {
      bill = await prisma.bill.create({
        data: {
          residentId: resident.id,
          period: item.billCode,
          amount: item.amount,
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          status: 'PENDING_REVIEW',
          billType: 'EXTRA',
          title: 'دفعة صيانة استثنائية',
        },
      });
    } else {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { status: 'PENDING_REVIEW' },
      });
    }

    // Remove any existing proof for this bill to avoid duplicate clutter
    await prisma.paymentProof.deleteMany({
      where: { billId: bill.id },
    });

    // Create Payment Proof
    const proof = await prisma.paymentProof.create({
      data: {
        billId: bill.id,
        residentId: resident.id,
        userId: user.id,
        amount: item.amount,
        fileName: item.fileName,
        filePath: item.filePath,
        fileMime: item.fileMime,
        status: 'PENDING',
        notes: item.notes,
      },
    });

    console.log(`Created payment proof #${proof.id} for ${resident.residentName} (${item.amount} EGP)`);
  }

  console.log('Payment proofs successfully seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
