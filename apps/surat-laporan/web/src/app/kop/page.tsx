'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Save, Star, Trash2, Loader2, Heading, ImagePlus } from 'lucide-react';
import AppShell from '@/components/AppShell';
import SuratProEditor, { insertAtCaret } from '@/components/SuratProEditor';
import { ConfirmModal } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { apiFetch, errorMessage, uploadImage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { wrapDoc } from '@/lib/compose';
import { SYSTEM_VARS } from '@/lib/variables';
import type { Letterhead, PageSetup } from '@/lib/types';
import type { SuratProInstance } from '@/lib/suratpro';

// Kop disunting pada lebar isi kertas A4 dengan margin standar template, agar
// lebarnya sama seperti saat dipakai di surat.
const PAGE: PageSetup = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 1.5, right: 2, bottom: 2, left: 2.5 },
  fontFamily: 'Times New Roman',
  fontSize: 12,
  lineSpacing: 1,
};

export default function KopPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [list, setList] = useState<Letterhead[] | null>(null);
  const [selected, setSelected] = useState<Letterhead | null>(null);
  const [name, setName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editorRef = useRef<SuratProInstance | null>(null);
  const ignoreUntil = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (selectId?: number) => {
    try {
      const r = await apiFetch<{ data: Letterhead[] }>('/api/kop');
      setList(r.data);
      const pick = r.data.find((k) => k.id === selectId) ?? r.data[0] ?? null;
      return pick;
    } catch (err) {
      toast('error', errorMessage(err));
      return null;
    }
  }, [toast]);

  const open = (k: Letterhead | null) => {
    setSelected(k);
    setName(k?.name ?? 'Kop baru');
    setDirty(!k);
    const ed = editorRef.current;
    if (ed) {
      ignoreUntil.current = Date.now() + 500;
      ed.setContent(wrapDoc(PAGE, k?.html || '<p style="text-align:center"><b>NAMA INSTANSI</b></p><hr>'));
    }
  };

  useEffect(() => {
    void load().then((pick) => pick && open(pick));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const save = async () => {
    const ed = editorRef.current;
    if (!ed) return;
    setBusy(true);
    try {
      const body = JSON.stringify({ name, html: ed.getCleanHTML(false) });
      const saved = selected
        ? await apiFetch<Letterhead>(`/api/kop/${selected.id}`, { method: 'PUT', body })
        : await apiFetch<Letterhead>('/api/kop', { method: 'POST', body });
      toast('success', 'Kop surat tersimpan. Surat baru memakai kop ini; surat lama tidak berubah.');
      await load(saved.id);
      setSelected(saved);
      setDirty(false);
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async () => {
    if (!selected) return;
    try {
      await apiFetch(`/api/kop/${selected.id}/bawaan`, { method: 'PUT' });
      toast('success', `"${selected.name}" menjadi kop bawaan.`);
      await load(selected.id);
      setSelected({ ...selected, isDefault: 1 });
    } catch (err) {
      toast('error', errorMessage(err));
    }
  };

  const remove = async () => {
    if (!selected) return;
    setConfirmDelete(false);
    try {
      const res = await apiFetch<{ message: string }>(`/api/kop/${selected.id}`, { method: 'DELETE' });
      toast('success', res.message);
      const pick = await load();
      open(pick);
    } catch (err) {
      toast('error', errorMessage(err));
    }
  };

  const insertImage = async (file: File) => {
    const ed = editorRef.current;
    if (!ed) return;
    try {
      const url = await uploadImage(file);
      ed.focus();
      document.execCommand('insertHTML', false, `<img src="${url}" alt="Kop" style="width:16.5cm">`);
      ed.changed();
      setDirty(true);
    } catch (err) {
      toast('error', errorMessage(err));
    }
  };

  if (!can('template.kelola')) {
    return (
      <AppShell>
        <p className="p-8 text-sm text-slate-600">Akun Anda belum diberi izin mengelola kop surat.</p>
      </AppShell>
    );
  }

  return (
    <AppShell fullHeight>
      <div className="h-full flex">
        <aside className="w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Heading className="w-4 h-4 text-teal-700" /> Kop Surat
            </h1>
            <p className="text-[11px] text-slate-500 mt-1">Header yang bisa dipakai banyak template. Kop bawaan dipakai template dengan mode kop &ldquo;bawaan&rdquo;.</p>
            <button className="btn-secondary btn-sm w-full mt-3" onClick={() => open(null)}>
              <Plus className="w-3.5 h-3.5" /> Kop baru
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto p-2 space-y-1">
            {list?.map((k) => (
              <li key={k.id}>
                <button
                  onClick={() => open(k)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected?.id === k.id ? 'bg-teal-50 border border-teal-300' : 'hover:bg-slate-50 border border-transparent'}`}
                >
                  <span className="flex items-center gap-1.5 font-medium text-slate-800">
                    {k.isDefault ? <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> : null}
                    {k.name}
                  </span>
                  <span className="text-[11px] text-slate-500">{k.isDefault ? 'Bawaan · ' : ''}{k.usedBy ?? 0} template memilih langsung</span>
                </button>
              </li>
            ))}
            {!list && (
              <li className="p-4 text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
              </li>
            )}
          </ul>
          <div className="p-3 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 mb-1">Variabel klinik (klik untuk sisipkan)</p>
            <div className="flex flex-wrap gap-1">
              {SYSTEM_VARS.filter((v) => v.group === 'Klinik').map((v) => (
                <button
                  key={v.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (editorRef.current) insertAtCaret(editorRef.current, `{{${v.key}}}`);
                    setDirty(true);
                  }}
                  className="px-1.5 py-0.5 rounded border border-teal-200 bg-teal-50/60 text-[11px] text-teal-800 hover:bg-teal-100"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center gap-2 px-3">
            <input className="input max-w-sm" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} placeholder="Nama kop" />
            {dirty && <span className="text-[11px] text-amber-700">• belum disimpan</span>}
            <div className="flex-1" />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void insertImage(e.target.files[0])} />
            <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()} title="Sisipkan logo / gambar kop">
              <ImagePlus className="w-4 h-4" /> Gambar
            </button>
            {selected && !selected.isDefault && (
              <>
                <button className="btn-ghost btn-sm" onClick={() => void makeDefault()}>
                  <Star className="w-4 h-4" /> Jadikan bawaan
                </button>
                <button className="btn-ghost btn-sm text-rose-600" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button className="btn-primary btn-sm" onClick={() => void save()} disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan kop
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <SuratProEditor
              initialContent={wrapDoc(PAGE, '<p><br></p>')}
              fileName="kop-surat"
              onReady={(ed) => {
                editorRef.current = ed;
                if (selected || list) open(selected ?? list?.[0] ?? null);
              }}
              onChange={() => Date.now() > ignoreUntil.current && setDirty(true)}
            />
          </div>
        </div>
      </div>
      <ConfirmModal
        open={confirmDelete}
        title="Hapus kop?"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        confirmLabel="Hapus"
        message={<p>Template yang memilih kop ini beralih ke kop bawaan. Surat yang sudah dibuat tidak berubah.</p>}
      />
    </AppShell>
  );
}
