'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Search, Loader2, UserRound, X } from 'lucide-react';
import { apiFetch, errorMessage } from '@/lib/api';
import type { Patient } from '@/lib/types';
import { formatDateId } from '@/lib/variables';

// Pencarian pasien di data induk (layanan identitas). Sistem surat tidak
// menyimpan tabel pasien; yang disimpan hanya patientId dan salinan ringkas.
export default function PatientPicker({
  value,
  onChange,
  disabled,
}: {
  value: Patient | null;
  onChange: (p: Patient | null) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      setBusy(true);
      setError(null);
      apiFetch<{ data: Patient[] }>(`/api/pasien?q=${encodeURIComponent(q.trim())}`)
        .then((res) => setResults(res.data ?? []))
        .catch((err) => setError(errorMessage(err)))
        .finally(() => setBusy(false));
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q]);

  if (value) {
    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3">
        <div className="flex items-start gap-2">
          <UserRound className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-semibold text-slate-900 truncate">{value.fullName}</p>
            <p className="text-xs text-slate-600">NIK {value.nik || '-'}</p>
            <p className="text-xs text-slate-600">
              {[value.birthPlace, formatDateId(value.birthDate)].filter(Boolean).join(', ') || 'Tanggal lahir belum diisi'}
              {value.age != null ? ` · ${value.age} th` : ''}
            </p>
          </div>
          {!disabled && (
            <button className="p-1 rounded hover:bg-white text-slate-500" onClick={() => onChange(null)} title="Ganti pasien">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
        <input
          className="input pl-8"
          placeholder="Cari nama atau NIK pasien…"
          value={q}
          disabled={disabled}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {busy && <Loader2 className="w-4 h-4 absolute right-2.5 top-2.5 animate-spin text-slate-400" />}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {error && <p className="p-3 text-xs text-rose-700">{error}</p>}
          {!error && !busy && results.length === 0 && (
            <p className="p-3 text-xs text-slate-500">Pasien tidak ditemukan. Pasien baru didaftarkan dari SIMKlinik atau menu Pasien di portal.</p>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
              onClick={() => {
                onChange(p);
                setQ('');
                setOpen(false);
              }}
            >
              <p className="text-sm font-medium text-slate-900">{p.fullName}</p>
              <p className="text-xs text-slate-500">
                NIK {p.nik || '-'} · {formatDateId(p.birthDate) || 'tgl lahir -'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
