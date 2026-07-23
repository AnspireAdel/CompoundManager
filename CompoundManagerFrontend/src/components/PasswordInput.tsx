import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export default function PasswordInput({ className, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('ps-10', className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute start-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        tabIndex={-1}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}
