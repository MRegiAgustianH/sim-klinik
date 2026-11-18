'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, Syringe } from 'lucide-react';
import { apiFetch } from '@/lib/api';

// Halaman penerima SSO dari Portal SIMKlinik.
//
// Portal mengalihkan staf ke halaman ini dengan tiket sekali pakai di URL
// (?sso_ticket=...). Tiket ditukar menjadi token aplikasi oleh server portal,
// lalu token disimpan seperti hasil login biasa — sehingga seluruh aplikasi
// tidak perlu tahu apa pun tentang SSO selain halaman ini.
//
// useSearchParams() wajib berada di dalam Suspense: tanpa itu `next build`
// menolak membuat halaman ini, dan hasilnya route /sso tidak ada sama sekali
// (browser menerima 404 walaupun berkasnya benar).
export default function SsoPage() {
  return (
    <Suspense fallback={<SsoShell />}>
      <SsoHandler />
    </Suspense>
  );
}

function SsoShell({ error }: { error?: string | null }) {
  return (
    <div className="min-h-screen bg-teal-700 flex flex-col justify-center items-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600 text-white mb-4">
          <Syringe className="w-8 h-8" />
        </div>

        {error ? (
          <>
            <div className="flex items-start gap-2 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <a
              href="/login"
              className="mt-5 inline-block w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold"
            >
              Masuk manual
            </a>
            <p className="text-xs text-slate-500 mt-3">
              Tiket hanya berlaku 60 detik dan sekali pakai. Buka ulang aplikasi ini dari Portal SIMKlinik.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-slate-900">Menyiapkan sesi Anda…</h1>
            <p className="text-xs text-slate-500 mt-1">
              Memverifikasi tiket dari Portal SIMKlinik. Mohon tunggu sebentar.
            </p>
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  // React 18 menjalankan efek dua kali di mode pengembangan. Tiket hanya bisa
  // ditukar sekali, jadi penukaran dijaga agar tidak terkirim dua kali.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const ticket = searchParams.get('sso_ticket');
    if (!ticket) {
      setError('Tiket login tidak ditemukan pada tautan ini.');
      return;
    }

    (async () => {
      try {
        // Server portal yang memegang service key, jadi browser cukup memanggil
        // satu endpoint ini. Responsnya berisi info pengguna dan alamat portal.
        const res = await apiFetch<{
          accessToken: string;
          user: { id: number; username: string; fullName: string; role: string };
          portalUrl?: string;
        }>('/api/sso/redeem', {
          method: 'POST',
          body: JSON.stringify({ ticket }),
        });

        localStorage.setItem('vaksinku_token', res.accessToken);
        localStorage.setItem('vaksinku_user', JSON.stringify(res.user));
        if (res.portalUrl) {
          localStorage.setItem('vaksinku_portal_url', res.portalUrl);
        }

        router.replace('/dashboard');
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Tidak dapat menyelesaikan proses masuk dari portal. Silakan coba lagi.'
        );
      }
    })();
  }, [searchParams, router]);

  return <SsoShell error={error} />;
}
