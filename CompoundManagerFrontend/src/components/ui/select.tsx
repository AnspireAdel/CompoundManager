import * as React from 'react';
import { cn } from '@/lib/utils';

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, children, ...props }, ref) => (
    <select
      className={cn(
        'flex h-10 w-full appearance-none rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted bg-[length:12px_8px] bg-[left_0.75rem_center] bg-no-repeat pe-3 ps-8',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2364748b' d='M1.4 0.6L6 5.2 10.6.6 12 2 6 8 0 2z'/%3E%3C/svg%3E\")]",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

export { Select };
