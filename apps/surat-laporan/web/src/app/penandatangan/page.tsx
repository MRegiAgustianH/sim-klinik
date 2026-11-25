'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, PenLine } from 'lucide-react';
import AppShell from '@/components/AppShell';
import Modal, { ConfirmModal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { apiFetch, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Signer } from '@/lib/types';

type Draft = { id?: number; name: string; position: string; idLabel: string; idNumber: string; isActive: boolean; sortOrder: number };
const EMPTY: Draft = { name: '', position: '', idLabel: 'NIP', idNumber: '', isActive: true, sortOrder: 0 };

export default function SignersPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [list, setList] = useState<Signer[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Signer | null>(null);

  const load = useCallback(() => {
    apiFetch<{ data: Signer[] }>('/api/penandatangan?semua=1')
      .then((r) => setList(r.data))
      .catch((err) => toast('error', errorMessage(err)));
  }, [toast]);
  useEffect(load, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const body = JSON.stringify(draft);
      if (draft.id) await apiFetch(`/api/penandatangan/${draft.id}`, { method: 'PUT', body });
      else await apiFetch('/api/penandatangan', { method: 'POST', body });
      toast('success', 'Penandatangan tersimpan.');
      setDraft(null);
      load();
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: Signer) => {
    setToDelete(null);
    try {
      await apiFetch(`/api/penandatangan/${s.id}`, { method: 'DELETE' });
      toast('success', 'Penandatangan dihapus. Surat yang sudah dibuat tidak berubah.');
      load();
    } catch (err) {
      toast('error', errorMessage(err));
    }
  };

  if (!can('template.kelola')) {
    return (
      <AppShell>
        <p className="p-8 text-sm text-slate-600">Akun Anda belum diberi izin mengelola penandatangan.</p>
      </AppShell>
    );
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Penandatangan</h1>
            <p className="text-sm text-slate-500">Nama, jabatan, dan NIP/SIP yang dipilih saat membuat surat, agar tidak diketik ulang.</p>
          </div>
          <button className="btn-primary" onClick={() => setDraft({ ...EMPTY, sortOrder: list?.length ?? 0 })}>
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>
        <div className="card divide-y divide-slate-100">
          {list?.map((s) => (
            <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${s.isActive ? '' : 'opacity-55'}`}>
              <div className="w-9 h-9 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <PenLine className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-600">{s.position}</p>
                <p className="text-[11px] text-slate-500">
                  {s.idNumber ? `${s.idLabel ?? ''} ${s.idNumber}` : 'Tanpa NIP/SIP'}
                  {!s.isActive && ' · nonaktif'}
                </p>
              </div>
              <button
                className="btn-ghost btn-sm"
                onClick={() =>
                  setDraft({
                    id: s.id,
                    name: s.name,
                    position: s.position,
                    idLabel: s.idLabel ?? '',
                    idNumber: s.idNumber ?? '',
                    isActive: !!s.isActive,
                    sortOrder: s.sortOrder,
                  })
                }
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button className="btn-ghost btn-sm text-rose-600" onClick={() => setToDelete(s)}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!list && (
            <p className="p-6 text-sm text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
            </p>
          )}
          {list?.length === 0 && <p className="p-6 text-sm text-slate-500 text-center">Belum ada penandatangan.</p>}
        </div>
      </div>

      <Modal
        open={!!draft}
        title={draft?.id ? 'Ubah penandatangan' : 'Tambah penandatangan'}
        onClose={() => setDraft(null)}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDraft(null)}>
              Batal
            </button>
            <button className="btn-primary" disabled={busy || !draft?.name.trim() || !draft?.position.trim()} onClick={() => void save()}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
            </button>
          </>
        }
      >
        {draft && (
          <div className="space-y-3">
            <div>
              <label className="label">Nama lengkap & gelar</label>
              <input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="dr. Nama, Sp.P" autoFocus />
            </div>
            <div>
              <label className="label">Jabatan</label>
              <input className="input" value={draft.position} onChange={(e) => set({ position: e.target.value })} placeholder="Kepala Klinik" />
              <p className="text-[11px] text-slate-500 mt-1">Template memilih penandatangan bawaan berdasarkan jabatan ini.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Jenis</label>
                <select className="input" value={draft.idLabel} onChange={(e) => set({ idLabel: e.target.value })}>
                  {['NIP', 'SIP', 'NIK', 'NIPPPK', 'NRP', ''].map((v) => (
                    <option key={v} value={v}>
                      {v || '(tanpa)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Nomor</label>
                <input className="input" value={draft.idNumber} onChange={(e) => set({ idNumber: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Urutan</label>
                <input className="input" type="number" value={draft.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
              </div>
              <label className="flex items-end gap-2 text-sm pb-2">
                <input type="checkbox" checked={draft.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Aktif
              </label>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmModal
        open={!!toDelete}
        title="Hapus penandatangan?"
        danger
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && void remove(toDelete)}
        confirmLabel="Hapus"
        message={<p>{toDelete?.name} dihapus dari daftar. Surat yang sudah dibuat tetap menyimpan nama dan jabatannya.</p>}
      />
    </AppShell>
  );
}
