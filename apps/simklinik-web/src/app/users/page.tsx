'use client';

import React from 'react';
import AppShell, { usePortalUrl } from '@/components/AppShell';
import { useAuth } from '@/lib/auth-context';
import { UserCog, ExternalLink } from 'lucide-react';

// Akun dan hak akses fitur SIMKlinik dikelola di portal: satu akun berlaku
// untuk semua aplikasi klinik, dan Superadmin mencentang fitur per aplikasi
// di sana. Halaman ini hanya mengarahkan ke tempat itu.
export default function UsersPage() {
  const { user } = useAuth();
  const portalUrl = usePortalUrl();

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="pb-2 border-b border-slate-200">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCog className="w-6 h-6 text-teal-700" />
            Kelola Pengguna
          </h1>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 text-sm text-slate-700">
          <p>
            Akun staf dan hak akses fitur SIMKlinik sekarang diatur di <strong>Portal</strong>. Satu akun berlaku untuk
            portal dan semua aplikasi klinik, dengan password yang sama.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Membuat akun baru dan mereset password: Portal &gt; Pengguna.</li>
            <li>Memberi akses SIMKlinik dan memilih fitur yang boleh dipakai: buka akun tersebut, lalu bagian SIMKlinik.</li>
            <li>Perubahan berlaku paling lambat 30 detik, tanpa staf perlu login ulang.</li>
          </ul>

          {user?.isSuperadmin ? (
            portalUrl ? (
              <a
                href={`${portalUrl}/users`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka Pengguna di Portal</span>
              </a>
            ) : (
              <p className="text-xs text-slate-500">Alamat portal belum dapat dimuat.</p>
            )
          ) : (
            <p className="text-xs text-slate-500">Hanya Superadmin yang dapat mengubah akun dan hak akses.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
