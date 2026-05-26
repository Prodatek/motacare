'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { BaseUser } from '@motacare/shared-types';
import {
  authApi,
  setAccessToken,
  saveRefreshToken,
  getRefreshToken,
  clearTokens,
  ApiClientError,
} from './api';

// ============================================================
// AUTH CONTEXT
// ============================================================

interface AuthState {
  user: BaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (payload: Parameters<typeof authApi.register>[0]) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
// AUTH PROVIDER
// ============================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // On mount — attempt to restore session from stored refresh token
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const tokens = await authApi.refresh();
      setAccessToken(tokens.accessToken);
      saveRefreshToken(tokens.refreshToken);
      document.cookie = 'mc_session=1; path=/; max-age=604800; SameSite=Lax';

      const user = await authApi.me();
      setState({ user, isLoading: false, isAuthenticated: true });
    } catch {
      clearTokens();
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setAccessToken(result.tokens.accessToken);
    saveRefreshToken(result.tokens.refreshToken);
    setState({ user: result.user, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (payload: Parameters<typeof authApi.register>[0]) => {
    const result = await authApi.register(payload);
    setAccessToken(result.tokens.accessToken);
    saveRefreshToken(result.tokens.refreshToken);
    setState({ user: result.user, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try { await authApi.logout(refreshToken); } catch { /* best effort */ }
    }
    clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// HOOKS
// ============================================================

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useRequireAuth() {
  const auth = useAuth();
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      window.location.href = '/login';
    }
  }, [auth.isLoading, auth.isAuthenticated]);
  return auth;
}