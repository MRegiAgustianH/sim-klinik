'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FilePlus2, FileClock, Stamp, Stethoscope, Building2, ClipboardList, LayoutTemplate, ArrowRight } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { StatusBadge } from '@/components/Badges';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateId } from '@/lib/variables';
import type { LetterSummary } from '@/lib/types';

interface Stats {
  total: number;
  draft: number;
  myDraft: number;
  issuedThisMonth: number;
  keluar: number;
  internal: number;
  formulir?: number;
  templates: number;
  topTemplates: Array<{ templateId: number; templateName: string; n: number }>;
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<LetterSummary[]>([]);

  useEffect(() => {
    apiFetch<Stats>('/api/surat/ringkasan').then(setStats).catch(() => undefined);
    apiFetch<{ data: LetterSummary[] }>('/api/surat?limit=8')
      .then((r) => setRecent(r.data))
      .catch(() => undefined);
  }, []);

  const cards = [
    { label: 'Draft saya', value: stats?.myDraft, icon: FileClock, href: '/surat?status=draft&mine=1', tone: 'text-amber-700 bg-amber-50' },
    { label: 'Terbit bulan ini', value: stats?.issuedThisMonth, icon: Stamp, href: '/surat?status=terbit', tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Surat keluar', value: stats?.keluar, icon: Stethoscope, href: '/surat?category=keluar', tone: 'text-sky-700 bg-sky-50' },
    { label: 'Surat internal', value: stats?.internal, icon: Building2, href: '/surat?category=internal', tone: 'text-violet-700 bg-violet-50' },
    { label: 'Formulir', value: stats?.formulir, icon: ClipboardList, href: '/surat?category=formulir', tone: 'text-amber-700 bg-amber-50' },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Halo, {user?.fullName}</h1>
            <p className="text-sm text-slate-500">Surat keluar, surat internal, dan formulir klinik dari satu tempat.</p>
          </div>
          {can('surat.buat') && (
            <Link href="/surat/baru" className="btn-primary h-10">
              <FilePlus2 className="w-4 h-4" /> Buat surat baru
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link key={c.label} href={c.href} className="card p-4 hover:border-teal-300 transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.tone}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-3">{c.value ?? '–'}</p>
                <p className="text-xs text-slate-500">{c.label}</p>
              </Link>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">Surat terbaru</h2>
              <Link href="/surat" className="text-xs text-teal-700 hover:underline flex items-center gap-1">
                Semua arsip <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <ul>
              {recent.map((l) => (
                <li key={l.id} className="border-b border-slate-100 last:border-0">
                  <Link href={`/surat/${l.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{l.subject}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {l.letterNumber ?? 'Belum bernomor'} · {formatDateId(l.letterDate)}
                        {l.patientSnapshot ? ` · ${l.patientSnapshot.fullName}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={l.status} />
                  </Link>
                </li>
              ))}
              {recent.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-500">Belum ada surat.</li>}
            </ul>
          </div>

          <div className="card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">Sering dipakai</h2>
              <LayoutTemplate className="w-4 h-4 text-slate-400" />
            </div>
            <ul className="p-2">
              {(stats?.topTemplates ?? []).map((t) => (
                <li key={t.templateId}>
                  <Link
                    href={can('surat.buat') ? `/surat/baru/${t.templateId}` : `/surat?templateId=${t.templateId}`}
                    className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-slate-50 text-sm"
                  >
                    <span className="truncate text-slate-800">{t.templateName}</span>
                    <span className="text-xs text-slate-500">{t.n}×</span>
                  </Link>
                </li>
              ))}
              {stats && stats.topTemplates.length === 0 && (
                <li className="px-2 py-6 text-center text-xs text-slate-500">
                  {stats.templates} template siap dipakai.{' '}
                  <Link href="/surat/baru" className="text-teal-700 hover:underline">
                    Lihat
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
