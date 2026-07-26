import { Eye, EyeOff } from 'lucide-react';
import { useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { normalizePasswordInput } from '@/lib/password';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export default function PasswordInput({ className, onChange, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const normalized = normalizePasswordInput(e.target.value);
    if (normalized === e.target.value) {
      onChange?.(e);
      return;
    }
    const next = {
      ...e,
      target: { ...e.target, value: normalized },
      currentTarget: { ...e.currentTarget, value: normalized },
    } as ChangeEvent<HTMLInputElement>;
    onChange?.(next);
  }

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('ps-10', className)}
        onChange={handleChange}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
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
