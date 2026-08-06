import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { api, User } from '@/api/client';
import { getToken, setToken, removeToken } from '@/lib/storage';

const MOBILE_ALLOWED_ROLES = new Set(['OWNER', 'DEPENDENT']);

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function assertMobileUser(user: User) {
  if (!MOBILE_ALLOWED_ROLES.has(user.role)) {
    throw new Error('تطبيق الموبايل للملاك والتابعين فقط. المدير والمحاسب يستخدمان نسخة الويب');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      return null;
    }
    const me = await api.getMe();
    assertMobileUser(me);
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refreshUser();
      } catch {
        await removeToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshUser]);

  // Re-fetch profile when app returns to foreground (admin may have updated owner data)
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      getToken().then((token) => {
        if (!token) return;
        refreshUser().catch(() => {});
      });
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refreshUser]);

  async function login(username: string, password: string) {
    const { token, user: u } = await api.login(username, password);
    try {
      assertMobileUser(u);
    } catch (err) {
      await removeToken();
      throw err;
    }
    await setToken(token);
    // Login payload omits resident details — load full profile
    try {
      const me = await refreshUser();
      return me || u;
    } catch {
      setUser(u);
      return u;
    }
  }

  async function logout() {
    await removeToken();
    setUser(null);
  }

  function updateUser(u: User) {
    setUser(u);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
