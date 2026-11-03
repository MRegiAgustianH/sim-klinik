'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { apiFetch, getApiBaseUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import SyncAndQrPanel from '@/components/SyncAndQrPanel';
import ConfirmModal from '@/components/ConfirmModal';
import {
  Users,
  Search,
  Filter,
  Plus,
  FileDown,
  Eye,
  CheckSquare,
  Syringe,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Baby,
  Edit,
  ShieldAlert,
  Printer,
  ChevronDown,
} from 'lucide-react';

interface PatientRecord {
  id: number;
  nik: string;
  fullName: string;
  gender: 'Laki-laki' | 'Perempuan';
  birthPlace: string;
  birthDate: string;
  email: string | null;
  address: string;
  phoneWa: string;
  occupation: string | null;
  maritalStatus: string | null;
  vaccineType: string;
  plannedDate: string;
  plannedTime: string;
  doctorApproval: 'Disetujui' | 'Ditolak' | 'Menunggu Persetujuan';
  doctorNotes: string | null;
  status: 'Selesai' | 'Belum';
  doctorName: string | null;
  nurseName: string | null;
  adminName: string | null;
  notes: string | null;
  infoSource: string | null;
  icvNumber: string | null;
  monthYear: string;
  pregnancyTestResult: 'Negatif' | 'Positif' | 'Tidak Dilakukan';
  batchNumber: string | null;
  vaccinatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VaccineStockItem {
  id: number;
  vaccineName: string;
  batchNumber: string;
  currentStock: number;
  expiryDate: string;
}

const COMMON_VACCINES = [
  'Meningitis Meningokokus ACYW-135',
  'Yellow Fever (Demam Kuning)',
  'Polio Oral (bOPV / IPV)',
  'Influenza Kuadrivalen',
  'Hepatitis B Dewasa',
  'Hepatitis A Dewasa',
  'Tifoid (Toxoid)',
  'Rabies (VAR)',
  'Human Papillomavirus (HPV)',
  'COVID-19 Booster',
];

const INFO_SOURCES = [
  'Rekomendasi Agen Travel/Umroh',
  'Media Sosial',
  'Website Rumah Sakit',
  'Teman/Keluarga',
  'Brosur/Spanduk',
  'Instansi/Perusahaan Tempat Bekerja',
  'Lainnya',
];

function formatDateIndo(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

export default function PatientsPage() {
  const { user, hasRole } = useAuth();
  const { success, error: toastError, warning } = useToast();

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [availableStocks, setAvailableStocks] = useState<VaccineStockItem[]>([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [vaccineFilter, setVaccineFilter] = useState('all');
  const [pregnancyFilter, setPregnancyFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<PatientRecord | null>(null);
  // Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const initialFormState = {
    nik: '',
    fullName: '',
    gender: 'Laki-laki' as 'Laki-laki' | 'Perempuan',
    birthPlace: '',
    birthDate: '1995-01-01',
    email: '',
    address: '',
    phoneWa: '',
    occupation: '',
    maritalStatus: 'Kawin',
    vaccineType: COMMON_VACCINES[0],
    plannedDate: todayStr,
    plannedTime: '08:30 WIB',
    doctorApproval: 'Menunggu Persetujuan' as 'Disetujui' | 'Ditolak' | 'Menunggu Persetujuan',
    doctorNotes: '',
    status: 'Belum' as 'Selesai' | 'Belum',
    doctorName: '',
    nurseName: '',
    adminName: user?.fullName || 'Petugas Registrasi',
    notes: '',
    infoSource: INFO_SOURCES[0],
    icvNumber: '',
    pregnancyTestResult: 'Tidak Dilakukan' as 'Negatif' | 'Positif' | 'Tidak Dilakukan',
    batchNumber: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  // Approval Form State (Doctor)
  const [doctorDecision, setDoctorDecision] = useState<'Disetujui' | 'Ditolak'>('Disetujui');
  const [doctorNotesInput, setDoctorNotesInput] = useState('');

  // Complete Vaccination Form State (Nurse)
  const [completeBatch, setCompleteBatch] = useState('');
  const [completeIcv, setCompleteIcv] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');

  const fetchPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (searchTerm.trim()) queryParams.append('search', searchTerm.trim());
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      if (approvalFilter !== 'all') queryParams.append('doctorApproval', approvalFilter);
      if (vaccineFilter !== 'all') queryParams.append('vaccineType', vaccineFilter);
      if (pregnancyFilter !== 'all') queryParams.append('pregnancyTestResult', pregnancyFilter);
      if (monthFilter.trim()) queryParams.append('month', monthFilter.trim());
      queryParams.append('limit', '100');

      const res = await apiFetch<{ total: number; data: PatientRecord[] }>(
        `/api/patients?${queryParams.toString()}`
      );
      setPatients(res.data);
      setTotalCount(res.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data pasien.';
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, statusFilter, approvalFilter, vaccineFilter, pregnancyFilter, monthFilter, toastError]);

  const fetchVaccineStocks = async () => {
    try {
      const stocks = await apiFetch<VaccineStockItem[]>('/api/stock/vaccines');
      setAvailableStocks(stocks.filter((s) => s.currentStock > 0));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchVaccineStocks();
  }, [fetchPatients]);

  // Handle Form Submit (Add or Edit)
  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nik || formData.nik.length !== 16) {
      warning('NIK harus terdiri dari 16 digit angka.');
      return;
    }

    if (!formData.fullName.trim()) {
      warning('Nama lengkap pasien wajib diisi.');
      return;
    }

    try {
      if (isEditing && selectedPatient) {
        await apiFetch(`/api/patients/${selectedPatient.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
        success('Data pasien berhasil diperbarui.');
      } else {
        await apiFetch('/api/patients', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
        success('Registrasi pasien baru berhasil disimpan.');
      }

      setIsAddModalOpen(false);
      setIsEditing(false);
      setSelectedPatient(null);
      setFormData(initialFormState);
      fetchPatients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan data pasien.';
      toastError(msg);
    }
  };

  // Open Edit Form
  const handleOpenEdit = (p: PatientRecord) => {
    setSelectedPatient(p);
    setIsEditing(true);
    setFormData({
      nik: p.nik,
      fullName: p.fullName,
      gender: p.gender,
      birthPlace: p.birthPlace,
      birthDate: p.birthDate,
      email: p.email || '',
      address: p.address,
      phoneWa: p.phoneWa,
      occupation: p.occupation || '',
      maritalStatus: p.maritalStatus || 'Kawin',
      vaccineType: p.vaccineType,
      plannedDate: p.plannedDate,
      plannedTime: p.plannedTime,
      doctorApproval: p.doctorApproval,
      doctorNotes: p.doctorNotes || '',
      status: p.status,
      doctorName: p.doctorName || '',
      nurseName: p.nurseName || '',
      adminName: p.adminName || user?.fullName || 'Admin',
      notes: p.notes || '',
      infoSource: p.infoSource || INFO_SOURCES[0],
      icvNumber: p.icvNumber || '',
      pregnancyTestResult: p.pregnancyTestResult,
      batchNumber: p.batchNumber || '',
    });
    setIsAddModalOpen(true);
  };

  // Handle Doctor Approval Submit
  const handleDoctorApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (selectedPatient.pregnancyTestResult === 'Positif' && doctorDecision === 'Disetujui' && !doctorNotesInput.trim()) {
      warning('Pasien dalam kondisi hamil (Tes WUS Positif). Dokter wajib menuliskan catatan telaah medis/kontraindikasi.');
      return;
    }

    try {
      await apiFetch(`/api/patients/${selectedPatient.id}/doctor-approval`, {
        method: 'PUT',
        body: JSON.stringify({
          doctorApproval: doctorDecision,
          doctorNotes: doctorNotesInput.trim(),
          doctorName: user?.fullName || 'Dokter Pemeriksa',
        }),
      });
      success(`Status persetujuan dokter berhasil diperbarui menjadi '${doctorDecision}'.`);
      setIsApprovalModalOpen(false);
      setSelectedPatient(null);
      fetchPatients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui persetujuan dokter.';
      toastError(msg);
    }
  };

  // Handle Complete Vaccination Submit (Nurse)
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    if (!completeBatch.trim()) {
      warning('Nomor batch vaksin wajib ditentukan sebelum menyelesaikan vaksinasi.');
      return;
    }

    try {
      await apiFetch(`/api/patients/${selectedPatient.id}/complete`, {
        method: 'PUT',
        body: JSON.stringify({
          batchNumber: completeBatch.trim(),
          icvNumber: completeIcv.trim() || undefined,
          nurseName: user?.fullName || 'Perawat Pelaksana',
          notes: completeNotes.trim() || undefined,
        }),
      });
      success('Tindakan vaksinasi berhasil diselesaikan. Stok vaksin & buku ICV otomatis diperbarui.');
      setIsCompleteModalOpen(false);
      setSelectedPatient(null);
      fetchPatients();
      fetchVaccineStocks();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyelesaikan vaksinasi.';
      toastError(msg);
    }
  };

  // Handle Delete Patient with Custom Modal
  const confirmDeletePatient = async () => {
    if (!patientToDelete) return;
    try {
      await apiFetch(`/api/patients/${patientToDelete.id}`, { method: 'DELETE' });
      success(`Data pasien ${patientToDelete.fullName} berhasil dihapus.`);
      setPatientToDelete(null);
      fetchPatients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus data pasien.';
      toastError(msg);
    }
  };

  // Download PDF Kartu Vaksinasi Pasien
  const handleDownloadPdf = async (id: number) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vaksinku_token') : '';
      const url = `${getApiBaseUrl()}/api/export/patient/${id}/pdf`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vaksinku_token') : '';
      window.open(`${getApiBaseUrl()}/api/export/patient/${id}/pdf?token=${token}`, '_blank');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-teal-700" />
              Data Laporan Vaksinasi & Pasien
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Pencatatan lengkap 22 parameter rekam vaksinasi, persetujuan dokter, skrining WUS, dan nomor buku kuning ICV
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasRole('Superadmin', 'Perawat', 'Dokter') && (
              <button
                onClick={() => {
                  setIsEditing(false);
                  setSelectedPatient(null);
                  setFormData(initialFormState);
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrasi Pasien Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Panel Registrasi Mandiri QR Code & Sinkronisasi GForm */}
        <SyncAndQrPanel onSyncSuccess={fetchPatients} />
        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-2 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Cari NIK, Nama, WA, atau No ICV..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900 placeholder-slate-400"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white text-slate-800 cursor-pointer"
              >
                <option value="all">Semua Status Vaksin</option>
                <option value="Selesai">Status: Selesai</option>
                <option value="Belum">Status: Belum</option>
              </select>
            </div>

            {/* Persetujuan Dokter Filter */}
            <div>
              <select
                value={approvalFilter}
                onChange={(e) => setApprovalFilter(e.target.value)}
                className="block w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white text-slate-800 cursor-pointer"
              >
                <option value="all">Semua Persetujuan Dokter</option>
                <option value="Disetujui">dr: Disetujui</option>
                <option value="Ditolak">dr: Ditolak</option>
                <option value="Menunggu Persetujuan">dr: Menunggu</option>
              </select>
            </div>

            {/* Tes Kehamilan WUS Filter */}
            <div>
              <select
                value={pregnancyFilter}
                onChange={(e) => setPregnancyFilter(e.target.value)}
                className="block w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white text-slate-800 cursor-pointer"
              >
                <option value="all">Semua Skrining WUS</option>
                <option value="Negatif">WUS: Negatif</option>
                <option value="Positif">WUS: Positif (Hamil)</option>
                <option value="Tidak Dilakukan">WUS: Tidak Dilakukan</option>
              </select>
            </div>

            {/* Filter Bulan */}
            <div>
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="block w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white text-slate-800 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              Menampilkan <strong>{patients.length}</strong> dari <strong>{totalCount}</strong> total rekam vaksinasi
            </span>
            {(searchTerm || statusFilter !== 'all' || approvalFilter !== 'all' || pregnancyFilter !== 'all' || monthFilter) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setApprovalFilter('all');
                  setVaccineFilter('all');
                  setPregnancyFilter('all');
                  setMonthFilter('');
                }}
                className="text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Tabel Pasien Utama */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5 text-center">No</th>
                  <th className="py-3 px-3.5">NIK / Nama Pasien</th>
                  <th className="py-3 px-3.5">TTL / Kontak</th>
                  <th className="py-3 px-3.5">Jenis Vaksin</th>
                  <th className="py-3 px-3.5">Jadwal Kunjungan</th>
                  <th className="py-3 px-3.5 text-center">Skrining WUS</th>
                  <th className="py-3 px-3.5 text-center">Persetujuan dr</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5">No ICV</th>
                  <th className="py-3 px-3.5 text-center">Aksi Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500 font-medium">
                      Memuat data pasien vaksinasi...
                    </td>
                  </tr>
                ) : patients.length > 0 ? (
                  patients.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3.5 text-center text-slate-500 font-mono">
                        {idx + 1}
                      </td>

                      {/* NIK & Nama */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 text-sm">{p.fullName}</div>
                        <div className="font-mono text-slate-600 text-[11px] flex items-center gap-1.5 mt-0.5">
                          <span>{p.nik}</span>
                          <span className="text-slate-400">({p.gender === 'Laki-laki' ? 'L' : 'P'})</span>
                        </div>
                      </td>

                      {/* TTL & Kontak */}
                      <td className="py-3 px-3.5 text-slate-600">
                        <div>{p.birthPlace}, {formatDateIndo(p.birthDate)}</div>
                        <div className="text-[11px] font-mono text-teal-700 mt-0.5">{p.phoneWa}</div>
                      </td>

                      {/* Vaksin & Batch */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-800">{p.vaccineType}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Batch: {p.batchNumber || '-'}
                        </div>
                      </td>

                      {/* Tanggal & Jam */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{p.plannedDate}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {p.plannedTime}
                        </div>
                      </td>

                      {/* Skrining WUS */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {p.pregnancyTestResult === 'Positif' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <Baby className="w-3 h-3" /> Positif (Hamil)
                          </span>
                        )}
                        {p.pregnancyTestResult === 'Negatif' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Negatif
                          </span>
                        )}
                        {p.pregnancyTestResult === 'Tidak Dilakukan' && (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Persetujuan dr */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {p.doctorApproval === 'Disetujui' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Disetujui
                          </span>
                        )}
                        {p.doctorApproval === 'Ditolak' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Ditolak
                          </span>
                        )}
                        {p.doctorApproval === 'Menunggu Persetujuan' && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Menunggu dr
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {p.status === 'Selesai' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-amber-500" /> Belum
                          </span>
                        )}
                      </td>

                      {/* No ICV */}
                      <td className="py-3 px-3.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {p.icvNumber || '-'}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Detail Modal */}
                          <button
                            onClick={() => {
                              setSelectedPatient(p);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            title="Lihat Detail Pasien & Rekam Medis"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Tombol Validasi Dokter (Khusus Dokter & Superadmin) */}
                          {hasRole('Dokter', 'Superadmin') && (
                            <button
                              onClick={() => {
                                setSelectedPatient(p);
                                setDoctorDecision(p.doctorApproval === 'Ditolak' ? 'Ditolak' : 'Disetujui');
                                setDoctorNotesInput(p.doctorNotes || '');
                                setIsApprovalModalOpen(true);
                              }}
                              className="p-1.5 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              title="Validasi & Telaah Dokter"
                            >
                              <CheckSquare className="w-4 h-4" />
                            </button>
                          )}

                          {/* Tombol Tindakan Vaksinasi (Khusus Perawat & Superadmin) */}
                          {hasRole('Perawat', 'Superadmin') && p.status === 'Belum' && (
                            <button
                              onClick={() => {
                                setSelectedPatient(p);
                                setCompleteBatch(p.batchNumber || (availableStocks[0]?.batchNumber || ''));
                                setCompleteIcv(p.icvNumber || '');
                                setCompleteNotes(p.notes || '');
                                setIsCompleteModalOpen(true);
                              }}
                              className="p-1.5 rounded text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                              title="Tindakan Vaksinasi & Potong Stok"
                            >
                              <Syringe className="w-4 h-4" />
                            </button>
                          )}

                          {/* Cetak PDF Kartu Vaksinasi */}
                          <button
                            onClick={() => handleDownloadPdf(p.id)}
                            className="p-1.5 rounded text-teal-600 hover:text-teal-800 hover:bg-teal-50"
                            title="Unduh / Cetak Kartu Bukti Vaksinasi (PDF)"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          {/* Edit Data Umum */}
                          {hasRole('Superadmin', 'Perawat', 'Dokter') && (
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                              title="Ubah Data Pasien"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Hapus Pasien (Khusus Superadmin) */}
                          {hasRole('Superadmin') && (
                            <button
                              onClick={() => setPatientToDelete(p)}
                              className="p-1.5 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                              title="Hapus Rekam Vaksinasi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      Tidak ada data pasien yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODAL 1: FORM TAMBAH / UBAH PASIEN (LENGKAP 22 FIELD)       */}
        {/* ============================================================ */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsAddModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col z-10 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-teal-800 text-white">
                <div>
                  <h2 className="text-base font-bold">
                    {isEditing ? 'Ubah Data Pasien & Rekam Vaksinasi' : 'Registrasi Pasien Baru & Rencana Vaksinasi'}
                  </h2>
                  <p className="text-xs text-teal-100">
                    Formulir lengkap parameter medis, skrining WUS, jadwal klinik, dan buku ICV
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-teal-700/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePatient} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-xs">
                {/* 1. DATA PRIBADI & DEMOGRAFI */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800 pb-1.5 border-b border-teal-100 mb-3">
                    I. Data Identitas Pribadi Pasien
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* NIK */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        NIK (16 Digit) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={16}
                        required
                        value={formData.nik}
                        onChange={(e) => setFormData({ ...formData, nik: e.target.value.replace(/\D/g, '') })}
                        placeholder="Contoh: 3201015504920002"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono text-slate-900"
                      />
                    </div>

                    {/* Nama Lengkap */}
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nama Lengkap Pasien <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="Masukkan nama lengkap sesuai KTP / Paspor"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900 font-medium"
                      />
                    </div>

                    {/* Jenis Kelamin */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Jenis Kelamin <span className="text-rose-600">*</span>
                      </label>
                      <select
                        value={formData.gender}
                        onChange={(e) => {
                          const val = e.target.value as 'Laki-laki' | 'Perempuan';
                          setFormData({
                            ...formData,
                            gender: val,
                            pregnancyTestResult: val === 'Laki-laki' ? 'Tidak Dilakukan' : formData.pregnancyTestResult,
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white text-slate-900"
                      >
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>

                    {/* Tempat Lahir */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Tempat Lahir <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.birthPlace}
                        onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                        placeholder="Kota / Kabupaten Lahir"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>

                    {/* Tanggal Lahir */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Tanggal Lahir <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.birthDate}
                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>

                    {/* Pekerjaan */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Pekerjaan</label>
                      <input
                        type="text"
                        value={formData.occupation}
                        onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                        placeholder="Pekerjaan / Profesi"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>

                    {/* Status Pernikahan */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Status Pernikahan</label>
                      <select
                        value={formData.maritalStatus}
                        onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white text-slate-900"
                      >
                        <option value="Belum Kawin">Belum Kawin</option>
                        <option value="Kawin">Kawin</option>
                        <option value="Cerai Hidup">Cerai Hidup</option>
                        <option value="Cerai Mati">Cerai Mati</option>
                      </select>
                    </div>

                    {/* Nomor WA */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nomor WhatsApp Aktif <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.phoneWa}
                        onChange={(e) => setFormData({ ...formData, phoneWa: e.target.value })}
                        placeholder="Contoh: 081234567890"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono text-slate-900"
                      />
                    </div>

                    {/* Email Aktif */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email Aktif</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@example.com"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>

                    {/* Sumber Informasi */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Sumber Informasi</label>
                      <select
                        value={formData.infoSource}
                        onChange={(e) => setFormData({ ...formData, infoSource: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white text-slate-900"
                      >
                        {INFO_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Alamat Lengkap */}
                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Alamat Lengkap <span className="text-rose-600">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Jalan, Nomor, RT/RW, Kelurahan, Kecamatan, Kota/Kabupaten"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. DETAIL VAKSINASI, JADWAL & SKRINING WUS */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800 pb-1.5 border-b border-teal-100 mb-3">
                    II. Rencana Vaksinasi, Kunjungan & Skrining WUS
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Jenis Vaksin */}
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Jenis Vaksin <span className="text-rose-600">*</span>
                      </label>
                      <select
                        value={formData.vaccineType}
                        onChange={(e) => setFormData({ ...formData, vaccineType: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white text-slate-900 font-semibold"
                      >
                        {COMMON_VACCINES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Nomor Batch (Opsional jika baru rencana) */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nomor Batch Vaksin</label>
                      <input
                        type="text"
                        value={formData.batchNumber}
                        onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                        placeholder="Contoh: MEN-2026-X1"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono text-slate-900"
                      />
                    </div>

                    {/* Rencana Tanggal Berkunjung */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Rencana Tanggal Berkunjung ke Klinik <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.plannedDate}
                        onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>

                    {/* Rencana Jam Berkunjung */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Rencana Jam Berkunjung ke Klinik <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.plannedTime}
                        onChange={(e) => setFormData({ ...formData, plannedTime: e.target.value })}
                        placeholder="Contoh: 09:00 WIB"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>

                    {/* Hasil Tes Kehamilan WUS */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Hasil Tes Kehamilan pada WUS
                      </label>
                      <select
                        disabled={formData.gender === 'Laki-laki'}
                        value={formData.pregnancyTestResult}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pregnancyTestResult: e.target.value as 'Negatif' | 'Positif' | 'Tidak Dilakukan',
                          })
                        }
                        className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white font-semibold ${
                          formData.pregnancyTestResult === 'Positif'
                            ? 'border-rose-400 bg-rose-50 text-rose-900'
                            : 'border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="Tidak Dilakukan">Tidak Dilakukan (Bukan WUS / Pria)</option>
                        <option value="Negatif">Negatif (Aman Divaksinasi)</option>
                        <option value="Positif">Positif (Hamil - Perhatian Khusus)</option>
                      </select>
                      {formData.pregnancyTestResult === 'Positif' && (
                        <p className="text-[10px] text-rose-600 font-bold mt-1">
                          Perhatian: Vaksin hidup (Yellow Fever, dll) dikontraindikasikan pada kehamilan.
                        </p>
                      )}
                    </div>

                    {/* Nomor Buku Kuning ICV */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nomor Buku Kuning (ICV)
                      </label>
                      <input
                        type="text"
                        value={formData.icvNumber}
                        onChange={(e) => setFormData({ ...formData, icvNumber: e.target.value })}
                        placeholder="Contoh: ICV-ID-2026-0012"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 font-mono text-slate-900"
                      />
                    </div>

                    {/* Status Vaksinasi */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Status Vaksinasi</label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value as 'Selesai' | 'Belum' })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white text-slate-900 font-semibold"
                      >
                        <option value="Belum">Belum Vaksinasi</option>
                        <option value="Selesai">Selesai Vaksinasi</option>
                      </select>
                    </div>

                    {/* Persetujuan Dokter */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Persetujuan Dokter</label>
                      <select
                        value={formData.doctorApproval}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            doctorApproval: e.target.value as 'Disetujui' | 'Ditolak' | 'Menunggu Persetujuan',
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 bg-white text-slate-900 font-semibold"
                      >
                        <option value="Menunggu Persetujuan">Menunggu Persetujuan</option>
                        <option value="Disetujui">Disetujui</option>
                        <option value="Ditolak">Ditolak</option>
                      </select>
                    </div>

                    {/* Petugas Terkait */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nama Dokter</label>
                      <input
                        type="text"
                        value={formData.doctorName}
                        onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                        placeholder="dr. Penanggungjawab"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nama Perawat</label>
                      <input
                        type="text"
                        value={formData.nurseName}
                        onChange={(e) => setFormData({ ...formData, nurseName: e.target.value })}
                        placeholder="Ns. Pelaksana"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nama Petugas Admin</label>
                      <input
                        type="text"
                        value={formData.adminName}
                        onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                        placeholder="Admin Registrasi"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>

                    {/* Catatan Dokter */}
                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-slate-700 mb-1">Catatan Medis Dokter</label>
                      <textarea
                        rows={2}
                        value={formData.doctorNotes}
                        onChange={(e) => setFormData({ ...formData, doctorNotes: e.target.value })}
                        placeholder="Kondisi tanda vital, telaah medis, riwayat alergi, rekomendasi dokter..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>

                    {/* Keterangan Tambahan */}
                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-slate-700 mb-1">Keterangan Tambahan</label>
                      <textarea
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Tujuan perjalanan (Umroh / Haji / Kedinasan), negara tujuan, catatan khusus..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold shadow-xs cursor-pointer"
                  >
                    {isEditing ? 'Perbarui Data Pasien' : 'Simpan Data Pasien'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 2: DETAIL PASIEN & REKAM MEDIS LENGKAP                 */}
        {/* ============================================================ */}
        {isDetailModalOpen && selectedPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsDetailModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col z-10 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Eye className="w-4 h-4 text-teal-400" />
                    Detail Lengkap Pasien & Rekam Vaksinasi
                  </h2>
                  <p className="text-xs text-slate-400">
                    ID Pasien: #{selectedPatient.id} | Bulan Laporan: {selectedPatient.monthYear}
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
                {/* Status Banners */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border bg-slate-50 text-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Persetujuan Dokter</span>
                    <span className="font-bold text-sm mt-0.5 block">{selectedPatient.doctorApproval}</span>
                    <span className="text-[11px] text-slate-500">{selectedPatient.doctorName || 'dr. -'}</span>
                  </div>

                  <div className="p-3 rounded-lg border bg-slate-50 text-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Status Vaksinasi</span>
                    <span className="font-bold text-sm mt-0.5 block text-teal-700">{selectedPatient.status}</span>
                    <span className="text-[11px] text-slate-500">{selectedPatient.nurseName || 'Ns. -'}</span>
                  </div>

                  <div className="p-3 rounded-lg border bg-slate-50 text-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Buku Kuning (ICV)</span>
                    <span className="font-bold text-sm font-mono mt-0.5 block text-slate-900">
                      {selectedPatient.icvNumber || '-'}
                    </span>
                    <span className="text-[11px] text-slate-500">Nomor Sertifikat Internasional</span>
                  </div>
                </div>

                {/* Data Pasien Grid */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-teal-800">
                    Identitas Demografi
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[11px]">NIK</span>
                      <span className="font-mono font-bold text-slate-900">{selectedPatient.nik}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Nama Lengkap</span>
                      <span className="font-bold text-slate-900">{selectedPatient.fullName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Jenis Kelamin</span>
                      <span className="text-slate-800">{selectedPatient.gender}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">TTL</span>
                      <span className="text-slate-800">{selectedPatient.birthPlace}, {formatDateIndo(selectedPatient.birthDate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Nomor WhatsApp</span>
                      <span className="font-mono text-teal-700 font-bold">{selectedPatient.phoneWa}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Email Aktif</span>
                      <span className="text-slate-800">{selectedPatient.email || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Pekerjaan</span>
                      <span className="text-slate-800">{selectedPatient.occupation || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Status Pernikahan</span>
                      <span className="text-slate-800">{selectedPatient.maritalStatus || '-'}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-4">
                      <span className="text-slate-400 block text-[11px]">Alamat Lengkap</span>
                      <span className="text-slate-800">{selectedPatient.address}</span>
                    </div>
                  </div>
                </div>

                {/* Rekam Medis & Tindakan */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-teal-800">
                    Rekam Vaksinasi & Telaah Dokter
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Jenis Vaksin</span>
                      <span className="font-bold text-slate-900">{selectedPatient.vaccineType}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Nomor Batch Vaksin</span>
                      <span className="font-mono font-bold text-slate-900">{selectedPatient.batchNumber || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Hasil Tes Kehamilan WUS</span>
                      <span className="font-bold text-slate-900">{selectedPatient.pregnancyTestResult}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Rencana Kunjungan</span>
                      <span className="text-slate-800">{selectedPatient.plannedDate} pukul {selectedPatient.plannedTime}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Sumber Informasi</span>
                      <span className="text-slate-800">{selectedPatient.infoSource || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Admin Registrasi</span>
                      <span className="text-slate-800">{selectedPatient.adminName || '-'}</span>
                    </div>
                    <div className="sm:col-span-3">
                      <span className="text-slate-400 block text-[11px]">Catatan Dokter</span>
                      <p className="text-slate-800 bg-white p-2.5 rounded border border-slate-200 mt-1">
                        {selectedPatient.doctorNotes || 'Belum ada catatan dokter.'}
                      </p>
                    </div>
                    <div className="sm:col-span-3">
                      <span className="text-slate-400 block text-[11px]">Keterangan Tambahan</span>
                      <p className="text-slate-800 bg-white p-2.5 rounded border border-slate-200 mt-1">
                        {selectedPatient.notes || 'Tidak ada keterangan tambahan.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(selectedPatient.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Kartu Vaksinasi Resmi (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 3: VALIDASI & TELAAH DOKTER (DOKTER & SUPERADMIN)      */}
        {/* ============================================================ */}
        {isApprovalModalOpen && selectedPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsApprovalModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col z-10 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-blue-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">Telaah & Persetujuan Medis Dokter</h2>
                  <p className="text-xs text-blue-200">
                    Pasien: {selectedPatient.fullName} (NIK: {selectedPatient.nik})
                  </p>
                </div>
                <button
                  onClick={() => setIsApprovalModalOpen(false)}
                  className="p-1.5 rounded-lg text-blue-200 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleDoctorApprovalSubmit} className="p-5 space-y-4 text-xs">
                {/* Info Ringkas Medis */}
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-1">
                  <p className="font-semibold text-blue-950">Vaksin Diminta: {selectedPatient.vaccineType}</p>
                  <p className="text-blue-900">
                    Skrining Tes Kehamilan (WUS):{' '}
                    <strong
                      className={selectedPatient.pregnancyTestResult === 'Positif' ? 'text-rose-700' : 'text-slate-800'}
                    >
                      {selectedPatient.pregnancyTestResult}
                    </strong>
                  </p>
                  {selectedPatient.pregnancyTestResult === 'Positif' && (
                    <div className="mt-1 flex items-start gap-1.5 text-rose-800 font-bold bg-rose-50 p-2 rounded border border-rose-200">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                      <span>
                        Peringatan Klinis: Pasien terkonfirmasi hamil. Vaksin virus hidup seperti Yellow Fever tidak direkomendasikan kecuali risiko infeksi darurat yang tak terhindarkan.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">
                    Keputusan Dokter Penanggung Jawab <span className="text-rose-600">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDoctorDecision('Disetujui')}
                      className={`p-3 rounded-lg border font-bold text-center cursor-pointer transition-colors ${
                        doctorDecision === 'Disetujui'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Disetujui (Fit to Vaccinate)
                    </button>

                    <button
                      type="button"
                      onClick={() => setDoctorDecision('Ditolak')}
                      className={`p-3 rounded-lg border font-bold text-center cursor-pointer transition-colors ${
                        doctorDecision === 'Ditolak'
                          ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Ditolak (Kontraindikasi Medis)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">
                    Catatan Medis & Telaah Dokter {doctorDecision === 'Ditolak' && <span className="text-rose-600">*</span>}
                  </label>
                  <textarea
                    rows={4}
                    required={doctorDecision === 'Ditolak'}
                    value={doctorNotesInput}
                    onChange={(e) => setDoctorNotesInput(e.target.value)}
                    placeholder="Tuliskan telaah klinis, kondisi tanda vital, riwayat komorbid, atau alasan penolakan medis..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsApprovalModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs"
                  >
                    Simpan Keputusan Dokter
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 4: TINDAKAN VAKSINASI & POTONG STOK (PERAWAT)           */}
        {/* ============================================================ */}
        {isCompleteModalOpen && selectedPatient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsCompleteModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col z-10 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-emerald-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">Tindakan Vaksinasi & Penerbitan ICV</h2>
                  <p className="text-xs text-emerald-200">
                    Pasien: {selectedPatient.fullName} | Vaksin: {selectedPatient.vaccineType}
                  </p>
                </div>
                <button
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="p-1.5 rounded-lg text-emerald-200 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCompleteSubmit} className="p-5 space-y-4 text-xs">
                {selectedPatient.doctorApproval !== 'Disetujui' && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>
                      Peringatan: Pasien belum disetujui dokter (Status saat ini: {selectedPatient.doctorApproval}).
                    </span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Pilih Nomor Batch Vaksin (Mengurangi Stok) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={completeBatch}
                    onChange={(e) => setCompleteBatch(e.target.value)}
                    placeholder="Contoh: MEN-2026-X1"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Stok vaksin terkait akan otomatis berkurang 1 dosis pada sistem inventaris.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nomor Seri Buku Kuning ICV (Opsional / Jika Diterbitkan)
                  </label>
                  <input
                    type="text"
                    value={completeIcv}
                    onChange={(e) => setCompleteIcv(e.target.value)}
                    placeholder="Contoh: ICV-ID-2026-0015"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Jika diisi, inventaris buku kuning ICV akan otomatis terpotong 1 buku.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Catatan Tindakan Pelaksana</label>
                  <textarea
                    rows={2}
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    placeholder="Lokasi penyuntikan (Deltoid Kiri/Kanan), reaksi pasca suntik (KIPI), edukasi..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-900"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCompleteModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={selectedPatient.doctorApproval !== 'Disetujui'}
                    className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    Selesaikan Vaksinasi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Pasien (Bukan Alert Localhost) */}
        <ConfirmModal
          isOpen={!!patientToDelete}
          title="Konfirmasi Hapus Pasien"
          message={`Apakah Anda yakin ingin menghapus data rekam vaksinasi pasien ${patientToDelete?.fullName} (NIK: ${patientToDelete?.nik})? Data yang sudah dihapus tidak dapat dipulihkan.`}
          confirmText="Ya, Hapus Pasien"
          cancelText="Batal"
          onConfirm={confirmDeletePatient}
          onCancel={() => setPatientToDelete(null)}
        />
      </div>
    </AppShell>
  );
}
