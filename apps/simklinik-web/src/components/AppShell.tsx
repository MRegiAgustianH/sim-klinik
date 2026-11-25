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
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth, Permission } from '@/lib/auth-context';

// Tampilan sidebar disamakan dengan Sistem Surat (apps/surat-laporan/web/
// src/components/AppShell.tsx): menu ringkas, grup "Pengelolaan", profil dan
// tombol keluar di bawah, serta bisa diciutkan menjadi ikon saja.

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  // Menu disembunyikan bila pengguna tidak punya fitur ini (diatur di portal).
  permission?: Permission;
  superadminOnly?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Data Pasien & Vaksinasi', href: '/patients', icon: Users },
  { name: 'Stok Vaksin & Buku ICV', href: '/stock', icon: Package },
  { name: 'Hasil MCU Dokter', href: '/mcu', icon: Stethoscope },
  { name: 'Laporan & Export', href: '/reports', icon: FileSpreadsheet, permission: 'laporan.ekspor' },
];

const MANAGE_NAV: NavItem[] = [{ name: 'Kelola Pengguna', href: '/users', icon: UserCog, superadminOnly: true }];

const COLLAPSE_KEY = 'simklinik_sidebar_collapsed';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, can } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // penyimpanan browser tidak tersedia
    }
  }, []);

  // Proteksi auth rute
  useEffect(() => {
    if (!isLoading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, isLoading, pathname, router]);

  useEffect(() => setMobileMenuOpen(false), [pathname]);

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

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      // abaikan
    }
  };

  const visible = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.superadminOnly) return Boolean(user?.isSuperadmin);
      return item.permission ? can(item.permission) : true;
    });
  const manageItems = visible(MANAGE_NAV);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const nav = (mini: boolean) => (
    <>
      <div className={`h-14 flex items-center gap-2.5 border-b border-slate-200 shrink-0 ${mini ? 'justify-center px-2' : 'px-4'}`}>
        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shadow-sm shrink-0">
          <Syringe className="w-[18px] h-[18px] text-white" />
        </div>
        {!mini && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 leading-tight">SIMKlinik</p>
            <p className="text-[10.5px] text-slate-500 truncate">Klinik Dr. H. A. Rotinsulu</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visible(MAIN_NAV).map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} mini={mini} />
        ))}
        {manageItems.length > 0 && (
          <>
            {!mini ? (
              <p className="px-3 pt-4 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Pengelolaan</p>
            ) : (
              <div className="my-2 mx-3 border-t border-slate-200" />
            )}
            {manageItems.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} mini={mini} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-slate-200 p-2 space-y-1 shrink-0">
        {!mini && (
          <Link href="/profile" className="block px-3 py-2 rounded-lg hover:bg-slate-50" title="Profil">
            <p className="text-sm font-semibold text-slate-900 truncate">{user?.fullName}</p>
            <p className="text-[11px] text-slate-500">{user?.isSuperadmin ? 'Superadmin' : user?.role} · Profil</p>
          </Link>
        )}
        <PortalLink mini={mini} />
        <button
          onClick={logout}
          title="Keluar"
          className={`w-full flex items-center gap-2.5 rounded-lg text-sm font-medium text-rose-700 hover:bg-rose-50 h-9 ${mini ? 'justify-center' : 'px-3'}`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!mini && 'Keluar'}
        </button>
      </div>
    </>
  );

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
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      {/* SIDEBAR DESKTOP */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200 shrink-0 sticky top-0 h-screen transition-[width] duration-150 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {nav(collapsed)}
        <button
          onClick={toggleCollapsed}
          className="h-9 border-t border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50"
          title={collapsed ? 'Lebarkan menu' : 'Ciutkan menu'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-64 bg-white flex flex-col">{nav(false)}</aside>
          <button
            className="relative m-3 h-9 w-9 rounded-full bg-white flex items-center justify-center"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KONTEN UTAMA */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
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

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ item, active, mini }: { item: NavItem; active: boolean; mini: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.name}
      className={`flex items-center gap-2.5 rounded-lg text-sm font-medium h-9 transition-colors ${mini ? 'justify-center' : 'px-3'} ${
        active ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-teal-700'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!mini && <span className="truncate">{item.name}</span>}
    </Link>
  );
}

// Tautan kembali ke portal. Alamatnya diminta ke server, yang menyusunnya
// dari alamat yang dipakai browser ini, sehingga benar juga bagi staf di
// komputer lain (bukan 127.0.0.1 milik server).
function PortalLink({ mini }: { mini: boolean }) {
  const portalUrl = usePortalUrl();

  if (!portalUrl) return null;

  return (
    <a
      href={portalUrl}
      title="Kembali ke Portal SIMKlinik"
      className={`w-full flex items-center gap-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 h-9 ${mini ? 'justify-center' : 'px-3'}`}
    >
      <LayoutGrid className="w-4 h-4 shrink-0" />
      {!mini && 'Portal SIMKlinik'}
    </a>
  );
}

export function usePortalUrl(): string | null {
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/portal-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { portalUrl?: string } | null) => {
        if (!cancelled && body?.portalUrl) setPortalUrl(body.portalUrl);
      })
      .catch(() => {
        // Tanpa alamat portal, tombolnya cukup tidak ditampilkan.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return portalUrl;
}
