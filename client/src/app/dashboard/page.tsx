'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Syringe,
  BookOpen,
  ArrowUpRight,
  RefreshCw,
  Baby,
  Stethoscope,
  ChevronRight,
  ShieldAlert,
  Package,
} from 'lucide-react';

interface MetricsData {
  today: {
    date: string;
    totalPatients: number;
    completed: number;
    pending: number;
    approved: number;
    rejected: number;
    waitingApproval: number;
    patientsList: Array<{
      id: number;
      nik: string;
      fullName: string;
      gender: string;
      plannedTime: string;
      vaccineType: string;
      status: string;
      doctorApproval: string;
      pregnancyTestResult: string;
      icvNumber: string | null;
    }>;
  };
  monthly: {
    monthYear: string;
    totalPatients: number;
    completed: number;
    pending: number;
  };
  vaccineDistribution: Array<{
    vaccineType: string;
    count: number;
    percentage: number;
  }>;
  pregnancyTestSummary: {
    totalWus: number;
    negative: number;
    positive: number;
    notDone: number;
    records: Array<{
      id: number;
      nik: string;
      fullName: string;
      birthDate: string;
      plannedDate: string;
      vaccineType: string;
      pregnancyTestResult: string;
      doctorApproval: string;
      doctorNotes: string | null;
    }>;
  };
  stockOverview: {
    totalVaccineTypes: number;
    totalVaccineDoses: number;
    depletingVaccinesCount: number;
    expiredVaccinesCount: number;
    icvTotalStock: number;
    icvUsedStock: number;
    icvRemainingStock: number;
    vaccineAlerts: Array<{
      id: number;
      vaccineName: string;
      batchNumber: string;
      currentStock: number;
      expiryDate: string;
      status: string;
    }>;
  };
  monthlyTrend: Array<{
    month: string;
    total: number;
    completed: number;
  }>;
}

export default function DashboardPage() {
  const { error: toastError } = useToast();
  const [data, setData] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.substring(0, 7));

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch<MetricsData>(
        `/api/dashboard/metrics?date=${selectedDate}&month=${selectedMonth}`
      );
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data dashboard.';
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, selectedMonth, toastError]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Dashboard Laporan & Monitoring
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Monitoring jadwal harian, rekapitulasi bulanan, skrining WUS, dan ketersediaan logistik vaksin
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
              <Calendar className="w-4 h-4 text-slate-400" />
              <label htmlFor="filter-date" className="font-semibold text-slate-700">Tanggal:</label>
              <input
                id="filter-date"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedMonth(e.target.value.substring(0, 7));
                }}
                className="font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={fetchMetrics}
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Segarkan data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* 1. KARTU STATISTIK RINGKASAN UTAMA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pasien Hari Ini */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pasien Hari Ini</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                {data?.today.totalPatients ?? 0}
              </span>
              <span className="text-xs text-slate-500 font-medium">pasien terdaftar</span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {data?.today.completed ?? 0} Selesai
              </span>
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {data?.today.pending ?? 0} Belum
              </span>
            </div>
          </div>

          {/* Pasien Bulan Ini */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rekap Bulan ({selectedMonth})</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                {data?.monthly.totalPatients ?? 0}
              </span>
              <span className="text-xs text-slate-500 font-medium">pasien total</span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="text-slate-600">Tingkat Pelayanan:</span>
              <span className="font-bold text-teal-700">
                {data?.monthly.totalPatients && data.monthly.totalPatients > 0
                  ? Math.round(((data.monthly.completed || 0) / data.monthly.totalPatients) * 100)
                  : 0}%
              </span>
            </div>
          </div>

          {/* Total Stok Dosis Vaksin */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Logistik Vaksin</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                <Syringe className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                {data?.stockOverview.totalVaccineDoses ?? 0}
              </span>
              <span className="text-xs text-slate-500 font-medium">dosis tersedia</span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600">{data?.stockOverview.totalVaccineTypes ?? 0} jenis vaksin</span>
              {(data?.stockOverview.depletingVaccinesCount ?? 0) > 0 ? (
                <span className="text-amber-700 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {data?.stockOverview.depletingVaccinesCount} menipis
                </span>
              ) : (
                <span className="text-emerald-700 font-medium">Stok Aman</span>
              )}
            </div>
          </div>

          {/* Stok Buku ICV */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Stok Buku Kuning (ICV)</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                {data?.stockOverview.icvRemainingStock ?? 0}
              </span>
              <span className="text-xs text-slate-500 font-medium">buku sisa</span>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span>Terpakai: <strong className="text-slate-900">{data?.stockOverview.icvUsedStock ?? 0}</strong></span>
              <span>Diterima: <strong className="text-slate-900">{data?.stockOverview.icvTotalStock ?? 0}</strong></span>
            </div>
          </div>
        </div>

        {/* 2. DAFTAR NAMA PASIEN HARIAN & MONITORING PERSETUJUAN */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                Jadwal & Daftar Pasien Hari Ini ({selectedDate})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring antrian pasien harian, hasil skrining kehamilan WUS, dan status tindakan vaksinasi
              </p>
            </div>
            <Link
              href="/patients"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 transition-colors"
            >
              <span>Kelola Semua Pasien</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Jam</th>
                  <th className="py-3 px-4">NIK</th>
                  <th className="py-3 px-4">Nama Pasien</th>
                  <th className="py-3 px-4">L/P</th>
                  <th className="py-3 px-4">Jenis Vaksin</th>
                  <th className="py-3 px-4">Tes WUS</th>
                  <th className="py-3 px-4">Persetujuan dr</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">No ICV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.today.patientsList && data.today.patientsList.length > 0 ? (
                  data.today.patientsList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-600 whitespace-nowrap">
                        {p.plannedTime}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {p.nik}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {p.fullName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.gender === 'Laki-laki' ? 'L' : 'P'}
                      </td>
                      <td className="py-3 px-4 text-slate-800 max-w-xs truncate">
                        {p.vaccineType}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
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
                      <td className="py-3 px-4 whitespace-nowrap">
                        {p.doctorApproval === 'Disetujui' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Disetujui
                          </span>
                        )}
                        {p.doctorApproval === 'Ditolak' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Ditolak
                          </span>
                        )}
                        {p.doctorApproval === 'Menunggu Persetujuan' && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Menunggu dr
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {p.status === 'Selesai' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                            <Clock className="w-3.5 h-3.5 text-amber-500" /> Belum
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {p.icvNumber || '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Tidak ada antrian pasien pada tanggal ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. DUA KOLOM: DISTRIBUSI VAKSIN & MONITORING WUS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kolom Kiri: Vaksin nya Apa Aja (Distribusi Vaksin) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
                    <Syringe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Distribusi Jenis Vaksin Terpakai</h3>
                    <p className="text-xs text-slate-500">Bulan: {selectedMonth}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  Total {data?.vaccineDistribution.reduce((acc, c) => acc + c.count, 0) ?? 0} Dosis
                </span>
              </div>

              {/* List Distribusi Bar */}
              <div className="mt-4 space-y-3">
                {data?.vaccineDistribution && data.vaccineDistribution.length > 0 ? (
                  data.vaccineDistribution.map((item, idx) => (
                    <div key={item.vaccineType} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{item.vaccineType}</span>
                        <span className="text-slate-600 font-mono">
                          <strong>{item.count}</strong> pasien ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            idx === 0
                              ? 'bg-teal-600'
                              : idx === 1
                              ? 'bg-emerald-500'
                              : idx === 2
                              ? 'bg-blue-500'
                              : idx === 3
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                          style={{ width: `${Math.max(item.percentage, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    Belum ada data vaksinasi pada bulan {selectedMonth}.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Data dihitung dari rekam vaksinasi terdaftar</span>
              <Link href="/stock" className="text-teal-700 font-semibold hover:underline inline-flex items-center gap-1">
                <span>Cek Stok Master</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Kolom Kanan: Hasil Tes Kehamilan pada WUS (Wanita Usia Subur) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-pink-50 text-pink-700">
                    <Baby className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Hasil Skrining Tes Kehamilan (WUS)</h3>
                    <p className="text-xs text-slate-500">Kewaspadaan kontraindikasi vaksin hidup (Yellow Fever, dll)</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-pink-100 text-pink-800">
                  {data?.pregnancyTestSummary.totalWus ?? 0} Pasien WUS
                </span>
              </div>

              {/* Stat Chips WUS */}
              <div className="grid grid-cols-3 gap-2.5 mt-4">
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/70 text-center">
                  <p className="text-[11px] font-semibold uppercase text-emerald-800">Negatif (Aman)</p>
                  <p className="text-xl font-bold text-emerald-900 mt-0.5">
                    {data?.pregnancyTestSummary.negative ?? 0}
                  </p>
                  <p className="text-[10px] text-emerald-700">Dapat divaksinasi</p>
                </div>

                <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/70 text-center">
                  <p className="text-[11px] font-semibold uppercase text-rose-800">Positif (Hamil)</p>
                  <p className="text-xl font-bold text-rose-900 mt-0.5">
                    {data?.pregnancyTestSummary.positive ?? 0}
                  </p>
                  <p className="text-[10px] text-rose-700 font-bold">Kontraindikasi</p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-center">
                  <p className="text-[11px] font-semibold uppercase text-slate-600">Tidak Dilakukan</p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">
                    {data?.pregnancyTestSummary.notDone ?? 0}
                  </p>
                  <p className="text-[10px] text-slate-500">Non-WUS / Lansia</p>
                </div>
              </div>

              {/* Alert Pasien WUS Positif */}
              {data?.pregnancyTestSummary.records &&
                data.pregnancyTestSummary.records.filter((r) => r.pregnancyTestResult === 'Positif').length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                    <p className="font-bold flex items-center gap-1.5 text-rose-800">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      Perhatian Medis Pasien Hamil (Hasil Positif):
                    </p>
                    <ul className="mt-1.5 space-y-1 list-disc pl-5 text-[11px]">
                      {data.pregnancyTestSummary.records
                        .filter((r) => r.pregnancyTestResult === 'Positif')
                        .slice(0, 3)
                        .map((r) => (
                          <li key={r.id}>
                            <strong>{r.fullName}</strong> — Vaksin {r.vaccineType} (Persetujuan dr:{' '}
                            <span className="font-bold">{r.doctorApproval}</span>)
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
              <span>WUS: Wanita Usia Subur (15-49 tahun)</span>
              <span className="text-teal-700 font-medium">Protokol Kemenkes / WHO</span>
            </div>
          </div>
        </div>

        {/* 4. DASHBOARD MONITORING & LAPORAN STOK VAKSIN & ICV */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-700" />
                Monitoring Ketersediaan Logistik Vaksin & Buku ICV
              </h3>
              <p className="text-xs text-slate-500">
                Peringatan dini stok menipis, mendekati expired, dan sisa buku kuning resmi
              </p>
            </div>
            <Link
              href="/stock"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200 transition-colors"
            >
              <span>Kelola & Mutasi Stok</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Box Alert Stok Vaksin */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Vaksin Perlu Perhatian (Menipis / Kadaluarsa)
              </h4>
              {data?.stockOverview.vaccineAlerts && data.stockOverview.vaccineAlerts.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {data.stockOverview.vaccineAlerts.map((v) => (
                    <div
                      key={v.id}
                      className="p-2.5 rounded bg-white border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{v.vaccineName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          Batch: {v.batchNumber} | Exp: {v.expiryDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-800 block text-sm">{v.currentStock} dosis</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            v.status === 'Habis'
                              ? 'bg-rose-100 text-rose-800'
                              : v.status === 'Kadaluarsa'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Semua stok vaksin saat ini dalam kondisi aman dan mencukupi.
                </p>
              )}
            </div>

            {/* Box Ringkasan Buku Kuning ICV */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-teal-700" />
                  Status Ketersediaan Buku Kuning (ICV)
                </h4>
                <div className="space-y-3 mt-3">
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200">
                    <span className="text-slate-600">Total Buku Diterima (Pengadaan):</span>
                    <span className="font-mono font-bold text-slate-900">
                      {data?.stockOverview.icvTotalStock ?? 0} buku
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200">
                    <span className="text-slate-600">Buku Telah Diterbitkan ke Pasien:</span>
                    <span className="font-mono font-bold text-teal-700">
                      {data?.stockOverview.icvUsedStock ?? 0} buku
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200">
                    <span className="text-slate-600">Sisa Stok Fisik Buku Kuning:</span>
                    <span className="font-mono font-bold text-emerald-800 text-sm">
                      {data?.stockOverview.icvRemainingStock ?? 0} buku
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                <span>Standar Sertifikat Vaksinasi Internasional WHO</span>
                <Link href="/reports" className="text-teal-700 font-semibold hover:underline">
                  Ekspor Laporan ICV
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
