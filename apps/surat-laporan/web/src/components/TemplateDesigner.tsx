'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Loader2,
  Heading,
  FileText,
  PenLine,
  Footprints,
  Braces,
  Settings2,
  Eye,
  History,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Wand2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import SuratProEditor, { insertAtCaret } from './SuratProEditor';
import PaperView from './PaperView';
import Modal, { ConfirmModal } from './Modal';
import { useToast } from './Toast';
import { apiFetch, errorMessage } from '@/lib/api';
import { SuratProInstance } from '@/lib/suratpro';
import { composeLetter, defaultSigners, defaultValues, FONTS, kopHtmlFor, LAYOUT_LABELS, PAPERS, wrapDoc } from '@/lib/compose';
import { builtinVars, CatalogVar, extractTokens, dayVarBase, isBuiltinKey, todayIso } from '@/lib/variables';
import { PATTERN_TOKENS, previewNumber } from '@/lib/numbering';
import type { Letterhead, PageSetup, Settings, Signer, Template, VarDef, VarType } from '@/lib/types';
import { CATEGORIES, CATEGORY_INFO } from '@/lib/category';

type Tab = 'kop' | 'isi' | 'ttd' | 'penutup' | 'variabel' | 'pengaturan' | 'pratinjau';
type HtmlField = 'customHeaderHtml' | 'bodyHtml' | 'closingHtml';

const TABS: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'kop', label: 'Kop', icon: Heading },
  { key: 'isi', label: 'Isi surat', icon: FileText },
  { key: 'ttd', label: 'Tanda tangan', icon: PenLine },
  { key: 'penutup', label: 'Penutup', icon: Footprints },
  { key: 'variabel', label: 'Variabel', icon: Braces },
  { key: 'pengaturan', label: 'Halaman & nomor', icon: Settings2 },
  { key: 'pratinjau', label: 'Pratinjau', icon: Eye },
];

const VAR_TYPES: Array<{ v: VarType; label: string }> = [
  { v: 'text', label: 'Teks singkat' },
  { v: 'textarea', label: 'Teks panjang' },
  { v: 'number', label: 'Angka' },
  { v: 'date', label: 'Tanggal' },
  { v: 'time', label: 'Jam' },
  { v: 'select', label: 'Pilihan' },
  { v: 'list', label: 'Daftar bernomor' },
  { v: 'tabel', label: 'Tabel' },
];

const DEFAULT_PAGE: PageSetup = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 1.5, right: 2, bottom: 2, left: 2.5 },
  fontFamily: 'Times New Roman',
  fontSize: 12,
  lineSpacing: 1.15,
};

export function blankTemplate(): Template {
  return {
    id: 0,
    code: '',
    name: '',
    category: 'internal',
    description: '',
    letterheadMode: 'default',
    letterheadId: null,
    customHeaderHtml: '',
    bodyHtml:
      '<p style="text-align:center"><b><u><span style="font-size:14pt">JUDUL SURAT</span></u></b></p>' +
      '<p style="text-align:center">Nomor: {{nomor_surat}}</p><p><br></p>' +
      '<p style="text-align:justify;text-indent:1.27cm">Tulis isi surat di sini. Sisipkan variabel dari panel kiri, mis. {{klinik_nama}}.</p>' +
      '<p><br></p><p>{{tanda_tangan}}</p>',
    closingHtml: '',
    signature: { layout: 'kanan', showPlaceDate: true, slots: [{ label: 'Kepala Klinik,', signerId: null, showId: true }] },
    page: DEFAULT_PAGE,
    numbering: { code: '', pattern: '' },
    variables: [],
    isActive: true,
    sortOrder: 0,
    version: 0,
    createdBy: null,
    updatedBy: null,
    createdAt: '',
    updatedAt: '',
  };
}

const CM = 96 / 2.54;
const r2 = (n: number) => Math.round(n * 100) / 100;

function pageFromEditor(ed: SuratProInstance): PageSetup {
  const d = ed.doc;
  return {
    pageSize: d.paper as PageSetup['pageSize'],
    orientation: d.orient === 'landscape' ? 'landscape' : 'portrait',
    margins: { top: r2(d.m.t / CM), right: r2(d.m.r / CM), bottom: r2(d.m.b / CM), left: r2(d.m.l / CM) },
    fontFamily: d.font,
    fontSize: d.size,
    lineSpacing: d.ls,
  };
}

export default function TemplateDesigner({ initial }: { initial: Template }) {
  const toast = useToast();
  const [t, setTState] = useState<Template>(initial);
  const tRef = useRef(t);
  const setT = useCallback((fn: (prev: Template) => Template) => {
    setTState((prev) => {
      const next = fn(prev);
      tRef.current = next;
      return next;
    });
  }, []);
  const [tab, setTab] = useState<Tab>('isi');
  const [dirty, setDirty] = useState(initial.id === 0);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({});
  const [letterheads, setLetterheads] = useState<Letterhead[]>([]);
  const [master, setMaster] = useState<Signer[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const editorRef = useRef<SuratProInstance | null>(null);
  const loadedField = useRef<HtmlField | null>(null);
  const ignoreChangeUntil = useRef(0);

  useEffect(() => {
    apiFetch<Settings>('/api/pengaturan').then(setSettings).catch(() => undefined);
    apiFetch<{ data: Letterhead[] }>('/api/kop').then((r) => setLetterheads(r.data)).catch(() => undefined);
    apiFetch<{ data: Signer[] }>('/api/penandatangan').then((r) => setMaster(r.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch: Partial<Template>) => {
    setT((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const field: HtmlField | null =
    tab === 'isi' ? 'bodyHtml' : tab === 'penutup' ? 'closingHtml' : tab === 'kop' && t.letterheadMode === 'custom' ? 'customHeaderHtml' : null;

  /** Menyalin isi editor ke field template yang sedang disunting. */
  const capture = useCallback((): Template => {
    const ed = editorRef.current;
    const f = loadedField.current;
    if (ed && f) {
      const html = ed.getCleanHTML(false);
      const page = pageFromEditor(ed);
      const next = { ...tRef.current, [f]: html, page };
      tRef.current = next;
      setTState(next);
    }
    return tRef.current;
  }, []);

  const loadField = useCallback((f: HtmlField | null) => {
    const ed = editorRef.current;
    if (!ed || !f || loadedField.current === f) return;
    ignoreChangeUntil.current = Date.now() + 500;
    ed.setContent(wrapDoc(tRef.current.page, tRef.current[f] || '<p><br></p>'));
    loadedField.current = f;
  }, []);

  const switchTab = (next: Tab) => {
    capture();
    setTab(next);
  };

  useEffect(() => {
    loadField(field);
  }, [field, loadField]);

  // Setelan halaman diubah dari formulir: terapkan ke editor.
  const applyPage = (page: PageSetup) => {
    capture();
    update({ page });
    const ed = editorRef.current;
    const f = loadedField.current;
    if (ed && f) {
      ignoreChangeUntil.current = Date.now() + 500;
      ed.setContent(wrapDoc(page, tRef.current[f] || '<p><br></p>'));
    }
  };

  const save = async () => {
    const full = capture();
    if (!full.name.trim()) return toast('error', 'Nama template wajib diisi (tab Halaman & nomor).');
    if (!full.code.trim()) return toast('error', 'Kode template wajib diisi (tab Halaman & nomor).');
    setSaving(true);
    try {
      const body = JSON.stringify(full);
      const saved = full.id
        ? await apiFetch<Template>(`/api/template/${full.id}`, { method: 'PUT', body })
        : await apiFetch<Template>('/api/template', { method: 'POST', body });
      if (!full.id) window.history.replaceState(null, '', `/template/${saved.id}`);
      // Isi editor tetap yang sedang tampil; data lain diambil dari server.
      setT((prev) => ({ ...saved, [loadedField.current ?? 'bodyHtml']: prev[loadedField.current ?? 'bodyHtml'] }));
      setDirty(false);
      toast('success', `Template tersimpan (versi ${saved.version}).`);
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const kopHtml = useMemo(() => kopHtmlFor(t, letterheads), [t, letterheads]);

  const insertToken = (key: string) => {
    const ed = editorRef.current;
    if (!ed || !field) return;
    insertAtCaret(ed, key === 'tanda_tangan' ? '{{tanda_tangan}}' : `{{${key}}}`);
    setDirty(true);
  };

  const palette = useMemo(() => {
    const builtin = builtinVars(t.category, t.signature);
    const custom: CatalogVar[] = t.variables.map((v) => ({ key: v.key, label: v.label, group: 'Surat' }));
    return { builtin, custom };
  }, [t.category, t.signature, t.variables]);

  const showEditor = field !== null;

  return (
    <div className="h-full flex flex-col">
      <div className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center gap-2 px-3">
        <Link href="/template" className="btn-ghost btn-sm" title="Kembali ke daftar template">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-900 truncate">{t.name || 'Template baru'}</h1>
            {t.code && <span className="chip bg-slate-100 text-slate-600 border-slate-200 font-mono">{t.code}</span>}
            {!t.isActive && <span className="chip bg-slate-100 text-slate-500 border-slate-200">Nonaktif</span>}
            {dirty && <span className="text-[11px] text-amber-700">• belum disimpan</span>}
          </div>
          <p className="text-[11px] text-slate-500">
            {t.id ? `Versi ${t.version} · diubah ${t.updatedBy ?? '-'}` : 'Belum disimpan'} · surat lama tidak berubah saat template diubah
          </p>
        </div>
        {t.id > 0 && (
          <button className="btn-ghost btn-sm" onClick={() => setHistoryOpen(true)}>
            <History className="w-4 h-4" /> <span className="hidden lg:inline">Riwayat</span>
          </button>
        )}
        <button className="btn-primary btn-sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan template
        </button>
      </div>

      <div className="shrink-0 bg-white border-b border-slate-200 px-2 flex gap-1 overflow-x-auto">
        {TABS.map((x) => {
          const Icon = x.icon;
          return (
            <button
              key={x.key}
              onClick={() => switchTab(x.key)}
              className={`flex items-center gap-1.5 px-3 h-10 text-sm font-medium border-b-2 whitespace-nowrap ${
                tab === x.key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {x.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 flex">
        <aside className="w-[360px] shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
          {tab === 'kop' && <KopPanel t={t} update={update} letterheads={letterheads} />}
          {(tab === 'isi' || tab === 'penutup' || (tab === 'kop' && t.letterheadMode === 'custom')) && (
            <Palette
              palette={palette}
              onInsert={insertToken}
              intro={
                tab === 'isi'
                  ? 'Ketik isi surat di editor seperti di Word. Klik variabel untuk menyisipkannya di posisi kursor. Letakkan {{tanda_tangan}} di paragraf sendiri; bila tidak ada, blok tanda tangan ditaruh di akhir isi.'
                  : tab === 'penutup'
                    ? 'Bagian setelah tanda tangan: tembusan, lampiran, catatan kaki. Boleh dikosongkan.'
                    : 'Kop khusus untuk template ini saja. Untuk kop yang dipakai banyak template, gunakan menu Kop Surat.'
              }
              onAddVariable={(def) => {
                update({ variables: [...tRef.current.variables, def] });
                insertToken(def.key);
              }}
              existing={[...palette.builtin.map((v) => v.key), ...t.variables.map((v) => v.key)]}
            />
          )}
          {tab === 'ttd' && <SignaturePanel t={t} update={update} master={master} />}
          {tab === 'variabel' && <VariablesPanel t={t} update={update} capture={capture} />}
          {tab === 'pengaturan' && <SettingsPanel t={t} update={update} applyPage={applyPage} settings={settings} />}
          {tab === 'pratinjau' && (
            <div className="p-4 text-sm text-slate-600 space-y-2">
              <p className="font-semibold text-slate-800">Pratinjau</p>
              <p>Surat lengkap dengan kop, tanda tangan, dan penutup. Isian kosong tampil sebagai <span className="bg-amber-100 text-amber-800 px-1 italic">[label]</span> dan tidak ikut tercetak.</p>
              <p>Nilai bawaan variabel dan penandatangan bawaan ikut ditampilkan.</p>
            </div>
          )}
        </aside>

        <div className="flex-1 min-w-0 relative">
          <div className={`absolute inset-0 ${showEditor ? '' : 'invisible'}`}>
            <SuratProEditor
              initialContent={wrapDoc(t.page, t.bodyHtml || '<p><br></p>')}
              fileName={t.name || 'template'}
              onReady={(ed) => {
                editorRef.current = ed;
                loadedField.current = 'bodyHtml';
                loadField(field);
              }}
              onChange={() => {
                if (Date.now() > ignoreChangeUntil.current) setDirty(true);
              }}
            />
          </div>
          {!showEditor && (
            <div className="absolute inset-0">
              <TemplatePreview t={t} kopHtml={kopHtml} settings={settings} master={master} />
            </div>
          )}
        </div>
      </div>

      {t.id > 0 && (
        <HistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          templateId={t.id}
          currentVersion={t.version}
          onRestored={(restored) => {
            tRef.current = restored;
            setTState(restored);
            loadedField.current = null;
            loadField(field);
            setDirty(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pratinjau
// ---------------------------------------------------------------------------

function TemplatePreview({ t, kopHtml, settings, master }: { t: Template; kopHtml: string; settings: Settings; master: Signer[] }) {
  const html = useMemo(
    () =>
      composeLetter(t, kopHtml, {
        category: t.category,
        defs: t.variables,
        values: defaultValues(t.variables),
        letterDate: todayIso(),
        subject: t.name,
        recipient: '',
        settings,
        patient: null,
        signers: defaultSigners(t.signature, master),
      }),
    [t, kopHtml, settings, master]
  );
  return <PaperView html={html} className="h-full" />;
}

// ---------------------------------------------------------------------------
// Panel kiri
// ---------------------------------------------------------------------------

function PanelTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-2">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{children}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{sub}</p>}
    </div>
  );
}

function KopPanel({ t, update, letterheads }: { t: Template; update: (p: Partial<Template>) => void; letterheads: Letterhead[] }) {
  const modes = [
    { v: 'default', label: 'Kop bawaan klinik', desc: 'Mengikuti kop yang ditandai bawaan di menu Kop Surat.' },
    { v: 'library', label: 'Pilih dari pustaka kop', desc: 'Kop tertentu dari menu Kop Surat.' },
    { v: 'custom', label: 'Kop khusus template ini', desc: 'Dirancang langsung di editor.' },
    { v: 'none', label: 'Tanpa kop', desc: 'Untuk kertas berkop cetak atau surat tanpa header.' },
  ] as const;
  return (
    <div className="pb-4">
      <PanelTitle sub="Header di bagian atas halaman pertama.">Kop surat</PanelTitle>
      <div className="px-4 space-y-2">
        {modes.map((m) => (
          <label
            key={m.v}
            className={`flex gap-2.5 p-2.5 rounded-lg border cursor-pointer ${t.letterheadMode === m.v ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}
          >
            <input
              type="radio"
              className="mt-0.5"
              checked={t.letterheadMode === m.v}
              onChange={() => update({ letterheadMode: m.v, letterheadId: m.v === 'library' ? (t.letterheadId ?? letterheads[0]?.id ?? null) : null })}
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">{m.label}</span>
              <span className="block text-[11px] text-slate-500">{m.desc}</span>
            </span>
          </label>
        ))}
        {t.letterheadMode === 'library' && (
          <select className="input" value={t.letterheadId ?? ''} onChange={(e) => update({ letterheadId: Number(e.target.value) })}>
            {letterheads.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.isDefault ? ' (bawaan)' : ''}
              </option>
            ))}
          </select>
        )}
        <Link href="/kop" className="text-xs text-teal-700 hover:underline inline-block pt-1">
          Kelola pustaka kop surat →
        </Link>
      </div>
    </div>
  );
}

function Palette({
  palette,
  onInsert,
  intro,
  onAddVariable,
  existing,
}: {
  palette: { builtin: CatalogVar[]; custom: CatalogVar[] };
  onInsert: (key: string) => void;
  intro: string;
  onAddVariable: (def: VarDef) => void;
  existing: string[];
}) {
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const groups: Array<[string, CatalogVar[]]> = [
    ['Isian template ini', palette.custom],
    ['Surat', palette.builtin.filter((v) => v.group === 'Surat')],
    ['Klinik', palette.builtin.filter((v) => v.group === 'Klinik')],
    ['Pasien', palette.builtin.filter((v) => v.group === 'Pasien')],
    ['Penandatangan', palette.builtin.filter((v) => v.group === 'Penandatangan')],
  ];
  const key = newKey.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  const keyValid = /^[a-z][a-z0-9_]{0,40}$/.test(key) && !existing.includes(key);

  return (
    <div className="pb-4">
      <PanelTitle sub={intro}>Sisipkan variabel</PanelTitle>
      <div className="px-4 space-y-3">
        {groups
          .filter(([, list]) => list.length > 0)
          .map(([title, list]) => (
            <div key={title}>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">{title}</p>
              <div className="flex flex-wrap gap-1">
                {list.map((v) => (
                  <button
                    key={v.key}
                    // mousedown dicegah agar kursor editor tidak berpindah.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onInsert(v.key)}
                    title={`{{${v.key}}}${v.hint ? ` — ${v.hint}` : ''}`}
                    className="px-2 py-1 rounded-md border border-teal-200 bg-teal-50/60 text-[11.5px] text-teal-800 hover:bg-teal-100"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        <div className="rounded-lg border border-dashed border-slate-300 p-2.5 space-y-2">
          <p className="text-[11px] font-semibold text-slate-600">Variabel baru (isian teks)</p>
          <input className="input" placeholder="Label, mis. Nama instansi" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <input
            className="input font-mono text-xs"
            placeholder="kunci, mis. nama_instansi"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onFocus={() => !newKey && newLabel && setNewKey(newLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))}
          />
          {newKey && !keyValid && <p className="text-[11px] text-rose-600">Kunci harus diawali huruf, hanya huruf kecil/angka/_ dan belum dipakai.</p>}
          <button
            className="btn-secondary btn-sm w-full"
            disabled={!keyValid || !newLabel.trim()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onAddVariable({ key, label: newLabel.trim(), type: 'text' });
              setNewKey('');
              setNewLabel('');
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Tambah & sisipkan
          </button>
          <p className="text-[11px] text-slate-500">Tipe lain (tanggal, pilihan, tabel, …) diatur di tab Variabel.</p>
        </div>
      </div>
    </div>
  );
}

function SignaturePanel({ t, update, master }: { t: Template; update: (p: Partial<Template>) => void; master: Signer[] }) {
  const sig = t.signature;
  const setSig = (patch: Partial<Template['signature']>) => update({ signature: { ...sig, ...patch } });
  const setSlot = (i: number, patch: Partial<Template['signature']['slots'][number]>) =>
    setSig({ slots: sig.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: number) => {
    const list = [...sig.slots];
    const [x] = list.splice(i, 1);
    list.splice(i + d, 0, x);
    setSig({ slots: list });
  };
  return (
    <div className="pb-4">
      <PanelTitle sub="Penandatangan surat diisi saat membuat surat; di sini diatur susunan dan pilihan bawaannya.">Blok tanda tangan</PanelTitle>
      <div className="px-4 space-y-3">
        <div>
          <label className="label">Susunan</label>
          <select className="input" value={sig.layout} onChange={(e) => setSig({ layout: e.target.value as Template['signature']['layout'] })}>
            {Object.entries(LAYOUT_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sig.showPlaceDate} onChange={(e) => setSig({ showPlaceDate: e.target.checked })} />
          Tampilkan &ldquo;Kota, tanggal&rdquo; di atas tanda tangan
        </label>
        {sig.layout !== 'tanpa' &&
          sig.slots.map((slot, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-2.5 space-y-2">
              <div className="flex items-center gap-1">
                <p className="text-xs font-semibold text-slate-700 flex-1">Penandatangan {i + 1}</p>
                <button className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === sig.slots.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 text-slate-400 hover:text-rose-600" onClick={() => setSig({ slots: sig.slots.filter((_, j) => j !== i) })}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input className="input" placeholder='Baris atas, mis. "Mengetahui,"' value={slot.prefix ?? ''} onChange={(e) => setSlot(i, { prefix: e.target.value })} />
              <input className="input" placeholder='Jabatan, mis. "Kepala Klinik,"' value={slot.label} onChange={(e) => setSlot(i, { label: e.target.value })} />
              <select
                className="input"
                value={slot.signerId ?? ''}
                onChange={(e) => {
                  const m = master.find((x) => x.id === Number(e.target.value));
                  setSlot(i, { signerId: m?.id ?? null, signerPosition: m?.position ?? slot.signerPosition });
                }}
              >
                <option value="">Bawaan: {slot.signerPosition ? `jabatan "${slot.signerPosition}"` : 'kosong'}</option>
                {master.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.position}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={slot.showId !== false} onChange={(e) => setSlot(i, { showId: e.target.checked })} />
                Tampilkan NIP/SIP di bawah nama
              </label>
              <p className="text-[11px] text-slate-400">
                Variabel: <code>{`{{ttd_${i + 1}_nama}}`}</code>, <code>{`{{ttd_${i + 1}_jabatan}}`}</code>
              </p>
            </div>
          ))}
        {sig.layout !== 'tanpa' && sig.slots.length < 6 && (
          <button className="btn-secondary btn-sm w-full" onClick={() => setSig({ slots: [...sig.slots, { label: '', signerId: null, showId: true }] })}>
            <Plus className="w-3.5 h-3.5" /> Tambah penandatangan
          </button>
        )}
        {sig.slots.length > 1 && ['kanan', 'kiri', 'tengah'].includes(sig.layout) && (
          <p className="text-[11px] text-amber-700 flex gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Susunan &ldquo;satu&rdquo; hanya menampilkan penandatangan pertama. Pilih &ldquo;Berjajar&rdquo; untuk beberapa.
          </p>
        )}
      </div>
    </div>
  );
}

function VariablesPanel({ t, update, capture }: { t: Template; update: (p: Partial<Template>) => void; capture: () => Template }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const used = useMemo(() => new Set(extractTokens(`${t.customHeaderHtml}${t.bodyHtml}${t.closingHtml}`)), [t]);
  const setVar = (i: number, patch: Partial<VarDef>) => update({ variables: t.variables.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const move = (i: number, d: number) => {
    const list = [...t.variables];
    const [x] = list.splice(i, 1);
    list.splice(i + d, 0, x);
    update({ variables: list });
  };

  const detect = () => {
    const full = capture();
    const tokens = extractTokens(`${full.customHeaderHtml}${full.bodyHtml}${full.closingHtml}`);
    const missing = tokens.filter((k) => !isBuiltinKey(k, full.category) && !full.variables.some((v) => v.key === k) && !dayVarBase(k, full.variables));
    if (!missing.length) return;
    update({
      variables: [...full.variables, ...missing.map((k) => ({ key: k, label: k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), type: 'text' as VarType }))],
    });
  };
  const undefinedTokens = [...used].filter((k) => !isBuiltinKey(k, t.category) && !t.variables.some((v) => v.key === k) && !dayVarBase(k, t.variables));

  return (
    <div className="pb-4">
      <PanelTitle sub="Isian yang muncul di formulir saat staf membuat surat. Variabel tanggal juga menyediakan {{kunci_hari}} untuk nama hari.">
        Variabel template
      </PanelTitle>
      <div className="px-4 space-y-2">
        {undefinedTokens.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11.5px] text-amber-900">
            <p className="font-semibold">Token belum didefinisikan:</p>
            <p className="font-mono">{undefinedTokens.map((k) => `{{${k}}}`).join(' ')}</p>
          </div>
        )}
        <button className="btn-secondary btn-sm w-full" onClick={detect}>
          <Wand2 className="w-3.5 h-3.5" /> Deteksi variabel dari isi template
        </button>
        {t.variables.map((v, i) => {
          const open = openKey === v.key;
          return (
            <div key={i} className="rounded-lg border border-slate-200">
              <button className="w-full flex items-center gap-2 px-2.5 py-2 text-left" onClick={() => setOpenKey(open ? null : v.key)}>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-slate-800 truncate">
                    {v.label}
                    {v.required && <span className="text-rose-600"> *</span>}
                  </span>
                  <span className="block text-[11px] font-mono text-slate-500">
                    {`{{${v.key}}}`} · {VAR_TYPES.find((x) => x.v === v.type)?.label}
                    {!used.has(v.key) && <span className="text-amber-700 font-sans"> · tidak dipakai</span>}
                  </span>
                </span>
              </button>
              {open && (
                <div className="px-2.5 pb-2.5 space-y-2 border-t border-slate-100 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="label">Label</label>
                      <input className="input" value={v.label} onChange={(e) => setVar(i, { label: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Kunci</label>
                      <input
                        className="input font-mono text-xs"
                        value={v.key}
                        onChange={(e) => {
                          setVar(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') });
                          setOpenKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                        }}
                      />
                    </div>
                    <div>
                      <label className="label">Tipe</label>
                      <select className="input" value={v.type} onChange={(e) => setVar(i, { type: e.target.value as VarType })}>
                        {VAR_TYPES.map((x) => (
                          <option key={x.v} value={x.v}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {v.type === 'select' && (
                    <div>
                      <label className="label">Pilihan (satu per baris)</label>
                      <textarea className="input" rows={3} value={(v.options ?? []).join('\n')} onChange={(e) => setVar(i, { options: e.target.value.split('\n') })} />
                    </div>
                  )}
                  {v.type === 'tabel' && (
                    <div>
                      <label className="label">Kolom (pisahkan dengan koma)</label>
                      <input
                        className="input"
                        value={(v.columns ?? []).join(', ')}
                        onChange={(e) => setVar(i, { columns: e.target.value.split(',').map((s) => s.trim()) })}
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Kolom &ldquo;No&rdquo; ditambahkan otomatis. Letakkan token di paragraf sendiri.</p>
                    </div>
                  )}
                  {v.type === 'list' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label">Judul di atas daftar</label>
                        <input className="input" placeholder="mis. Tembusan:" value={v.heading ?? ''} onChange={(e) => setVar(i, { heading: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Penomoran</label>
                        <select className="input" value={v.listStyle ?? 'decimal'} onChange={(e) => setVar(i, { listStyle: e.target.value as VarDef['listStyle'] })}>
                          <option value="decimal">1, 2, 3</option>
                          <option value="lower-alpha">a, b, c</option>
                          <option value="disc">• poin</option>
                          <option value="none">tanpa nomor</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {v.type !== 'tabel' && (
                    <div>
                      <label className="label">Nilai bawaan</label>
                      {v.type === 'list' || v.type === 'textarea' ? (
                        <textarea className="input" rows={2} value={v.default ?? ''} onChange={(e) => setVar(i, { default: e.target.value })} />
                      ) : (
                        <input className="input" type={v.type === 'date' ? 'date' : 'text'} value={v.default ?? ''} onChange={(e) => setVar(i, { default: e.target.value })} />
                      )}
                    </div>
                  )}
                  <div>
                    <label className="label">Petunjuk untuk staf</label>
                    <input className="input" value={v.hint ?? ''} onChange={(e) => setVar(i, { hint: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="flex items-center gap-2 text-xs text-slate-700 flex-1">
                      <input type="checkbox" checked={!!v.required} onChange={(e) => setVar(i, { required: e.target.checked })} /> Wajib diisi sebelum terbit
                    </label>
                    <button className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === t.variables.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 text-slate-400 hover:text-rose-600" onClick={() => update({ variables: t.variables.filter((_, j) => j !== i) })}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button
          className="btn-secondary btn-sm w-full"
          onClick={() => {
            let n = t.variables.length + 1;
            while (t.variables.some((v) => v.key === `isian_${n}`)) n++;
            update({ variables: [...t.variables, { key: `isian_${n}`, label: `Isian ${n}`, type: 'text' }] });
            setOpenKey(`isian_${n}`);
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Tambah variabel
        </button>
      </div>
    </div>
  );
}

function SettingsPanel({
  t,
  update,
  applyPage,
  settings,
}: {
  t: Template;
  update: (p: Partial<Template>) => void;
  applyPage: (p: PageSetup) => void;
  settings: Settings;
}) {
  const page = t.page;
  const setPage = (patch: Partial<PageSetup>) => applyPage({ ...page, ...patch });
  const setMargin = (k: keyof PageSetup['margins'], v: string) => setPage({ margins: { ...page.margins, [k]: Number(v) || 0 } });
  const numberCode = t.numbering.code || t.code;
  const pattern = t.numbering.pattern || settings.pola_nomor || '';

  return (
    <div className="pb-6">
      <PanelTitle>Identitas template</PanelTitle>
      <div className="px-4 space-y-3">
        <div>
          <label className="label">Nama template *</label>
          <input className="input" value={t.name} onChange={(e) => update({ name: e.target.value })} placeholder="mis. Surat Keterangan Sehat" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Kode *</label>
            <input
              className="input font-mono uppercase"
              value={t.code}
              maxLength={20}
              onChange={(e) => update({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
              placeholder="SKS"
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={t.isActive ? '1' : '0'} onChange={(e) => update({ isActive: e.target.value === '1' })}>
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Jenis surat</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <label key={c} className={`p-2 rounded-lg border text-xs cursor-pointer ${t.category === c ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}`}>
                <input type="radio" className="mr-1.5" checked={t.category === c} onChange={() => update({ category: c })} />
                <b>{CATEGORY_INFO[c].label}</b>
                <span className="block text-slate-500 mt-0.5">{CATEGORY_INFO[c].designer}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Keterangan</label>
          <textarea className="input" rows={2} value={t.description ?? ''} onChange={(e) => update({ description: e.target.value })} />
        </div>
      </div>

      <PanelTitle sub="Juga bisa diatur dari tombol Pengaturan halaman di toolbar editor.">Kertas & huruf</PanelTitle>
      <div className="px-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Ukuran kertas</label>
            <select className="input" value={page.pageSize} onChange={(e) => setPage({ pageSize: e.target.value as PageSetup['pageSize'] })}>
              {Object.entries(PAPERS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Orientasi</label>
            <select className="input" value={page.orientation} onChange={(e) => setPage({ orientation: e.target.value as PageSetup['orientation'] })}>
              <option value="portrait">Potret</option>
              <option value="landscape">Lanskap</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Margin (cm): atas · kanan · bawah · kiri</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['top', 'right', 'bottom', 'left'] as const).map((k) => (
              <input key={k} className="input px-2" type="number" step="0.1" min="0" value={page.margins[k]} onChange={(e) => setMargin(k, e.target.value)} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3">
            <label className="label">Huruf</label>
            <select className="input" value={page.fontFamily} onChange={(e) => setPage({ fontFamily: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ukuran (pt)</label>
            <input className="input" type="number" min="6" max="72" step="0.5" value={page.fontSize} onChange={(e) => setPage({ fontSize: Number(e.target.value) || 12 })} />
          </div>
          <div className="col-span-2">
            <label className="label">Spasi baris</label>
            <select className="input" value={page.lineSpacing} onChange={(e) => setPage({ lineSpacing: Number(e.target.value) })}>
              {[1, 1.15, 1.5, 2].map((v) => (
                <option key={v} value={v}>
                  {String(v).replace('.', ',')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <PanelTitle sub="Nomor diambil otomatis saat surat diterbitkan, urut per kode dan per tahun.">Penomoran</PanelTitle>
      <div className="px-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Kode penomoran</label>
            <input
              className="input font-mono uppercase"
              value={t.numbering.code}
              placeholder={t.code || 'sama dengan kode'}
              onChange={(e) => update({ numbering: { ...t.numbering, code: e.target.value.toUpperCase().replace(/[^A-Z0-9.-]/g, '') } })}
            />
          </div>
          <div>
            <label className="label">Pola khusus</label>
            <input
              className="input font-mono text-xs"
              value={t.numbering.pattern}
              placeholder="pakai pola umum"
              onChange={(e) => update({ numbering: { ...t.numbering, pattern: e.target.value } })}
            />
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs">
          <p className="text-slate-500">Contoh nomor pertama:</p>
          <p className="font-mono font-semibold text-slate-900 mt-0.5">
            {previewNumber(pattern, numberCode, settings.kode_instansi || '', Number(settings.digit_nomor) || 3)}
          </p>
          <p className="text-slate-500 mt-1.5">{PATTERN_TOKENS.map(([tok, d]) => `${tok} ${d}`).join(' · ')}</p>
          <p className="text-slate-500 mt-1 flex gap-1">
            <Info className="w-3.5 h-3.5 shrink-0" /> Template dengan kode penomoran yang sama berbagi urutan nomor.
          </p>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({
  open,
  onClose,
  templateId,
  currentVersion,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  templateId: number;
  currentVersion: number;
  onRestored: (t: Template) => void;
}) {
  const toast = useToast();
  const [list, setList] = useState<Array<{ version: number; createdBy: string; createdAt: string }>>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ data: typeof list }>(`/api/template/${templateId}/versi`)
      .then((r) => setList(r.data))
      .catch((err) => toast('error', errorMessage(err)));
  }, [open, templateId, currentVersion, toast]);

  const restore = async () => {
    if (target == null) return;
    setBusy(true);
    try {
      const t = await apiFetch<Template>(`/api/template/${templateId}/versi/${target}/pulihkan`, { method: 'POST' });
      toast('success', `Versi ${target} dipulihkan sebagai versi ${t.version}.`);
      onRestored(t);
      setTarget(null);
      onClose();
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal open={open && target == null} title="Riwayat versi template" onClose={onClose}>
        <p className="text-xs text-slate-500 mb-3">Setiap penyimpanan membuat versi baru. Surat yang sudah dibuat tidak terpengaruh perubahan template.</p>
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {list.map((v) => (
            <li key={v.version} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="font-semibold w-14">v{v.version}</span>
              <span className="flex-1 text-slate-600 text-xs">
                {v.createdBy} · {v.createdAt}
              </span>
              {v.version === currentVersion ? (
                <span className="chip bg-teal-50 text-teal-700 border-teal-200">saat ini</span>
              ) : (
                <button className="btn-secondary btn-sm" onClick={() => setTarget(v.version)}>
                  Pulihkan
                </button>
              )}
            </li>
          ))}
        </ul>
      </Modal>
      <ConfirmModal
        open={target != null}
        title={`Pulihkan versi ${target}?`}
        busy={busy}
        onClose={() => setTarget(null)}
        onConfirm={() => void restore()}
        message={<p>Isi template diganti dengan versi {target} dan disimpan sebagai versi baru. Perubahan yang belum disimpan akan hilang.</p>}
      />
    </>
  );
}
