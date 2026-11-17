'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import AppCard from '@/components/AppCard';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { requestHandoff } from '@/lib/sso';
import { AppEntry, AppHealth } from '@/lib/types';
import { RefreshCw, Loader2, LayoutGrid } from 'lucide-react';

// Status app diperiksa dari layanan identitas, bukan dari browser, agar
// CORS dan alamat LAN tidak perlu diatur ulang di setiap aplikasi.
const HEALTH_REFRESH_MS = 60_000;

export default function HomePage() {
  const { token, user } = useAuth();
  const { success, error: toastError } = useToast();

  const [apps, setApps] = useState<AppEntry[]>([]);
  const [health, setHealth] = useState<Record<string, AppHealth>>({});
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openingCode, setOpeningCode] = useState<string | null>(null);

  const loadHealth = useCallback(
    async (showSpinner = false) => {
      if (!token) return;
      if (showSpinner) setIsRefreshing(true);
      try {
        const res = await apiFetch<{ data: AppHealth[] }>('/api/apps/health', { token });
        setHealth(Object.fromEntries(res.data.map((item) => [item.code, item])));
      } catch {
        // Status app bersifat informasi; kegagalan memeriksa tidak boleh
        // menutupi daftar aplikasi yang memang berhak dibuka.
      } finally {
        if (showSpinner) setIsRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch<{ data: AppEntry[] }>('/api/apps', { token });
        if (!cancelled) setApps(res.data);
      } catch (err) {
        if (!cancelled) {
          toastError(err instanceof Error ? err.message : 'Gagal memuat daftar aplikasi.');
        }
      } finally {
        if (!cancelled) setIsLoadingApps(false);
      }
      await loadHealth();
    })();

    const timer = setInterval(() => loadHealth(), HEALTH_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, loadHealth, toastError]);

  const handleOpen = async (app: AppEntry) => {
    if (!token || !app.frontendUrl) return;
    setOpeningCode(app.code);

    // Tab dibuka di sini, masih di dalam klik pengguna. Bila window.open
    // dipanggil setelah await, browser menganggapnya bukan tindakan pengguna
    // dan memblokirnya sebagai popup — tab tidak akan terbuka sama sekali.
    const tab = window.open('', '_blank');

    if (!tab) {
      // Popup diblokir. Berhenti di sini: kalau diteruskan, tiket tetap dibuat
      // lalu terbuang sia-sia, dan pesan "Membuka…" muncul padahal tidak ada
      // tab yang terbuka.
      setOpeningCode(null);
      toastError(
        'Tab baru diblokir peramban. Izinkan popup untuk alamat portal ini, lalu tekan tombol sekali lagi.'
      );
      return;
    }

    try {
      const { redirectUrl, appName } = await requestHandoff(app.code, token);
      success(`Membuka ${appName} di tab baru…`);
      tab.location.replace(redirectUrl);
    } catch (err) {
      // Tab kosong yang sudah terbuka harus ditutup, jika tidak staf
      // meninggalkan tab blank tanpa penjelasan.
      tab.close();
      toastError(err instanceof Error ? err.message : 'Gagal membuka aplikasi.');
    } finally {
      setOpeningCode(null);
    }
  };

  const appsAktif = Object.values(health).filter((item) => item.status === 'aktif').length;

  return (
    <PortalShell
      title={`Selamat bertugas, ${user?.fullName ?? ''}`}
      subtitle="Pilih aplikasi yang ingin Anda buka. Satu login berlaku untuk semua aplikasi."
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-sm text-slate-600">
          {!isLoadingApps && (
            <span>
              <span className="font-semibold text-slate-900">{apps.length}</span> aplikasi dapat Anda akses
              {Object.keys(health).length > 0 && (
                <>
                  {' · '}
                  <span className="font-semibold text-emerald-700">{appsAktif}</span> sedang aktif
                </>
              )}
            </span>
          )}
        </div>
        <button
          onClick={() => loadHealth(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Periksa status
        </button>
      </div>

      {isLoadingApps ? (
        <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-portal-600" />
          <span className="text-sm font-medium">Memuat aplikasi…</span>
        </div>
      ) : apps.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl py-14 px-6 text-center">
          <LayoutGrid className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Belum ada aplikasi yang dapat Anda akses</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Hubungi Superadministrator untuk memberikan akses aplikasi pada akun Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {apps.map((app) => (
            <AppCard
              key={app.code}
              app={app}
              health={health[app.code]}
              onOpen={handleOpen}
              isOpening={openingCode === app.code}
            />
          ))}
        </div>
      )}
    </PortalShell>
  );
}
