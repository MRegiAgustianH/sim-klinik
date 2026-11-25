'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, FilePlus2, Loader2, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { StatusBadge } from '@/components/Badges';
import { apiFetch, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateId } from '@/lib/variables';
import type { LetterSummary, TemplateSummary } from '@/lib/types';
import { CATEGORY_INFO } from '@/lib/category';

interface Filters {
  q: string;
  status: string;
  category: string;
  templateId: string;
  from: string;
  to: string;
  mine: string;
}

const EMPTY: Filters = { q: '', status: '', category: '', templateId: '', from: '', to: '', mine: '' };

// Arsip & pencarian surat: per jenis, template, rentang tanggal, dan status.
export default function ArchivePage() {
  const router = useRouter();
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ total: number; limit: number; data: LetterSummary[] } | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Filter awal dari URL, mis. /surat?status=draft&mine=1 dari beranda.
    const params = new URLSearchParams(window.location.search);
    setFilters((f) => ({
      ...f,
      status: params.get('status') ?? '',
      mine: params.get('mine') ?? '',
      templateId: params.get('templateId') ?? '',
      category: params.get('category') ?? '',
    }));
    apiFetch<{ data: TemplateSummary[] }>('/api/template?semua=1')
      .then((r) => setTemplates(r.data))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      setResult(await apiFetch(`/api/surat?${params}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), filters.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };
  const pages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Arsip Surat</h1>
            <p className="text-sm text-slate-500">{result ? `${result.total} surat` : 'Memuat…'}</p>
          </div>
          {can('surat.buat') && (
            <Link href="/surat/baru" className="btn-primary">
              <FilePlus2 className="w-4 h-4" /> Buat surat
            </Link>
          )}
        </div>

        <div className="card p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
            <input className="input pl-8" placeholder="Nomor, perihal, tujuan, nama pasien…" value={filters.q} onChange={set('q')} />
          </div>
          <select className="input" value={filters.category} onChange={set('category')}>
            <option value="">Semua jenis</option>
            <option value="keluar">Surat keluar (pasien)</option>
            <option value="internal">Surat internal</option>
            <option value="formulir">Formulir</option>
          </select>
          <select className="input" value={filters.templateId} onChange={set('templateId')}>
            <option value="">Semua template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select className="input" value={filters.status} onChange={set('status')}>
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="terbit">Terbit</option>
            <option value="batal">Dibatalkan</option>
          </select>
          <input className="input" type="date" value={filters.from} onChange={set('from')} title="Dari tanggal" />
          <input className="input" type="date" value={filters.to} onChange={set('to')} title="Sampai tanggal" />
          <label className="flex items-center gap-2 text-sm text-slate-600 lg:col-span-7">
            <input
              type="checkbox"
              checked={filters.mine === '1'}
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, mine: e.target.checked ? '1' : '' }));
              }}
            />
            Hanya surat buatan saya
            {Object.values(filters).some(Boolean) && (
              <button className="ml-auto text-xs text-teal-700 hover:underline" onClick={() => setFilters(EMPTY)}>
                Hapus filter
              </button>
            )}
          </label>
        </div>

        {error && <p className="text-sm text-rose-700">{error}</p>}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 text-left">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Tanggal</th>
                  <th className="px-3 py-2.5 font-semibold">Nomor</th>
                  <th className="px-3 py-2.5 font-semibold">Perihal</th>
                  <th className="px-3 py-2.5 font-semibold">Pasien / tujuan</th>
                  <th className="px-3 py-2.5 font-semibold">Jenis</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {result?.data.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100 hover:bg-teal-50/40 cursor-pointer" onClick={() => router.push(`/surat/${l.id}`)}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{formatDateId(l.letterDate)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">{l.letterNumber ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-900">{l.subject}</p>
                      <p className="text-xs text-slate-500">{l.templateName}</p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{l.patientSnapshot?.fullName ?? l.recipient ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{CATEGORY_INFO[l.category]?.short ?? l.category}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{l.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && !result && (
            <p className="p-6 text-sm text-slate-500 flex items-center gap-2 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
            </p>
          )}
          {result && result.data.length === 0 && (
            <div className="p-10 text-center text-sm text-slate-500">
              <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Belum ada surat yang cocok.
            </div>
          )}
          {result && pages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 text-sm">
              <span className="text-slate-500">
                Halaman {page} dari {pages}
              </span>
              <div className="flex gap-1">
                <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
