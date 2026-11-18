'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from './api';

export type UserRole = 'Superadmin' | 'Dokter' | 'Perawat';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  // Load user from storage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('vaksinku_token');
    const savedUser = localStorage.getItem('vaksinku_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        logout();
      }
    }
    setIsLoading(false);
  }, [logout]);

  const login = async (username: string, password: string): Promise<void> => {
    const res = await apiFetch<{
      message: string;
      accessToken: string;
      user: AuthUser;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    localStorage.setItem('vaksinku_token', res.accessToken);
    localStorage.setItem('vaksinku_user', JSON.stringify(res.user));
    setToken(res.accessToken);
    setUser(res.user);
    router.push('/dashboard');
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'Superadmin') return true;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, hasRole }}>
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
