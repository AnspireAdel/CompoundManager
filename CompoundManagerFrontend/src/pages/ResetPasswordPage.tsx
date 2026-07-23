import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import PasswordInput from '@/components/PasswordInput';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') || '');
  const [token, setToken] = useState(params.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    try {
      const result = await api.resetPassword(email, token, newPassword);
      setMessage(result.message);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إعادة التعيين');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">تعيين كلمة مرور جديدة</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              {error}
            </Alert>
          )}
          {message && (
            <Alert variant="success" className="mb-4">
              {message}
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">رمز إعادة التعيين</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
            </Button>
          </form>
          <div className="mt-5 text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              العودة لتسجيل الدخول
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
