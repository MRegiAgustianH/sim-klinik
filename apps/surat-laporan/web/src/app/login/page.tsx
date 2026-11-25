'use client';

import React, { useState } from 'react';
import { FileText, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-teal-700 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600 text-white mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Sistem Surat</h1>
          <p className="text-xs text-slate-500 mt-1">Klinik Utama Dr. H. A. Rotinsulu Cianjur</p>
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        <div>
          <label className="label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn-primary w-full h-10" disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Masuk
        </button>
        <p className="text-[11px] text-slate-500 text-center">Satu akun untuk semua aplikasi klinik. Akun dan hak akses diatur di Portal SIMKlinik.</p>
      </form>
    </div>
  );
}
