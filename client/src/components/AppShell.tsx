'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Package,
  FileSpreadsheet,
  UserCog,
  LogOut,
  Menu,
  X,
  Syringe,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ('Superadmin' | 'Dokter' | 'Perawat')[];
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Data Pasien & Vaksinasi',
    href: '/patients',
    icon: Users,
  },
  {
    name: 'Stok Vaksin & Buku ICV',
    href: '/stock',
    icon: Package,
  },
  {
    name: 'Hasil MCU Dokter',
    href: '/mcu',
    icon: Stethoscope,
  },
  {
    name: 'Laporan & Export',
    href: '/reports',
    icon: FileSpreadsheet,
  },
  {
    name: 'Kelola Pengguna',
    href: '/users',
    icon: UserCog,
    roles: ['Superadmin'],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, hasRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Proteksi auth rute
  useEffect(() => {
    if (!isLoading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <Syringe className="w-10 h-10 text-teal-600 animate-pulse" />
        <p className="text-sm font-medium">Memuat Sistem VaksinKU...</p>
      </div>
    );
  }

  if (!user && pathname !== '/login') {
    return null;
  }

  // Filter menu berdasarkan role
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return hasRole(...item.roles);
  });

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'Superadmin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3 h-3" />
            Superadmin
          </span>
        );
      case 'Dokter':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Stethoscope className="w-3 h-3" />
            Dokter
          </span>
        );
      case 'Perawat':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <HeartPulse className="w-3 h-3" />
            Perawat
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-100/70 text-slate-900">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-900 text-slate-100 border-r border-slate-800 shrink-0">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/60">
          <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center shadow-md shadow-teal-900/30">
            <Syringe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              SIMKlinik
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-teal-950 text-teal-400 border border-teal-800">Rotinsulu</span>
            </h1>
            <p className="text-[10.5px] text-slate-400 font-medium truncate max-w-[170px]">Klinik Dr. H. A. Rotinsulu</p>
          </div>
        </div>
        {/* Profil Singkat di Sidebar */}
        <div className="p-4 mx-3 my-3 rounded-lg bg-slate-800/60 border border-slate-700/50">
          <p className="text-xs text-slate-400">Pengguna Aktif</p>
          <p className="text-sm font-semibold text-white truncate mt-0.5">{user?.fullName}</p>
          <div className="mt-2 flex items-center justify-between">
            {getRoleBadge(user?.role)}
            <Link
              href="/profile"
              className="text-xs text-teal-400 hover:text-teal-300 font-medium underline-offset-2 hover:underline"
            >
              Profil
            </Link>
          </div>
        </div>

        {/* Menu Navigasi */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.name}</span>
                {isActive && <ChevronRight className="w-4 h-4 opacity-70" />}
              </Link>
            );
          })}
        </nav>

        {/* Tombol Logout */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 border border-transparent hover:border-rose-900/50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-72 max-w-[80vw] bg-slate-900 text-white shadow-2xl z-10">
            <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                  <Syringe className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white text-sm">SIMKlinik - Dr. H. A. Rotinsulu</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-white"
                aria-label="Tutup Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-800">
              <p className="text-xs text-slate-400">Login sebagai</p>
              <p className="text-sm font-semibold text-white truncate mt-0.5">{user?.fullName}</p>
              <div className="mt-2">{getRoleBadge(user?.role)}</div>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {visibleNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                      isActive ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-rose-300 hover:bg-rose-950/40"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Sistem</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KONTEN UTAMA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Buka menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Klinik Utama Dr. H. A. Rotinsulu Cianjur</p>
              <h2 className="text-sm font-bold text-slate-800">Sistem Informasi Manajemen Pelayanan Klinik (SIMKlinik)</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-slate-900">{user?.fullName}</p>
              <p className="text-[11px] text-slate-500 font-mono">@{user?.username}</p>
            </div>
            {getRoleBadge(user?.role)}
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
