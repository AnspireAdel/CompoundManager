import { useEffect, useState } from 'react';
import { api, uploadsUrl } from '@/api/client';
import type { PaymentProof } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, EmptyState } from '@/components/ui-helpers';

const statusLabel: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

const statusVariant: Record<string, 'warning' | 'success' | 'destructive'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
};

export default function PaymentsPage() {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);

  function load() {
    api.getPayments({ status: 'PENDING' }).then(setProofs).catch(console.error);
  }

  useEffect(() => { load(); }, []);

  async function approve(id: number) {
    await api.approvePayment(id);
    load();
  }

  async function reject(id: number) {
    const reason = prompt('سبب الرفض؟') || 'المستند غير صالح';
    await api.rejectPayment(id, reason);
    load();
  }

  return (
    <div>
      <PageHeader title="مراجعة مستندات الدفع" />

      <Card>
        <CardContent className="pt-6">
          {proofs.length === 0 ? (
            <EmptyState>لا توجد مستندات بانتظار المراجعة</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الساكن</TableHead>
                  <TableHead>الفاتورة</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الملف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {proofs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.resident?.residentName}</TableCell>
                    <TableCell>{p.bill?.period || `#${p.billId}`}</TableCell>
                    <TableCell>{p.amount} ج.م</TableCell>
                    <TableCell>
                      <a
                        href={uploadsUrl(p.filePath)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {p.fileName}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status] || 'muted'}>
                        {statusLabel[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="success" onClick={() => approve(p.id)}>
                          اعتماد
                        </Button>
                        <Button variant="destructive" onClick={() => reject(p.id)}>
                          رفض
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
