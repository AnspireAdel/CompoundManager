import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  children,
  className,
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-center justify-between gap-3', className)}>
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function FormRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
}

export function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 space-y-2', className)}>
      <label className="text-sm font-medium leading-none">{label}</label>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="py-10 text-center text-muted-foreground">{children}</div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ISSUED: { label: 'مستحقة', className: 'bg-sky-100 text-sky-800' },
    DUE: { label: 'مستحقة', className: 'bg-sky-100 text-sky-800' },
    PAID: { label: 'مدفوعة', className: 'bg-emerald-100 text-emerald-800' },
    OVERDUE: { label: 'متأخرة', className: 'bg-red-100 text-red-800' },
    PARTIAL: { label: 'جزئية', className: 'bg-violet-100 text-violet-800' },
    DRAFT: { label: 'مسودة', className: 'bg-slate-100 text-slate-700' },
    PENDING_REVIEW: { label: 'بانتظار المراجعة', className: 'bg-amber-100 text-amber-800' },
    PENDING: { label: 'جديد', className: 'bg-amber-100 text-amber-800' },
    IN_PROGRESS: { label: 'قيد المعالجة', className: 'bg-sky-100 text-sky-800' },
    RESOLVED: { label: 'تم الحل', className: 'bg-emerald-100 text-emerald-800' },
    CLOSED: { label: 'مغلق', className: 'bg-slate-100 text-slate-700' },
    APPROVED: { label: 'مقبول', className: 'bg-emerald-100 text-emerald-800' },
    REJECTED: { label: 'مرفوض', className: 'bg-red-100 text-red-800' },
  };
  const item = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold', item.className)}>
      {item.label}
    </span>
  );
}
