'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from './api';

// Kode fitur harus sama dengan apps/simklinik-api/src/auth/permissions.ts.
export type Permission =
  | 'pasien.tulis'
  | 'pasien.setujui'
  | 'pasien.selesai'
  | 'pasien.hapus'
  | 'registrasi.kelola'
  | 'mcu.tulis'
  | 'mcu.hapus'
  | 'stok.tulis'
  | 'stok.hapus'
  | 'laporan.ekspor';

// Akun dikelola di portal. role adalah jabatan untuk tampilan; yang
// menentukan tombol mana yang muncul adalah permissions.
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
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** true bila pengguna boleh memakai fitur ini (Superadmin selalu boleh). */
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
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const logout = useCallback(() => {
    localStorage.removeItem('vaksinku_token');
    localStorage.removeItem('vaksinku_user');
    setUser(null);
    setToken(null);
    router.push('/login');
  }, [router]);

  const saveUser = useCallback((next: AuthUser) => {
    localStorage.setItem('vaksinku_user', JSON.stringify(next));
    setUser(next);
  }, []);

  // Profil tersimpan ditampilkan dulu agar halaman tidak berkedip, lalu
  // diperbarui dari server: izin bisa saja diubah Superadmin di portal sejak
  // login terakhir, dan sesi lama (sebelum akun dipindah ke portal) ditolak.
  useEffect(() => {
    const savedToken = localStorage.getItem('vaksinku_token');
    const savedUser = localStorage.getItem('vaksinku_user');

    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    let saved: AuthUser | null = null;
    try {
      saved = normalizeUser(savedUser ? JSON.parse(savedUser) : null);
    } catch {
      saved = null;
    }
    setToken(savedToken);
    if (saved) setUser(saved);

    apiFetch<AuthUser>('/api/auth/profile')
      .then((fresh) => {
        const next = normalizeUser(fresh);
        if (next) saveUser(next);
        else logout();
      })
      .catch((err: unknown) => {
        const status = (err as { status?: number })?.status;
        // Hanya sesi yang ditolak yang diakhiri; backend yang sedang mati
        // tidak boleh membuat staf ter-logout.
        if (status === 401 || status === 403 || !saved) logout();
      })
      .finally(() => setIsLoading(false));
  }, [logout, saveUser]);

  const login = async (username: string, password: string): Promise<void> => {
    const res = await apiFetch<{
      message: string;
      accessToken: string;
      user: AuthUser;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    const next = normalizeUser(res.user);
    if (!next) throw new Error('Profil pengguna tidak lengkap.');
    localStorage.setItem('vaksinku_token', res.accessToken);
    setToken(res.accessToken);
    saveUser(next);
    router.push('/dashboard');
  };

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      return user.isSuperadmin || user.permissions.includes(permission);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, can }}>
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
