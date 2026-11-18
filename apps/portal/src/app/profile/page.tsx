'use client';

import React, { useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { KeyRound, Loader2, ShieldCheck, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function ProfilePage() {
  const { user, token, refreshProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setFormError(null);

    if (newPassword.length < 6) {
      setFormError('Password baru minimal 6 karakter.');
      return;
    }
    // Salah ketik pada password baru akan mengunci akun dari aplikasi, jadi
    // konfirmasi diperiksa di sini sebelum dikirim ke server.
    if (newPassword !== confirmPassword) {
      setFormError('Konfirmasi password baru tidak sama.');
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        token,
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      success('Password berhasil diperbarui. Gunakan password baru pada login berikutnya.');
      await refreshProfile();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal memperbarui password.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PortalShell title="Profil Saya" subtitle="Akun ini berlaku untuk seluruh aplikasi klinik.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl">
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-portal-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
              {user?.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{user?.fullName}</p>
              <p className="text-xs text-slate-500">@{user?.username}</p>
            </div>
          </div>

          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Peran</dt>
              <dd className="text-slate-900 mt-0.5">{user?.role}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Akses Aplikasi
              </dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {user?.role === 'Superadmin' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Semua aplikasi otomatis
                  </span>
                ) : (user?.apps ?? []).length === 0 ? (
                  <span className="text-slate-400 text-xs">Belum ada akses</span>
                ) : (
                  user?.apps.map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 text-xs font-medium text-portal-800 bg-portal-50 border border-portal-200 rounded-full px-2.5 py-0.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {code}
                    </span>
                  ))
                )}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-slate-400 mt-5 pt-4 border-t border-slate-100">
            Peran dan akses aplikasi hanya dapat diubah Superadministrator.
          </p>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-5 h-5 text-portal-600" />
            <h2 className="font-bold text-slate-900">Ubah Password</h2>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Password berlaku untuk seluruh aplikasi klinik. Setelah diubah, login di aplikasi lain
            memakai password baru ini.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            {formError && (
              <div className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password Saat Ini
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password Baru
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Minimal 6 karakter.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Ulangi Password Baru
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-portal-600 hover:bg-portal-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Menyimpan…' : 'Simpan Password Baru'}
            </button>
          </form>
        </div>
      </div>
    </PortalShell>
  );
}
