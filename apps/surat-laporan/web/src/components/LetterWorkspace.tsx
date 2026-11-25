'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Stamp,
  Printer,
  FileDown,
  RefreshCcw,
  Trash2,
  Loader2,
  AlertTriangle,
  Hash,
  UserRound,
  ListChecks,
  PenLine,
  FileText,
  ChevronDown,
} from 'lucide-react';
import SuratProEditor from './SuratProEditor';
import PatientPicker from './PatientPicker';
import VarField from './VarField';
import LetterView from './LetterView';
import { ConfirmModal } from './Modal';
import { CategoryBadge, StatusBadge } from './Badges';
import { useToast } from './Toast';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, errorMessage } from '@/lib/api';
import { exportDoc, SuratProInstance } from '@/lib/suratpro';
import { usesPatient } from '@/lib/category';
import { applyValues, composeLetter, defaultSigners, defaultValues, kopHtmlFor, missingRequired, resolveValues } from '@/lib/compose';
import { PATIENT_VARS, todayIso } from '@/lib/variables';
import type { Letter, Letterhead, LetterSigner, Patient, Settings, Signer, Template, VarValue } from '@/lib/types';

interface Props {
  /** Surat baru dari template ini. */
  templateId?: number;
  /** Surat yang sudah tersimpan. */
  letterId?: number;
}

interface Loaded {
  template: Template | null;
  letter: Letter | null;
  settings: Settings;
  signers: Signer[];
  letterheads: Letterhead[];
}

export default function LetterWorkspace({ templateId, letterId }: Props) {
  const toast = useToast();
  const { can } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [settings, signers, kop] = await Promise.all([
        apiFetch<Settings>('/api/pengaturan'),
        apiFetch<{ data: Signer[] }>('/api/penandatangan'),
        apiFetch<{ data: Letterhead[] }>('/api/kop'),
      ]);
      let letter: Letter | null = null;
      let tid = templateId;
      if (letterId) {
        letter = await apiFetch<Letter>(`/api/surat/${letterId}`);
        tid = letter.templateId ?? undefined;
      }
      let template: Template | null = null;
      if (tid) {
        try {
          template = await apiFetch<Template>(`/api/template/${tid}`);
        } catch (err) {
          if (!letter) throw err;
          // Template sudah dihapus: surat tetap bisa dibuka dari salinannya.
        }
      }
      setData({ template, letter, settings, signers: signers.data, letterheads: kop.data });
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [templateId, letterId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-lg mx-auto card p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-slate-700">{error}</p>
          <Link href="/surat" className="btn-secondary mt-4">
            Kembali ke arsip
          </Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat surat…
      </div>
    );
  }

  const { letter } = data;
  if (letter && (letter.status !== 'draft' || !can('surat.buat'))) {
    return <LetterView letter={letter} onChanged={load} />;
  }
  if (!data.template) {
    return <LetterView letter={letter as Letter} onChanged={load} />;
  }
  return <Editor key={letter?.id ?? 'baru'} data={data as Loaded & { template: Template }} onIssued={load} toast={toast} />;
}

// ---------------------------------------------------------------------------

const LETTER_FIELD_KEYS: Record<string, string> = { tanggal_surat: 'f-tanggal', perihal: 'f-perihal', tujuan: 'f-tujuan', nomor_surat: 'f-nomor' };

function Editor({
  data,
  onIssued,
  toast,
}: {
  data: Loaded & { template: Template };
  onIssued: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const router = useRouter();
  const { can, user } = useAuth();
  const { template, settings, signers: master, letterheads } = data;
  const defs = template.variables;
  const isKeluar = template.category === 'keluar';
  // Formulir juga boleh memakai data pasien, tetapi tidak wajib.
  const withPatient = usesPatient(template.category);
  const isForm = template.category === 'formulir';

  const [letter, setLetter] = useState<Letter | null>(data.letter);
  const [values, setValues] = useState<Record<string, VarValue>>(() => {
    const base = defaultValues(defs);
    if (!data.letter) {
      // Tanggal kosong diisi hari ini agar surat langsung terbaca utuh.
      for (const d of defs) if (d.type === 'date' && !base[d.key] && d.required) base[d.key] = todayIso();
      return base;
    }
    const { nomor_surat: _n, ...saved } = data.letter.payload ?? {};
    return { ...base, ...saved };
  });
  const [letterDate, setLetterDate] = useState(data.letter?.letterDate ?? todayIso());
  const [subject, setSubject] = useState(data.letter?.subject ?? template.name);
  const [recipient, setRecipient] = useState(data.letter?.recipient ?? '');
  const [patient, setPatient] = useState<Patient | null>(data.letter?.patientSnapshot ?? null);
  const [signers, setSigners] = useState<LetterSigner[]>(() => defaultSigners(template.signature, master, data.letter?.signers));

  const [dirty, setDirty] = useState(!data.letter);
  const [busy, setBusy] = useState<null | 'save' | 'issue' | 'delete'>(null);
  const [confirm, setConfirm] = useState<null | 'issue' | 'rebuild' | 'delete'>(null);
  const [nextNumber, setNextNumber] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const editorRef = useRef<SuratProInstance | null>(null);
  const kopHtml = useMemo(() => kopHtmlFor(template, letterheads), [template, letterheads]);

  const ctx = useMemo(
    () => ({ category: template.category, defs, values, letterDate, subject, recipient, settings, patient, signers }),
    [template.category, defs, values, letterDate, subject, recipient, settings, patient, signers]
  );

  // Konten awal dihitung sekali; perubahan berikutnya lewat applyValues.
  const initialHtml = useMemo(
    () => data.letter?.contentHtml || composeLetter(template, kopHtml, ctx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Formulir berubah → isi penanda di dalam editor diperbarui.
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (applyValues(ed.ed, resolveValues(ctx), defs)) ed.changed();
  }, [ctx, defs]);

  // Perkiraan nomor (belum diambil) untuk ditampilkan.
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ number: string }>(`/api/surat/nomor-berikutnya?templateId=${template.id}&tanggal=${letterDate}`)
      .then((r) => !cancelled && setNextNumber(r.number))
      .catch(() => !cancelled && setNextNumber(null));
    return () => {
      cancelled = true;
    };
  }, [template.id, letterDate]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const body = () => ({
    templateId: template.id,
    letterDate,
    subject,
    recipient,
    patientId: withPatient ? (patient?.id ?? null) : null,
    patientSnapshot: withPatient ? patient : null,
    payload: values,
    contentHtml: editorRef.current?.getContent() ?? initialHtml,
    signers,
  });

  const save = async (silent = false): Promise<Letter | null> => {
    setBusy('save');
    try {
      const saved = letter
        ? await apiFetch<Letter>(`/api/surat/${letter.id}`, { method: 'PUT', body: JSON.stringify(body()) })
        : await apiFetch<Letter>('/api/surat', { method: 'POST', body: JSON.stringify(body()) });
      if (!letter) window.history.replaceState(null, '', `/surat/${saved.id}`);
      setLetter(saved);
      setDirty(false);
      if (!silent) toast('success', 'Draft surat tersimpan.');
      return saved;
    } catch (err) {
      toast('error', errorMessage(err));
      return null;
    } finally {
      setBusy(null);
    }
  };

  // Ctrl+S menyimpan draft.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const missing = missingRequired(defs, values);
  const problems = [
    ...(isKeluar && !patient ? ['Pasien belum dipilih.'] : []),
    ...missing.map((d) => `"${d.label}" belum diisi.`),
    ...signers.map((s, i) => (!s.name.trim() ? `Nama penandatangan ${i + 1} belum diisi.` : '')).filter(Boolean),
  ];

  const issue = async () => {
    setBusy('issue');
    try {
      const saved = dirty || !letter ? await save(true) : letter;
      if (!saved) return;
      setBusy('issue');
      const res = await apiFetch<Letter & { message: string }>(`/api/surat/${saved.id}/terbitkan`, {
        method: 'POST',
        body: JSON.stringify({ contentHtml: editorRef.current?.getContent() }),
      });
      setDirty(false);
      toast('success', res.message);
      setConfirm(null);
      onIssued();
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const rebuild = () => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.setContent(composeLetter(template, kopHtml, ctx));
    ed.ed.querySelectorAll('[data-var]').forEach((el) => el.setAttribute('contenteditable', 'false'));
    setDirty(true);
    setConfirm(null);
    toast('info', 'Surat disusun ulang dari template terbaru.');
  };

  const remove = async () => {
    if (!letter) {
      router.push('/surat/baru');
      return;
    }
    setBusy('delete');
    try {
      await apiFetch(`/api/surat/${letter.id}`, { method: 'DELETE' });
      setDirty(false);
      toast('success', 'Draft dihapus.');
      router.push('/surat');
    } catch (err) {
      toast('error', errorMessage(err));
      setBusy(null);
    }
  };

  const onVarClick = (key: string) => {
    let target = `var-${key}`;
    if (LETTER_FIELD_KEYS[key]) target = LETTER_FIELD_KEYS[key];
    else if (/^ttd_(\d+)_/.test(key)) target = `signer-${/^ttd_(\d+)_/.exec(key)![1]}`;
    else if (PATIENT_VARS.some((v) => v.key === key)) target = 'f-pasien';
    else if (/_hari$/.test(key)) target = `var-${key.slice(0, -5)}`;
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) el.focus({ preventScroll: true });
    }
    setFocusKey(target);
    setTimeout(() => setFocusKey((k) => (k === target ? null : k)), 1600);
  };

  const fileName = `${subject || template.name}${letter?.letterNumber ? ` ${letter.letterNumber}` : ''}`;
  const isOwner = !letter || letter.createdBy === user?.id;

  return (
    <div className="h-full flex flex-col">
      {/* Bilah atas */}
      <div className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center gap-2 px-3">
        <Link href="/surat" className="btn-ghost btn-sm" title="Kembali ke arsip">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-900 truncate">{subject || template.name}</h1>
            <StatusBadge status="draft" />
            {dirty && <span className="text-[11px] text-amber-700">• belum disimpan</span>}
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            {template.name} · template v{letter?.templateVersion ?? template.version}
            {letter ? ` · dibuat ${letter.createdByName ?? ''}` : ''}
          </p>
        </div>
        <button className="btn-ghost btn-sm hidden md:inline-flex" onClick={() => setConfirm('rebuild')} title="Susun ulang dari template">
          <RefreshCcw className="w-4 h-4" /> <span className="hidden xl:inline">Susun ulang</span>
        </button>
        <button className="btn-ghost btn-sm" onClick={() => editorRef.current?.print()} title="Cetak (draft)">
          <Printer className="w-4 h-4" />
        </button>
        <button className="btn-ghost btn-sm" onClick={() => editorRef.current && exportDoc(editorRef.current, fileName)} title="Unduh .doc">
          <FileDown className="w-4 h-4" />
        </button>
        {(isOwner || can('surat.hapus')) && (
          <button className="btn-ghost btn-sm text-rose-600" onClick={() => setConfirm('delete')} title={letter ? 'Hapus draft' : 'Buang'}>
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button className="btn-secondary btn-sm" onClick={() => void save()} disabled={busy !== null}>
          {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
        </button>
        {can('surat.terbitkan') && (
          <button className="btn-primary btn-sm" onClick={() => setConfirm('issue')} disabled={busy !== null}>
            <Stamp className="w-4 h-4" /> Terbitkan
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Panel isian */}
        <aside className="w-[360px] shrink-0 bg-white border-r border-slate-200 overflow-y-auto hidden md:block">
          <Section icon={FileText} title="Data surat">
            <div className="flex items-center gap-2">
              <CategoryBadge category={template.category} />
            </div>
            <Field id="f-nomor" label="Nomor surat" focus={focusKey}>
              <div id="f-nomor" className="h-9 px-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm flex items-center gap-2 text-slate-600">
                <Hash className="w-3.5 h-3.5" />
                {nextNumber ? (
                  <span>
                    Otomatis saat terbit · perkiraan <b className="text-slate-800">{nextNumber}</b>
                  </span>
                ) : (
                  'Otomatis saat diterbitkan'
                )}
              </div>
            </Field>
            <Field id="f-tanggal" label="Tanggal surat" focus={focusKey}>
              <input id="f-tanggal" type="date" className="input" value={letterDate} onChange={(e) => touch(setLetterDate)(e.target.value)} />
            </Field>
            <Field id="f-perihal" label="Perihal / judul" focus={focusKey}>
              <input id="f-perihal" className="input" value={subject} onChange={(e) => touch(setSubject)(e.target.value)} />
            </Field>
            {!isForm && (
            <Field id="f-tujuan" label="Tujuan / kepada" focus={focusKey}>
              <input
                id="f-tujuan"
                className="input"
                value={recipient}
                placeholder={isKeluar ? 'mis. RSUD Sayang Cianjur' : 'mis. Kepala Bagian Umum'}
                onChange={(e) => touch(setRecipient)(e.target.value)}
              />
            </Field>
            )}
          </Section>

          {withPatient && (
            <Section icon={UserRound} title={isForm ? 'Pasien (opsional)' : 'Pasien'} id="f-pasien" focus={focusKey}>
              <PatientPicker value={patient} onChange={touch(setPatient)} />
              {isForm && (
                <p className="text-[11px] text-slate-500">Tanpa pasien, isian data diri dicetak titik-titik untuk ditulis tangan.</p>
              )}
              <p className="text-[11px] text-slate-500">Data pasien diambil dari data induk portal; yang disimpan di surat hanya ID dan salinan ringkasnya.</p>
            </Section>
          )}

          {defs.length > 0 && (
            <Section icon={ListChecks} title="Isian surat">
              {defs.map((d) => (
                <VarField
                  key={d.key}
                  def={d}
                  value={values[d.key]}
                  highlight={focusKey === `var-${d.key}`}
                  onChange={(v) => {
                    setValues((prev) => ({ ...prev, [d.key]: v }));
                    setDirty(true);
                  }}
                />
              ))}
            </Section>
          )}

          {signers.length > 0 && (
            <Section icon={PenLine} title="Penandatangan">
              {signers.map((s, i) => {
                const slot = template.signature.slots[i];
                const update = (patch: Partial<LetterSigner>) => {
                  setSigners((list) => list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  setDirty(true);
                };
                return (
                  <div
                    key={i}
                    id={`signer-${i + 1}`}
                    className={`rounded-lg border p-2.5 space-y-2 transition-colors ${focusKey === `signer-${i + 1}` ? 'border-teal-400 bg-teal-50' : 'border-slate-200'}`}
                  >
                    <p className="text-xs font-semibold text-slate-700">
                      {i + 1}. {[slot?.prefix, slot?.label].filter(Boolean).join(' ') || 'Penandatangan'}
                    </p>
                    <select
                      className="input"
                      value={s.signerId ?? ''}
                      onChange={(e) => {
                        const m = master.find((x) => x.id === Number(e.target.value));
                        update(
                          m
                            ? { signerId: m.id, name: m.name, role: m.position, idLabel: m.idLabel ?? '', idNumber: m.idNumber ?? '' }
                            : { signerId: null }
                        );
                      }}
                    >
                      <option value="">— isi manual —</option>
                      {master.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.position}
                        </option>
                      ))}
                    </select>
                    <input className="input" placeholder="Nama lengkap & gelar" value={s.name} onChange={(e) => update({ name: e.target.value, signerId: null })} />
                    <input className="input" placeholder="Jabatan" value={s.role} onChange={(e) => update({ role: e.target.value })} />
                    <div className="flex gap-2">
                      <input className="input w-20" placeholder="NIP" value={s.idLabel} onChange={(e) => update({ idLabel: e.target.value })} />
                      <input className="input flex-1" placeholder="Nomor" value={s.idNumber} onChange={(e) => update({ idNumber: e.target.value })} />
                    </div>
                  </div>
                );
              })}
            </Section>
          )}
          <p className="px-4 pb-6 text-[11px] text-slate-500">
            Klik teks berwarna di surat untuk melompat ke isiannya. Bagian lain surat bisa diketik langsung di editor seperti di Word.
          </p>
        </aside>

        {/* Editor */}
        <div className="flex-1 min-w-0">
          <SuratProEditor
            initialContent={initialHtml}
            fileName={fileName}
            onReady={(ed) => {
              editorRef.current = ed;
              if (applyValues(ed.ed, resolveValues(ctx), defs)) ed.changed();
            }}
            onChange={() => setDirty(true)}
            onVarClick={onVarClick}
          />
        </div>
      </div>

      <ConfirmModal
        open={confirm === 'issue'}
        title="Terbitkan surat?"
        busy={busy === 'issue'}
        confirmLabel={problems.length ? 'Tetap terbitkan' : 'Terbitkan & ambil nomor'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void issue()}
        message={
          <>
            <p>
              Nomor surat diambil sekarang{nextNumber ? (
                <>
                  {' '}
                  (perkiraan <b>{nextNumber}</b>)
                </>
              ) : null}{' '}
              dan isi surat <b>dikunci</b>. Perubahan setelah terbit hanya bisa lewat duplikat.
            </p>
            {problems.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-900 text-xs">
                <p className="font-semibold mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Periksa dulu:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        }
      />
      <ConfirmModal
        open={confirm === 'rebuild'}
        title="Susun ulang dari template?"
        onClose={() => setConfirm(null)}
        onConfirm={rebuild}
        confirmLabel="Susun ulang"
        message={<p>Isi editor diganti dengan template terbaru beserta isian formulir saat ini. Suntingan manual di editor akan hilang.</p>}
      />
      <ConfirmModal
        open={confirm === 'delete'}
        title={letter ? 'Hapus draft?' : 'Buang surat ini?'}
        danger
        busy={busy === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => void remove()}
        confirmLabel={letter ? 'Hapus draft' : 'Buang'}
        message={<p>{letter ? 'Draft surat ini dihapus permanen.' : 'Surat belum disimpan dan akan dibuang.'}</p>}
      />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  id,
  focus,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  id?: string;
  focus?: string | null;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section id={id} className={`border-b border-slate-200 transition-colors ${id && focus === id ? 'bg-teal-50' : ''}`}>
      <button className="w-full flex items-center gap-2 px-4 py-3 text-left" onClick={() => setOpen(!open)}>
        <Icon className="w-4 h-4 text-teal-700" />
        <span className="text-xs font-bold uppercase tracking-wide text-slate-700 flex-1">{title}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </section>
  );
}

function Field({ id, label, children, focus }: { id: string; label: string; children: React.ReactNode; focus: string | null }) {
  return (
    <div className={`rounded-lg transition-colors ${focus === id ? 'bg-teal-50 ring-2 ring-teal-400/60 -mx-1.5 px-1.5 py-1' : ''}`}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
    </div>
  );
}
