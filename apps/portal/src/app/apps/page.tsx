'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { AppEntry, AppHealth } from '@/lib/types';
import { Loader2, Pencil, X, AlertCircle, Plus, CheckCircle2, XCircle } from 'lucide-react';

interface AppForm {
  code: string;
  name: string;
  description: string;
  frontendUrl: string;
  backendUrl: string;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm: AppForm = {
  code: '',
  name: '',
  description: '',
  frontendUrl: '',
  backendUrl: '',
  sortOrder: 0,
  isActive: true,
};

// Kode aplikasi dipakai di token (aud) dan app_access, jadi tidak boleh
// berubah setelah dipakai. Formulir mengunci kode saat mengubah app yang ada.
const CODE_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;

export default function AppsPage() {
  const { token } = useAuth();
  const { success, error: toastError } = useToast();

  const [apps, setApps] = useState<AppEntry[]>([]);
  const [health, setHealth] = useState<Record<string, AppHealth>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<AppEntry | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<AppForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [appsRes, healthRes] = await Promise.all([
        apiFetch<{ data: AppEntry[] }>('/api/apps/all', { token }),
        apiFetch<{ data: AppHealth[] }>('/api/apps/health', { token }).catch(() => ({ data: [] as AppHealth[] })),
      ]);
      setApps(appsRes.data);
      setHealth(Object.fromEntries(healthRes.data.map((item) => [item.code, item])));
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Gagal memuat daftar aplikasi.');
      setApps([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: apps.length + 1 });
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (app: AppEntry) => {
    setEditing(app);
    setForm({
      code: app.code,
      name: app.name,
      description: app.description ?? '',
      frontendUrl: app.frontendUrl ?? '',
      backendUrl: app.backendUrl ?? '',
      sortOrder: app.sortOrder,
      isActive: app.isActive === 1,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Kode dan nama aplikasi wajib diisi.');
      return;
    }
    if (!CODE_PATTERN.test(form.code.trim())) {
      setFormError('Kode aplikasi harus huruf kecil/angka, awali dengan huruf, tanpa spasi. Contoh: apotek.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await apiFetch('/api/apps', {
        method: 'POST',
        token,
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          frontendUrl: form.frontendUrl.trim() || undefined,
          backendUrl: form.backendUrl.trim() || undefined,
          sortOrder: Number(form.sortOrder) || 0,
          isActive: form.isActive ? 1 : 0,
        }),
      });
      success(`Aplikasi ${form.name} berhasil disimpan.`);
      setIsFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan aplikasi.');
    } finally {
      setIsSaving(false);
    }
  };

  const tone = (status: string) =>
    status === 'aktif'
      ? 'text-emerald-700'
      : status === 'tidak dapat dihubungi'
      ? 'text-slate-500'
      : 'text-rose-700';

  return (
    <PortalShell
      title="Aplikasi"
      subtitle="Daftar aplikasi yang tampil di portal. Kartu di beranda muncul otomatis dari daftar ini."
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-slate-600">
          {!isLoading && (
            <>
              <span className="font-semibold text-slate-900">{apps.length}</span> aplikasi terdaftar ·{' '}
              <span className="font-semibold text-emerald-700">
                {apps.filter((app) => app.isActive === 1).length}
              </span>{' '}
              aktif di portal
            </>
          )}
        </p>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-portal-600 hover:bg-portal-700 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          Daftarkan Aplikasi
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-portal-600" />
            <span className="text-sm font-medium">Memuat daftar aplikasi…</span>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 py-3">Kode</th>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">Alamat Aplikasi</th>
                    <th className="px-4 py-3">Status Layanan</th>
                    <th className="px-4 py-3">Tampil</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {apps.map((app) => (
                    <tr key={app.code} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{app.code}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{app.name}</p>
                        {app.description && (
                          <p className="text-xs text-slate-500 mt-0.5 max-w-xs">{app.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p className="font-mono">{app.frontendUrl || <span className="text-slate-400">—</span>}</p>
                        <p className="font-mono text-slate-400 mt-0.5">
                          API: {app.backendUrl || '—'}
                        </p>
                      </td>
                      <td className={`px-4 py-3 text-xs font-medium ${tone(health[app.code]?.status ?? '')}`}>
                        {health[app.code]?.status ?? 'belum diperiksa'}
                      </td>
                      <td className="px-4 py-3">
                        {app.isActive === 1 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Ya
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                            <XCircle className="w-3.5 h-3.5" />
                            Disembunyikan
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(app)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-portal-700 hover:text-portal-900 px-2.5 py-1.5 rounded-lg hover:bg-portal-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Ubah
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden divide-y divide-slate-100">
              {apps.map((app) => (
                <li key={app.code} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{app.name}</p>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">{app.code}</p>
                      <p className="text-xs text-slate-500 mt-1 break-all">
                        {app.frontendUrl || 'Alamat belum diisi'}
                      </p>
                      <p className={`text-xs font-medium mt-1 ${tone(health[app.code]?.status ?? '')}`}>
                        {health[app.code]?.status ?? 'belum diperiksa'}
                        {app.isActive === 0 && ' · disembunyikan'}
                      </p>
                    </div>
                    <button
                      onClick={() => openEdit(app)}
                      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-portal-700 px-2.5 py-1.5 rounded-lg border border-portal-200"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Ubah
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="font-bold text-slate-900">
                  {editing ? 'Ubah Aplikasi' : 'Daftarkan Aplikasi'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Status layanan diperiksa dari alamat API yang diisi di sini.
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Tutup formulir"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {formError && (
                <div className="flex items-start gap-2 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kode
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editing)}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
                    placeholder="mis. apotek"
                    className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent font-mono ${
                      editing ? 'bg-slate-100 text-slate-500' : ''
                    }`}
                  />
                  {editing && (
                    <p className="text-xs text-slate-400 mt-1">
                      Kode tidak dapat diubah — dipakai di token dan hak akses.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Urutan Tampil
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Aplikasi
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="mis. Apotek Klinik"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Keterangan
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ditampilkan di kartu beranda portal"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alamat Frontend
                </label>
                <input
                  type="text"
                  value={form.frontendUrl}
                  onChange={(e) => setForm({ ...form, frontendUrl: e.target.value })}
                  placeholder="http://localhost:8084"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Tujuan pengalihan saat staf menekan Buka. Harus alamat yang bisa dibuka browser staf.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alamat API (Backend)
                </label>
                <input
                  type="text"
                  value={form.backendUrl}
                  onChange={(e) => setForm({ ...form, backendUrl: e.target.value })}
                  placeholder="http://localhost:4003"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Dipakai portal untuk memeriksa status lewat GET /api/health.
                </p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-portal-600 focus:ring-portal-500"
                />
                <span className="text-sm text-slate-700">Tampilkan di beranda portal</span>
              </label>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-portal-600 hover:bg-portal-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Menyimpan…' : 'Simpan Aplikasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
