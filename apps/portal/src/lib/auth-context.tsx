'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from './api';
import { PortalUser } from './types';

const TOKEN_KEY = 'portal_token';
const USER_KEY = 'portal_user';

interface AuthContextType {
  user: PortalUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** Muat ulang profil dari server, mis. setelah akses app diubah Superadmin. */
  refreshProfile: () => Promise<void>;
  hasRole: (...roles: PortalUser['role'][]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
    router.push('/login');
  }, [router]);

  // Token 12 jam bisa kedaluwarsa atau akun dinonaktifkan selagi portal
  // terbuka. Saat itu terjadi, sesi lokal harus dibuang — bukan dibiarkan
  // tampil seolah masih login.
  const refreshProfile = useCallback(async () => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) return;
    try {
      const profile = await apiFetch<PortalUser>('/api/auth/profile', { token: savedToken });
      const next: PortalUser = {
        id: profile.id,
        username: profile.username,
        fullName: profile.fullName,
        role: profile.role,
        apps: profile.apps ?? [],
      };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      setUser(next);
      setToken(savedToken);
    } catch {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        logout();
        return;
      }
      // Profil disegarkan di latar; kegagalan sudah ditangani di refreshProfile.
      refreshProfile().finally(() => setIsLoading(false));
      return;
    }

    setIsLoading(false);
  }, [logout, refreshProfile]);

  const login = async (username: string, password: string): Promise<void> => {
    const res = await apiFetch<{
      message: string;
      accessToken: string;
      user: PortalUser;
    }>('/api/auth/login', {
      method: 'POST',
      // audience 'portal' eksplisit: token ini hanya berlaku untuk dashboard,
      // bukan untuk aplikasi pelayanan.
      body: JSON.stringify({ username, password, audience: 'portal' }),
    });

    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setToken(res.accessToken);
    setUser(res.user);
    router.push('/');
  };

  const hasRole = (...roles: PortalUser['role'][]): boolean => {
    if (!user) return false;
    if (user.role === 'Superadmin') return true;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshProfile, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
