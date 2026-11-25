'use client';

import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, TOKEN_KEY, USER_KEY } from './api';

// Kode fitur harus sama dengan apps/surat-laporan/api/src/auth/permissions.ts.
export type Permission = 'surat.buat' | 'surat.terbitkan' | 'surat.batal' | 'surat.hapus' | 'template.kelola';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isSuperadmin: boolean;
  permissions: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUser(raw: Partial<AuthUser> | null): AuthUser | null {
  if (!raw || typeof raw.id !== 'number') return null;
  return {
    id: raw.id,
    username: raw.username ?? '',
    fullName: raw.fullName ?? '',
    role: raw.role ?? '',
    isSuperadmin: raw.isSuperadmin ?? raw.role === 'Superadmin',
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    router.push('/login');
  }, [router]);

  const saveUser = useCallback((next: AuthUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  // Profil tersimpan ditampilkan dulu, lalu diperbarui dari server: izin bisa
  // saja diubah Superadmin di portal sejak login terakhir.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    let saved: AuthUser | null = null;
    try {
      saved = normalizeUser(JSON.parse(localStorage.getItem(USER_KEY) || 'null'));
    } catch {
      saved = null;
    }
    if (saved) setUser(saved);

    apiFetch<AuthUser>('/api/auth/profile')
      .then((fresh) => {
        const next = normalizeUser(fresh);
        if (next) saveUser(next);
        else logout();
      })
      .catch((err: unknown) => {
        const status = (err as { status?: number })?.status;
        // Backend yang sedang mati tidak boleh membuat staf ter-logout.
        if (status === 401 || status === 403 || !saved) logout();
      })
      .finally(() => setIsLoading(false));
  }, [logout, saveUser]);

  const login = async (username: string, password: string) => {
    const res = await apiFetch<{ accessToken: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    const next = normalizeUser(res.user);
    if (!next) throw new Error('Profil pengguna tidak lengkap.');
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    saveUser(next);
    router.push('/dashboard');
  };

  const can = useCallback(
    (permission: Permission) => Boolean(user && (user.isSuperadmin || user.permissions.includes(permission))),
    [user]
  );

  return <AuthContext.Provider value={{ user, isLoading, login, logout, can }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
