'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Copy, Trash2, Pencil, Loader2, Search, Power } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { ConfirmModal } from '@/components/Modal';
import { CategoryBadge } from '@/components/Badges';
import { useToast } from '@/components/Toast';
import { apiFetch, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { TemplateSummary } from '@/lib/types';

export default function TemplateListPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [list, setList] = useState<TemplateSummary[] | null>(null);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<TemplateSummary | null>(null);

  const load = useCallback(() => {
    apiFetch<{ data: TemplateSummary[] }>('/api/template?semua=1')
      .then((r) => setList(r.data))
      .catch((err) => toast('error', errorMessage(err)));
  }, [toast]);

  useEffect(load, [load]);

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await fn();
      load();
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const term = q.trim().toLowerCase();
  const shown = (list ?? []).filter((t) => !term || `${t.name} ${t.code} ${t.description ?? ''}`.toLowerCase().includes(term));

  if (!can('template.kelola')) {
    return (
      <AppShell>
        <p className="p-8 text-sm text-slate-600">Akun Anda belum diberi izin mengelola template.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Template Surat</h1>
            <p className="text-sm text-slate-500">Kop, isi, tanda tangan, variabel, kertas, dan penomoran setiap jenis surat.</p>
          </div>
          <Link href="/template/baru" className="btn-primary">
            <Plus className="w-4 h-4" /> Template baru
          </Link>
        </div>

        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
          <input className="input pl-8" placeholder="Cari template…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600 text-left">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Template</th>
                <th className="px-3 py-2.5 font-semibold hidden md:table-cell">Jenis</th>
                <th className="px-3 py-2.5 font-semibold hidden lg:table-cell">Penomoran</th>
                <th className="px-3 py-2.5 font-semibold hidden lg:table-cell">Isi</th>
                <th className="px-3 py-2.5 font-semibold">Dipakai</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className={`border-t border-slate-100 ${t.isActive ? '' : 'opacity-60'}`}>
                  <td className="px-3 py-2.5">
                    <Link href={`/template/${t.id}`} className="font-medium text-slate-900 hover:text-teal-700">
                      {t.name}
                    </Link>
                    <p className="text-[11px] text-slate-500">
                      <span className="font-mono">{t.code}</span> · v{t.version} · {t.pageSize}
                      {!t.isActive && ' · nonaktif'}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <CategoryBadge category={t.category} />
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell font-mono text-xs">{t.numbering.code || t.code}</td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-slate-600">
                    {t.variableCount} isian · {t.signerCount} ttd
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{t.letterCount} surat</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      {busyId === t.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400 m-2" />}
                      <Link href={`/template/${t.id}`} className="btn-ghost btn-sm" title="Ubah">
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        className="btn-ghost btn-sm"
                        title={t.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        onClick={() =>
                          act(t.id, () => apiFetch(`/api/template/${t.id}/aktif`, { method: 'PUT', body: JSON.stringify({ isActive: !t.isActive }) }))
                        }
                      >
                        <Power className={`w-4 h-4 ${t.isActive ? 'text-emerald-600' : ''}`} />
                      </button>
                      <button
                        className="btn-ghost btn-sm"
                        title="Duplikat"
                        onClick={() =>
                          act(t.id, async () => {
                            await apiFetch(`/api/template/${t.id}/duplikat`, { method: 'POST' });
                            toast('success', `Salinan "${t.name}" dibuat.`);
                          })
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button className="btn-ghost btn-sm text-rose-600" title="Hapus" onClick={() => setToDelete(t)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list && (
            <p className="p-6 text-sm text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
            </p>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!toDelete}
        title="Hapus template?"
        danger
        onClose={() => setToDelete(null)}
        confirmLabel="Hapus"
        onConfirm={() => {
          const t = toDelete!;
          setToDelete(null);
          void act(t.id, async () => {
            const res = await apiFetch<{ message: string }>(`/api/template/${t.id}`, { method: 'DELETE' });
            toast('success', res.message);
          });
        }}
        message={
          <p>
            Template <b>{toDelete?.name}</b>{' '}
            {toDelete?.letterCount ? `sudah dipakai ${toDelete.letterCount} surat, jadi hanya dinonaktifkan agar arsip tetap utuh.` : 'dihapus permanen.'}
          </p>
        }
      />
    </AppShell>
  );
}
