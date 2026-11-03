'use client';

import React, { useState } from 'react';
import AppShell from '@/components/AppShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import {
  User,
  Lock,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const { success, error: toastError, warning } = useToast();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword || !newPassword) {
      warning('Silakan isi password lama dan password baru.');
      return;
    }

    if (newPassword.length < 6) {
      warning('Password baru minimal harus 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      warning('Konfirmasi password baru tidak cocok.');
      return;
    }

    try {
      setIsSubmitting(true);
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      success('Password berhasil diperbarui.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui password.';
      toastError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'Superadmin':
        return <ShieldCheck className="w-5 h-5 text-purple-600" />;
      case 'Dokter':
        return <Stethoscope className="w-5 h-5 text-blue-600" />;
      case 'Perawat':
        return <HeartPulse className="w-5 h-5 text-emerald-600" />;
      default:
        return <User className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Profil Pengguna & Keamanan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Informasi akun staf rumah sakit dan pengaturan kata sandi
          </p>
        </div>

        {/* Info Pengguna Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{user?.fullName}</h2>
              <p className="text-xs font-mono text-slate-500 mt-0.5">Username: @{user?.username}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Peran (Role Akses)</span>
              <div className="flex items-center gap-2 mt-1">
                {getRoleIcon()}
                <span className="font-bold text-slate-900">{user?.role}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Status Akun</span>
              <div className="flex items-center gap-1.5 mt-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Aktif Terverifikasi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ganti Password Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
            <KeyRound className="w-5 h-5 text-teal-700" />
            <h3 className="text-sm font-bold text-slate-900">Perbarui Kata Sandi</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Password Lama <span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan password lama Anda"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Password Baru (Min. 6 Karakter) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password baru"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ulangi Password Baru <span className="text-rose-600">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Konfirmasi password baru"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? 'Memperbarui...' : 'Simpan Password Baru'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
