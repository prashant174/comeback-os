import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshAccessToken, setAccessToken, setOnAuthLost } from '@/lib/api';
import { authApi } from '@/services/auth.service';
import type { User } from '@/types';

type AuthState = {
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const qc = useQueryClient();

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
    qc.clear();
  }, [qc]);

  // Restore session from the refresh cookie on first load.
  useEffect(() => {
    setOnAuthLost(clearSession);
    let cancelled = false;
    (async () => {
      const token = await refreshAccessToken();
      if (cancelled) return;
      if (!token) return setStatus('anonymous');
      try {
        setUser(await authApi.me());
        setStatus('authenticated');
      } catch {
        clearSession();
      }
    })();
    return () => { cancelled = true; };
  }, [clearSession]);

  const value = useMemo<AuthState>(() => ({
    user,
    status,
    setUser,
    clearSession,
    login: async (email, password) => {
      const s = await authApi.login({ email, password });
      setAccessToken(s.accessToken);
      setUser(s.user);
      setStatus('authenticated');
    },
    register: async (name, email, password) => {
      const s = await authApi.register({ name, email, password });
      setAccessToken(s.accessToken);
      setUser(s.user);
      setStatus('authenticated');
    },
    logout: async () => {
      try { await authApi.logout(); } finally { clearSession(); }
    },
  }), [user, status, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
