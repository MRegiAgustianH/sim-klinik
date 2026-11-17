'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutGrid,
  Users,
  ShieldCheck,
  UserCog,
  KeyRound,
  LogOut,
  Menu,
  X,
  Loader2,
  Building2,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  superadminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Beranda', icon: <LayoutGrid className="w-5 h-5" /> },
  { href: '/patients', label: 'Data Pasien', icon: <Users className="w-5 h-5" /> },
  { href: '/apps', label: 'Aplikasi', icon: <ShieldCheck className="w-5 h-5" />, superadminOnly: true },
  { href: '/users', label: 'Pengguna', icon: <UserCog className="w-5 h-5" />, superadminOnly: true },
  { href: '/profile', label: 'Profil Saya', icon: <KeyRound className="w-5 h-5" /> },
];

export default function PortalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { user, logout, isLoading, hasRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Portal tidak boleh menampilkan data apa pun sebelum login. Profil dari
  // localStorage tidak cukup sebagai bukti — AuthProvider memverifikasinya ke
  // layanan identitas, dan selama proses itu berjalan isLoading tetap true.
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // Sidebar mobile ditutup setiap kali pindah halaman.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-portal-600" />
        <p className="text-sm font-medium">Memeriksa sesi…</p>
      </div>
    );
  }

  const visibleNav = NAV_ITEMS.filter((item) => !item.superadminOnly || hasRole('Superadmin'));

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Latar gelap saat sidebar terbuka di layar kecil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-portal-900 text-white flex flex-col transform transition-transform lg:translate-x-0 lg:static lg:shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-brand-500 text-portal-950 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold leading-tight">Portal SIMKlinik</p>
            <p className="text-xs text-portal-200 truncate">Klinik Utama Dr. H. A. Rotinsulu</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-portal-200 hover:text-white p-1 rounded"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-portal-600 text-white' : 'text-portal-100 hover:bg-white/10'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-portal-600 flex items-center justify-center text-sm font-bold shrink-0">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user.fullName}</p>
              <p className="text-xs text-portal-200">{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Konten */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
            aria-label="Buka menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>

        <footer className="px-4 sm:px-6 py-4 text-center text-xs text-slate-400 border-t border-slate-200">
          Portal SIMKlinik — Klinik Utama Dr. H. A. Rotinsulu Cianjur · Akses Jaringan Lokal (LAN)
        </footer>
      </div>
    </div>
  );
}
