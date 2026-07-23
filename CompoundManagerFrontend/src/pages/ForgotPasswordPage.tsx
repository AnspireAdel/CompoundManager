import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await api.forgotPassword(email);
      setMessage(result.message);
      if (result.resetToken) {
        setToken(result.resetToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل الطلب');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">نسيت كلمة المرور</CardTitle>
          <CardDescription>أدخل بريدك للحصول على رمز إعادة التعيين</CardDescription>
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'جاري الإرسال...' : 'إرسال الرمز'}
            </Button>
          </form>
          {token && (
            <Card className="mt-4">
              <CardContent className="space-y-4 pt-6">
                <p className="text-sm text-muted-foreground">رمز إعادة التعيين:</p>
                <code className="block break-all rounded-md bg-muted px-3 py-2 text-sm">{token}</code>
                <Button
                  className="w-full"
                  onClick={() =>
                    navigate(
                      `/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`
                    )
                  }
                >
                  متابعة لتعيين كلمة مرور جديدة
                </Button>
              </CardContent>
            </Card>
          )}
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
