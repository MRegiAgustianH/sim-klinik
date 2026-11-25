'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FilePlus2,
  Archive,
  LayoutTemplate,
  Heading,
  PenLine,
  Settings2,
  LogOut,
  LayoutGrid,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import { useAuth, Permission } from '@/lib/auth-context';
import { PORTAL_URL_KEY } from '@/lib/api';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const MAIN_NAV: NavItem[] = [
  { name: 'Beranda', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Buat Surat', href: '/surat/baru', icon: FilePlus2, permission: 'surat.buat' },
  { name: 'Arsip Surat', href: '/surat', icon: Archive },
];

const MANAGE_NAV: NavItem[] = [
  { name: 'Template Surat', href: '/template', icon: LayoutTemplate, permission: 'template.kelola' },
  { name: 'Kop Surat', href: '/kop', icon: Heading, permission: 'template.kelola' },
  { name: 'Penandatangan', href: '/penandatangan', icon: PenLine, permission: 'template.kelola' },
  { name: 'Pengaturan', href: '/pengaturan', icon: Settings2, permission: 'template.kelola' },
];

const COLLAPSE_KEY = 'surat_sidebar_collapsed';

interface Props {
  children: React.ReactNode;
  /** Halaman kerja (editor) memakai seluruh tinggi layar tanpa gulir halaman. */
  fullHeight?: boolean;
}

export default function AppShell({ children, fullHeight }: Props) {
  const { user, isLoading, logout, can } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // penyimpanan browser tidak tersedia
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
        <FileText className="w-10 h-10 text-teal-600 animate-pulse" />
        <p className="text-sm font-medium">Memuat Sistem Surat…</p>
      </div>
    );
  }
  if (!user) return null;

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
    } catch {
      // abaikan
    }
  };

  const visible = (items: NavItem[]) => items.filter((i) => !i.permission || can(i.permission));
  const manage = visible(MANAGE_NAV);

  const isActive = (href: string) => {
    if (href === '/surat') return pathname === '/surat' || (/^\/surat\/\d+/.test(pathname));
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const nav = (mini: boolean) => (
    <>
      <div className={`h-14 flex items-center gap-2.5 border-b border-slate-200 shrink-0 ${mini ? 'justify-center px-2' : 'px-4'}`}>
        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shadow-sm shrink-0">
          <FileText className="w-[18px] h-[18px] text-white" />
        </div>
        {!mini && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 leading-tight">Sistem Surat</p>
            <p className="text-[10.5px] text-slate-500 truncate">Klinik Dr. H. A. Rotinsulu</p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visible(MAIN_NAV).map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} mini={mini} />
        ))}
        {manage.length > 0 && (
          <>
            {!mini ? (
              <p className="px-3 pt-4 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">Pengelolaan</p>
            ) : (
              <div className="my-2 mx-3 border-t border-slate-200" />
            )}
            {manage.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} mini={mini} />
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-slate-200 p-2 space-y-1 shrink-0">
        {!mini && (
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.fullName}</p>
            <p className="text-[11px] text-slate-500">{user.isSuperadmin ? 'Superadmin' : user.role}</p>
          </div>
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

  return (
    <div className={`flex bg-slate-100 ${fullHeight ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200 shrink-0 transition-[width] duration-150 ${
          collapsed ? 'w-16' : 'w-60'
        } ${fullHeight ? '' : 'sticky top-0 h-screen'}`}
      >
        {nav(collapsed)}
        <button
          onClick={toggle}
          className="h-9 border-t border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50"
          title={collapsed ? 'Lebarkan menu' : 'Ciutkan menu'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white flex flex-col">{nav(false)}</aside>
          <button className="relative m-3 h-9 w-9 rounded-full bg-white flex items-center justify-center" onClick={() => setMobileOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="lg:hidden h-12 bg-white border-b border-slate-200 flex items-center px-3 gap-2 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded hover:bg-slate-100">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Sistem Surat</span>
        </div>
        <main className={`flex-1 min-h-0 ${fullHeight ? 'overflow-hidden' : ''}`}>{children}</main>
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

// Alamat portal disimpan saat masuk lewat SSO; staf yang login langsung
// mendapatkannya dari /api/portal-info.
function PortalLink({ mini }: { mini: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem(PORTAL_URL_KEY);
    if (saved) {
      setUrl(saved);
      return;
    }
    fetch('/api/portal-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body?.portalUrl && setUrl(body.portalUrl))
      .catch(() => undefined);
  }, []);
  if (!url) return null;
  return (
    <a
      href={url}
      title="Kembali ke Portal SIMKlinik"
      className={`w-full flex items-center gap-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 h-9 ${mini ? 'justify-center' : 'px-3'}`}
    >
      <LayoutGrid className="w-4 h-4 shrink-0" />
      {!mini && 'Portal SIMKlinik'}
    </a>
  );
}
