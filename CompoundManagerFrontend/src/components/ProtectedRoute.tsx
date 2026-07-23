import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>جاري التحميل...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  const onForceChange = location.pathname === '/force-change-password';
  if (user.mustChangePassword && !onForceChange) {
    return <Navigate to="/force-change-password" replace />;
  }
  if (!user.mustChangePassword && onForceChange) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
