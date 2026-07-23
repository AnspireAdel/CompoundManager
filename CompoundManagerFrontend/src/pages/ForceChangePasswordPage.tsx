import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import PasswordInput from '@/components/PasswordInput';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function ForceChangePasswordPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    try {
      await api.changePassword(undefined, newPassword);
      if (user) {
        updateUser({ ...user, mustChangePassword: false });
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">تغيير كلمة المرور مطلوب</CardTitle>
          <CardDescription>
            تم إنشاء حسابك بكلمة مرور مؤقتة. عيّن كلمة مرور جديدة للمتابعة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              {error}
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'جاري الحفظ...' : 'حفظ والمتابعة'}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={logout}>
              تسجيل الخروج
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
