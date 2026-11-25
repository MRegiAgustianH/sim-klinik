'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, FileText } from 'lucide-react';
import { apiFetch, PORTAL_URL_KEY, TOKEN_KEY, USER_KEY } from '@/lib/api';

// Halaman penerima SSO dari Portal SIMKlinik: tiket sekali pakai di URL
// (?sso_ticket=...) ditukar menjadi token aplikasi surat lewat server portal.
// useSearchParams() wajib di dalam Suspense agar `next build` membuat route ini.
export default function SsoPage() {
  return (
    <Suspense fallback={<SsoShell />}>
      <SsoHandler />
    </Suspense>
  );
}

function SsoShell({ error }: { error?: string | null }) {
  return (
    <div className="min-h-screen bg-teal-700 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600 text-white mb-4">
          <FileText className="w-7 h-7" />
        </div>
        {error ? (
          <>
            <div className="flex items-start gap-2 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <a href="/login" className="btn-primary w-full mt-5 h-10">
              Masuk manual
            </a>
            <p className="text-xs text-slate-500 mt-3">Tiket hanya berlaku 60 detik dan sekali pakai. Buka ulang aplikasi ini dari Portal SIMKlinik.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-slate-900">Menyiapkan sesi Anda…</h1>
            <p className="text-xs text-slate-500 mt-1">Memverifikasi tiket dari Portal SIMKlinik.</p>
            <div className="flex justify-center mt-5">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SsoHandler() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // Efek berjalan dua kali di mode pengembangan; tiket hanya bisa ditukar sekali.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ticket = params.get('sso_ticket');
    if (!ticket) {
      setError('Tiket login tidak ditemukan pada tautan ini.');
      return;
    }
    apiFetch<{ accessToken: string; user: unknown; portalUrl?: string }>('/api/sso/redeem', {
      method: 'POST',
      body: JSON.stringify({ ticket }),
      token: null,
    })
      .then((res) => {
        localStorage.setItem(TOKEN_KEY, res.accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        if (res.portalUrl) localStorage.setItem(PORTAL_URL_KEY, res.portalUrl);
        // Muat ulang penuh agar AuthProvider membaca sesi baru.
        window.location.replace('/dashboard');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Tidak dapat masuk dari portal.'));
  }, [params]);

  return <SsoShell error={error} />;
}
