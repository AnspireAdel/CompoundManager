import { prisma } from '../lib/prisma';
import { notifyResident } from './notificationService';

export async function getResidentBalance(residentId: number): Promise<number> {
  const resident = await prisma.resident.findUnique({ where: { id: residentId } });
  if (!resident) return 0;

  const transactions = await prisma.financialTransaction.findMany({
    where: { residentId, posted: 'Y' },
  });

  let balance = resident.openingBalance;
  for (const trx of transactions) {
    if (trx.drCr === 'D') balance += trx.trxAmount;
    else balance -= trx.trxAmount;
  }
  return balance;
}

export async function issueMonthlyBills(period: string, dueDate: Date) {
  const residents = await prisma.resident.findMany({ where: { residentType: 'O' } });
  const results = [];

  for (const resident of residents) {
    const existing = await prisma.bill.findUnique({
      where: { residentId_period: { residentId: resident.id, period } },
    });
    if (existing) continue;

    const bill = await prisma.bill.create({
      data: {
        residentId: resident.id,
        period,
        amount: resident.monthlyFees,
        dueDate,
        status: 'ISSUED',
        billType: 'MONTHLY',
        title: `صيانة ${period}`,
      },
    });

    await prisma.financialTransaction.create({
      data: {
        residentId: resident.id,
        trxType: 'BIL',
        drCr: 'D',
        trxAmount: resident.monthlyFees,
        notes: `فاتورة صيانة ${period}`,
        posted: 'Y',
        billId: bill.id,
      },
    });

    await notifyResident(
      resident.id,
      'BILL_ISSUED',
      'فاتورة صيانة جديدة',
      `تم إصدار فاتورة ${period} بمبلغ ${resident.monthlyFees} جنيه`
    );

    results.push(bill);
  }

  return results;
}

export async function recordPayment(
  residentId: number,
  amount: number,
  billId?: number,
  notes?: string
) {
  const trx = await prisma.financialTransaction.create({
    data: {
      residentId,
      trxType: 'PAY',
      drCr: 'C',
      trxAmount: amount,
      notes: notes || 'دفعة صيانة',
      posted: 'Y',
      billId,
    },
  });

  if (billId) {
    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (bill) {
      const paidAmount = bill.paidAmount + amount;
      const status = paidAmount >= bill.amount ? 'PAID' : 'PARTIAL';
      await prisma.bill.update({
        where: { id: billId },
        data: {
          paidAmount,
          status,
          paidAt: status === 'PAID' ? new Date() : bill.paidAt,
        },
      });
    }
  }

  await notifyResident(
    residentId,
    'PAYMENT_RECEIVED',
    'تم استلام الدفعة',
    `تم تسجيل دفعة بمبلغ ${amount} جنيه`
  );

  return trx;
}
