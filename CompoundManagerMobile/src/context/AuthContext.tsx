import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { api, User } from '@/api/client';
import { getToken, setToken, removeToken } from '@/lib/storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<User | null>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isAccountant: boolean;
  isOwner: boolean;
  isDependent: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
    await setToken(token);
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

  const isSuperAdmin = user?.role === 'SUPERADMIN';
  const isAdmin = user?.role === 'ADMIN' || isSuperAdmin;
  const isAccountant = user?.role === 'ACCOUNTANT';
  const isOwner = user?.role === 'OWNER';
  const isDependent = user?.role === 'DEPENDENT';
  const isStaff = isAdmin || isAccountant;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        refreshUser,
        isSuperAdmin,
        isAdmin,
        isAccountant,
        isOwner,
        isDependent,
        isStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
