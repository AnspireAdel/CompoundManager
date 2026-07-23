import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { Transaction } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/ui-helpers';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    api.getTransactions().then(setTransactions).catch(console.error);
  }, []);

  return (
    <div>
      <PageHeader title="المعاملات المالية" />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الساكن</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>مدين/دائن</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.trxDate).toLocaleDateString('ar-EG')}</TableCell>
                  <TableCell>{t.resident?.residentName}</TableCell>
                  <TableCell>
                    {t.trxType === 'BIL' ? 'فاتورة' : t.trxType === 'PAY' ? 'دفعة' : t.trxType}
                  </TableCell>
                  <TableCell className={t.drCr === 'D' ? 'text-destructive' : 'text-emerald-600'}>
                    {t.drCr === 'D' ? 'مدين' : 'دائن'}
                  </TableCell>
                  <TableCell>{t.trxAmount} ج.م</TableCell>
                  <TableCell>{t.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
