'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PortalShell from '@/components/PortalShell';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { Patient, PatientSearchResult } from '@/lib/types';
import {
  Search,
  Loader2,
  UserPlus,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Users,
  X,
  AlertCircle,
} from 'lucide-react';

const PAGE_SIZE = 20;

const emptyForm = {
  nik: '',
  fullName: '',
  gender: 'Laki-laki',
  birthPlace: '',
  birthDate: '',
  phoneWa: '',
  email: '',
  address: '',
  occupation: '',
  maritalStatus: 'Tidak Diketahui',
  bloodType: '',
  allergy: '',
};

type PatientForm = typeof emptyForm;

// Halaman ini adalah data induk: satu pasien = satu baris, dipakai bersama
// semua aplikasi klinik. Karena itu NIK dijaga unik oleh layanan identitas,
// dan pesan bentroknya ditampilkan apa adanya agar staf mencari pasien yang
// sudah ada alih-alih membuat baris kedua.
export default function PatientsPage() {
  const { token, hasRole } = useAuth();
  const { success, error: toastError } = useToast();

  const [rows, setRows] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientForm>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canEdit = hasRole('Superadmin', 'Dokter', 'Administrasi');

  // Ketikan tidak langsung dikirim ke server: mengetik NIK 16 digit akan
  // menghasilkan belasan permintaan yang semuanya tidak terpakai.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setOffset(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (debouncedQuery) params.set('q', debouncedQuery);

      const res = await apiFetch<PatientSearchResult>(`/api/patients?${params.toString()}`, { token });
      setRows(res.data);
      setTotal(res.total);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Gagal memuat data pasien.');
      setRows([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [token, offset, debouncedQuery, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (patient: Patient) => {
    setEditing(patient);
    setForm({
      nik: patient.nik ?? '',
      fullName: patient.fullName,
      gender: patient.gender || 'Laki-laki',
      birthPlace: patient.birthPlace ?? '',
      birthDate: patient.birthDate ?? '',
      phoneWa: patient.phoneWa ?? '',
      email: patient.email ?? '',
      address: patient.address ?? '',
      occupation: patient.occupation ?? '',
      maritalStatus: patient.maritalStatus ?? 'Tidak Diketahui',
      bloodType: patient.bloodType ?? '',
      allergy: patient.allergy ?? '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const payload = useMemo(() => {
    // Field kosong tidak dikirim: layanan identitas memperlakukan field yang
    // tidak ada sebagai "jangan diubah", sehingga menghapus isi sebuah field
    // harus disengaja lewat nilai kosong pada field yang memang diisi.
    const body: Record<string, string> = {
      fullName: form.fullName.trim(),
      gender: form.gender,
    };
    for (const key of [
      'nik',
      'birthPlace',
      'birthDate',
      'phoneWa',
      'email',
      'address',
      'occupation',
      'maritalStatus',
      'bloodType',
      'allergy',
    ] as const) {
      const value = form[key].trim();
      if (value) body[key] = value;
    }
    return body;
  }, [form]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!form.fullName.trim()) {
      setFormError('Nama lengkap wajib diisi.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await apiFetch(`/api/patients/${editing.id}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(payload),
        });
        success(`Data ${payload.fullName} berhasil diperbarui.`);
      } else {
        await apiFetch('/api/patients', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        success(`Pasien ${payload.fullName} berhasil ditambahkan.`);
      }
      setIsFormOpen(false);
      await load();
    } catch (err) {
      // Pesan dari layanan identitas sudah menjelaskan penyebabnya (mis. NIK
      // sudah terdaftar) — jangan diganti dengan pesan umum.
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data pasien.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <PortalShell
      title="Data Pasien"
      subtitle="Satu data induk pasien untuk seluruh aplikasi klinik — hindari pencatatan ganda."
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari NIK 16 digit, nama, atau nomor WhatsApp…"
            aria-label="Cari pasien"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent placeholder-slate-400"
          />
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-portal-600 hover:bg-portal-700 text-white text-sm font-semibold shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Pasien Baru
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-portal-600" />
            <span className="text-sm font-medium">Memuat data pasien…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">
              {debouncedQuery ? 'Pasien tidak ditemukan' : 'Belum ada data pasien'}
            </p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              {debouncedQuery
                ? 'Periksa kembali ejaan nama atau NIK yang Anda masukkan.'
                : 'Data pasien dari SIMKlinik dapat diimpor lewat skrip impor di portal/identity-service.'}
            </p>
          </div>
        ) : (
          <>
            {/* Tabel untuk layar lebar; di layar kecil daftar kartu di bawah. */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">NIK</th>
                    <th className="px-4 py-3">L/P</th>
                    <th className="px-4 py-3">Umur</th>
                    <th className="px-4 py-3">WhatsApp</th>
                    <th className="px-4 py-3">Sumber</th>
                    {canEdit && <th className="px-4 py-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((patient) => (
                    <tr key={patient.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{patient.fullName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {patient.nik || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {patient.gender === 'Laki-laki' ? 'L' : patient.gender === 'Perempuan' ? 'P' : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {patient.age !== null ? `${patient.age} th` : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {patient.phoneWa || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {patient.sourceApp || <span className="text-slate-400">—</span>}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openEdit(patient)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-portal-700 hover:text-portal-900 px-2.5 py-1.5 rounded-lg hover:bg-portal-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Ubah
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Daftar kartu untuk ponsel */}
            <ul className="md:hidden divide-y divide-slate-100">
              {rows.map((patient) => (
                <li key={patient.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{patient.fullName}</p>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        {patient.nik || 'NIK belum diisi'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {patient.gender}
                        {patient.age !== null && ` · ${patient.age} th`}
                        {patient.phoneWa && ` · ${patient.phoneWa}`}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => openEdit(patient)}
                        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-portal-700 px-2.5 py-1.5 rounded-lg border border-portal-200"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Ubah
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between gap-3 mt-4 text-sm text-slate-600">
          <span>
            Menampilkan <span className="font-semibold text-slate-900">{rows.length}</span> dari{' '}
            <span className="font-semibold text-slate-900">{total}</span> pasien
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Sebelumnya
            </button>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold disabled:opacity-40"
            >
              Berikutnya
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="font-bold text-slate-900">
                  {editing ? 'Ubah Data Pasien' : 'Pasien Baru'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing
                    ? `ID ${editing.id} · perubahan berlaku untuk semua aplikasi klinik`
                    : 'Data ini menjadi acuan identitas pasien di seluruh aplikasi klinik'}
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Tutup formulir"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4">
              {formError && (
                <div className="mb-4 flex items-start gap-2 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nama Lengkap" required className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    placeholder="Sesuai kartu identitas"
                    className={inputClass}
                  />
                </Field>

                <Field label="NIK" hint="16 digit, boleh dikosongkan bila belum ada">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={16}
                    value={form.nik}
                    onChange={(e) => setForm({ ...form, nik: e.target.value.replace(/\D/g, '') })}
                    placeholder="16 digit angka"
                    className={`${inputClass} font-mono`}
                  />
                </Field>

                <Field label="Jenis Kelamin" required>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className={inputClass}
                  >
                    <option>Laki-laki</option>
                    <option>Perempuan</option>
                    <option>Lainnya</option>
                  </select>
                </Field>

                <Field label="Tempat Lahir">
                  <input
                    type="text"
                    value={form.birthPlace}
                    onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Tanggal Lahir" hint="Menentukan umur pada laporan">
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Nomor WhatsApp">
                  <input
                    type="tel"
                    value={form.phoneWa}
                    onChange={(e) => setForm({ ...form, phoneWa: e.target.value })}
                    placeholder="08xx xxxx xxxx"
                    className={inputClass}
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Alamat" className="sm:col-span-2">
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Pekerjaan">
                  <input
                    type="text"
                    value={form.occupation}
                    onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Status Pernikahan">
                  <select
                    value={form.maritalStatus}
                    onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                    className={inputClass}
                  >
                    <option>Belum Kawin</option>
                    <option>Kawin</option>
                    <option>Cerai Hidup</option>
                    <option>Cerai Mati</option>
                    <option>Tidak Diketahui</option>
                  </select>
                </Field>

                <Field label="Golongan Darah">
                  <input
                    type="text"
                    value={form.bloodType}
                    onChange={(e) => setForm({ ...form, bloodType: e.target.value })}
                    placeholder="A / B / AB / O"
                    className={inputClass}
                  />
                </Field>

                <Field label="Riwayat Alergi">
                  <input
                    type="text"
                    value={form.allergy}
                    onChange={(e) => setForm({ ...form, allergy: e.target.value })}
                    placeholder="Bila ada"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-portal-600 hover:bg-portal-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Simpan Pasien'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}

const inputClass =
  'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-portal-600 focus:border-transparent placeholder-slate-400';

function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
