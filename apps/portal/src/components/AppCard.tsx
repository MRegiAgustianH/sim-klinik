'use client';

import React from 'react';
import {
  Syringe,
  FileText,
  BarChart3,
  LayoutGrid,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { AppEntry, AppHealth, AppHealthStatus } from '@/lib/types';

// Ikon per kode aplikasi, dengan ikon umum sebagai cadangan agar app baru yang
// didaftarkan Superadmin tetap tampil rapi tanpa mengubah kode ini.
const APP_ICONS: Record<string, React.ReactNode> = {
  simklinik: <Syringe className="w-6 h-6" />,
  surat: <FileText className="w-6 h-6" />,
  laporan: <BarChart3 className="w-6 h-6" />,
};

const STATUS_STYLE: Record<AppHealthStatus, { dot: string; text: string; label: string }> = {
  aktif: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Aktif' },
  'tidak aktif': { dot: 'bg-rose-500', text: 'text-rose-700', label: 'Bermasalah' },
  'tidak dapat dihubungi': { dot: 'bg-slate-400', text: 'text-slate-500', label: 'Tidak dapat dihubungi' },
  'url belum diisi': { dot: 'bg-amber-500', text: 'text-amber-700', label: 'URL belum diisi' },
};

export default function AppCard({
  app,
  health,
  onOpen,
  isOpening,
}: {
  app: AppEntry;
  health?: AppHealth;
  onOpen: (app: AppEntry) => void;
  isOpening: boolean;
}) {
  // Selagi status diperiksa, kartu tidak mengklaim apa pun.
  const status: AppHealthStatus | null = health ? health.status : null;
  const style = status ? STATUS_STYLE[status] : null;
  // Aplikasi tanpa URL depan memang belum bisa dibuka (mis. modul yang belum
  // dibuat), jadi tombolnya dimatikan alih-alih menampilkan halaman kosong.
  const canOpen = Boolean(app.frontendUrl) && app.isActive === 1;
  // Peringatan hanya muncul untuk aplikasi yang seharusnya bisa dibuka tetapi
  // layanannya belum merespons — bukan untuk modul yang memang belum dibuat.
  const isDown = canOpen && status !== null && status !== 'aktif';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="p-5 flex-1">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-portal-50 text-portal-700 flex items-center justify-center shrink-0">
            {APP_ICONS[app.code] ?? <LayoutGrid className="w-6 h-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 leading-tight">{app.name}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              {style ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} aria-hidden="true" />
                  <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
                  {health?.latencyMs !== null && health?.latencyMs !== undefined && status === 'aktif' && (
                    <span className="text-xs text-slate-400">· {health.latencyMs} ms</span>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-400">Memeriksa status…</span>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-600 mt-3 leading-snug">
          {app.description || 'Belum ada keterangan untuk aplikasi ini.'}
        </p>

        {isDown && (
          <div className="mt-3 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Aplikasi belum merespons. Pastikan layanannya sedang berjalan sebelum membuka — bila
              dibuka sekarang, halaman akan gagal dimuat.
            </span>
          </div>
        )}
      </div>

      <div className="px-5 pb-5 pt-0">
        <button
          onClick={() => onOpen(app)}
          disabled={!canOpen || isOpening}
          title={canOpen ? 'Buka di tab baru' : undefined}
          aria-label={canOpen ? `Buka ${app.name} di tab baru` : undefined}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-portal-600 text-white hover:bg-portal-700"
        >
          {isOpening ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          {isOpening ? 'Membuka…' : canOpen ? 'Buka Aplikasi' : 'Belum tersedia'}
        </button>
      </div>
    </div>
  );
}
