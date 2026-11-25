'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Save, Loader2, Building2, Hash, ListOrdered } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { useToast } from '@/components/Toast';
import { apiFetch, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PATTERN_TOKENS, previewNumber } from '@/lib/numbering';
import type { Settings } from '@/lib/types';

const CLINIC_FIELDS: Array<[string, string, string?]> = [
  ['klinik_nama', 'Nama klinik'],
  ['klinik_alamat', 'Alamat'],
  ['klinik_kota', 'Kota (untuk "Kota, tanggal")'],
  ['klinik_telepon', 'Telepon'],
  ['klinik_email', 'Email'],
  ['klinik_website', 'Situs web'],
];

interface Counter {
  code: string;
  year: number;
  lastSeq: number;
}

export default function SettingsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [counter, setCounter] = useState<Counter>({ code: '', year: new Date().getFullYear(), lastSeq: 0 });

  const loadCounters = useCallback(() => {
    apiFetch<{ data: Counter[] }>('/api/pengaturan/penomoran')
      .then((r) => setCounters(r.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiFetch<Settings>('/api/pengaturan')
      .then(setS)
      .catch((err) => toast('error', errorMessage(err)));
    loadCounters();
  }, [toast, loadCounters]);

  const save = async () => {
    if (!s) return;
    setBusy(true);
    try {
      setS(await apiFetch<Settings>('/api/pengaturan', { method: 'PUT', body: JSON.stringify(s) }));
      toast('success', 'Pengaturan tersimpan.');
    } catch (err) {
      toast('error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveCounter = async () => {
    try {
      const r = await apiFetch<{ data: Counter[] }>('/api/pengaturan/penomoran', { method: 'PUT', body: JSON.stringify(counter) });
      setCounters(r.data);
      toast('success', `Nomor berikutnya untuk ${counter.code.toUpperCase()} ${counter.year}: ${counter.lastSeq + 1}.`);
    } catch (err) {
      toast('error', errorMessage(err));
    }
  };

  if (!can('template.kelola')) {
    return (
      <AppShell>
        <p className="p-8 text-sm text-slate-600">Akun Anda belum diberi izin mengubah pengaturan.</p>
      </AppShell>
    );
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setS((prev) => ({ ...(prev ?? {}), [key]: e.target.value }));

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Pengaturan</h1>
            <p className="text-sm text-slate-500">Data klinik untuk variabel surat dan aturan penomoran.</p>
          </div>
          <button className="btn-primary" onClick={() => void save()} disabled={!s || busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
          </button>
        </div>

        {!s ? (
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
          </p>
        ) : (
          <>
            <section className="card p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-700" /> Data klinik
              </h2>
              <p className="text-xs text-slate-500">Dipakai variabel {'{{klinik_nama}}'}, {'{{klinik_alamat}}'}, dan seterusnya di kop maupun isi surat.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {CLINIC_FIELDS.map(([key, label]) => (
                  <div key={key} className={key === 'klinik_alamat' ? 'sm:col-span-2' : ''}>
                    <label className="label">{label}</label>
                    <input className="input" value={s[key] ?? ''} onChange={set(key)} />
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Hash className="w-4 h-4 text-teal-700" /> Pola nomor surat
              </h2>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="label">Pola umum</label>
                  <input className="input font-mono" value={s.pola_nomor ?? ''} onChange={set('pola_nomor')} />
                </div>
                <div>
                  <label className="label">Digit nomor urut</label>
                  <select className="input" value={s.digit_nomor ?? '3'} onChange={set('digit_nomor')}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} ({String(1).padStart(n, '0')})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Kode instansi {'{instansi}'}</label>
                  <input className="input font-mono" value={s.kode_instansi ?? ''} onChange={set('kode_instansi')} />
                </div>
                <div className="sm:col-span-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
                  <p className="text-slate-500">Contoh (template kode SKS):</p>
                  <p className="font-mono font-semibold text-slate-900">{previewNumber(s.pola_nomor, 'SKS', s.kode_instansi, Number(s.digit_nomor) || 3)}</p>
                  <p className="text-slate-500 mt-1">{PATTERN_TOKENS.map(([t, d]) => `${t} ${d}`).join(' · ')}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">Template bisa memakai pola khusus sendiri (Template → Halaman & nomor).</p>
            </section>

            <section className="card p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-teal-700" /> Penghitung nomor
              </h2>
              <p className="text-xs text-slate-500">
                Nomor urut terakhir per kode dan tahun. Atur bila mulai memakai sistem di tengah tahun, mis. nomor manual terakhir 045 → isi 45. Tidak bisa
                diatur lebih kecil dari nomor yang sudah terpakai.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="label">Kode</label>
                  <input className="input w-32 font-mono uppercase" value={counter.code} onChange={(e) => setCounter({ ...counter, code: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="label">Tahun</label>
                  <input className="input w-24" type="number" value={counter.year} onChange={(e) => setCounter({ ...counter, year: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Nomor terakhir</label>
                  <input className="input w-28" type="number" min="0" value={counter.lastSeq} onChange={(e) => setCounter({ ...counter, lastSeq: Number(e.target.value) })} />
                </div>
                <button className="btn-secondary" disabled={!counter.code.trim()} onClick={() => void saveCounter()}>
                  Atur
                </button>
              </div>
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-xs text-slate-600 text-left">
                  <tr>
                    <th className="px-3 py-2">Kode</th>
                    <th className="px-3 py-2">Tahun</th>
                    <th className="px-3 py-2">Nomor terakhir</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {counters.map((c) => (
                    <tr key={`${c.code}-${c.year}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono">{c.code}</td>
                      <td className="px-3 py-2">{c.year}</td>
                      <td className="px-3 py-2">{c.lastSeq}</td>
                      <td className="px-3 py-2 text-right">
                        <button className="text-xs text-teal-700 hover:underline" onClick={() => setCounter(c)}>
                          Ubah
                        </button>
                      </td>
                    </tr>
                  ))}
                  {counters.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-xs text-slate-500">
                        Belum ada surat terbit.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
