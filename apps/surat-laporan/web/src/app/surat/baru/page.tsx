'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, FileText, Stethoscope, Building2, ClipboardList, Loader2, Settings2 } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { apiFetch, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Category, TemplateSummary } from '@/lib/types';
import { CATEGORIES, CATEGORY_INFO } from '@/lib/category';

// Galeri template: langkah pertama membuat surat.
export default function NewLetterGallery() {
  const { can } = useAuth();
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'semua' | Category>('semua');

  useEffect(() => {
    apiFetch<{ data: TemplateSummary[] }>('/api/template')
      .then((r) => setTemplates(r.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (templates ?? []).filter(
      (t) =>
        (tab === 'semua' || t.category === tab) &&
        (!term || t.name.toLowerCase().includes(term) || t.code.toLowerCase().includes(term) || (t.description ?? '').toLowerCase().includes(term))
    );
  }, [templates, q, tab]);

  const groups: Array<{ cat: Category; title: string; desc: string; icon: React.ComponentType<{ className?: string }> }> = [
    { cat: 'keluar', title: CATEGORY_INFO.keluar.label, desc: CATEGORY_INFO.keluar.desc, icon: Stethoscope },
    { cat: 'internal', title: CATEGORY_INFO.internal.label, desc: CATEGORY_INFO.internal.desc, icon: Building2 },
    { cat: 'formulir', title: CATEGORY_INFO.formulir.label, desc: CATEGORY_INFO.formulir.desc, icon: ClipboardList },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Buat Surat</h1>
            <p className="text-sm text-slate-500">Pilih template. Isinya bisa disunting bebas di editor setelah dipilih.</p>
          </div>
          {can('template.kelola') && (
            <Link href="/template" className="btn-secondary">
              <Settings2 className="w-4 h-4" /> Kelola template
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
            <input className="input pl-8" placeholder="Cari template…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
            {(['semua', ...CATEGORIES] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 h-8 rounded-md text-sm font-medium ${tab === k ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {k === 'semua' ? 'Semua' : k === 'keluar' ? 'Surat keluar' : CATEGORY_INFO[k].short}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-rose-700">{error}</p>}
        {!templates && !error && (
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat template…
          </p>
        )}

        {groups
          .filter((g) => tab === 'semua' || tab === g.cat)
          .map((g) => {
            const list = shown.filter((t) => t.category === g.cat);
            if (!list.length) return null;
            const Icon = g.icon;
            return (
              <section key={g.cat} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-teal-700" />
                  <h2 className="text-sm font-bold text-slate-800">{g.title}</h2>
                  <span className="text-xs text-slate-500">— {g.desc}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((t) => (
                    <Link
                      key={t.id}
                      href={`/surat/baru/${t.id}`}
                      className="card p-4 hover:border-teal-400 hover:shadow-md transition-all group flex gap-3"
                    >
                      <div className="w-12 h-16 shrink-0 rounded border border-slate-200 bg-white shadow-sm flex flex-col gap-1 p-1.5 group-hover:border-teal-300">
                        <div className="h-1.5 bg-teal-500/70 rounded-sm" />
                        <div className="h-0.5 bg-slate-300" />
                        <div className="h-0.5 bg-slate-200 w-4/5" />
                        <div className="h-0.5 bg-slate-200" />
                        <div className="h-0.5 bg-slate-200 w-3/5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-teal-700">{t.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{t.code}</p>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{t.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

        {templates && shown.length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            Tidak ada template yang cocok.
          </div>
        )}
      </div>
    </AppShell>
  );
}
