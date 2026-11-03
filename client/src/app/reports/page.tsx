'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { apiFetch, getApiBaseUrl } from '@/lib/api';
import { useToast } from '@/components/Toast';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  CheckCircle2,
  Users,
  Printer,
  Table,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';

export default function ReportsPage() {
  const { success, error: toastError } = useToast();

  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [reportStats, setReportStats] = useState<{
    totalPatients: number;
    completed: number;
    pending: number;
    vaccinesCount: number;
    icvRemaining: number;
  }>({
    totalPatients: 0,
    completed: 0,
    pending: 0,
    vaccinesCount: 0,
    icvRemaining: 0,
  });

  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const fetchReportStats = useCallback(async () => {
    try {
      const res = await apiFetch<{
        monthly: { totalPatients: number; completed: number; pending: number };
        stockOverview: { totalVaccineDoses: number; icvRemainingStock: number };
      }>(`/api/dashboard/metrics?month=${selectedMonth}`);
      if (res) {
        setReportStats({
          totalPatients: res.monthly.totalPatients || 0,
          completed: res.monthly.completed || 0,
          pending: res.monthly.pending || 0,
          vaccinesCount: res.stockOverview.totalVaccineDoses || 0,
          icvRemaining: res.stockOverview.icvRemainingStock || 0,
        });
      }
    } catch {
      // fallback
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchReportStats();
  }, [fetchReportStats]);

  // Export Excel (.xlsx)
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const url = `${getApiBaseUrl()}/api/export/excel?month=${selectedMonth}`;
      const token = localStorage.getItem('vaksinku_token');

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Gagal mengekspor file Excel');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Laporan_Vaksinasi_Rotinsulu_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      success(`Laporan Excel periode ${selectedMonth} berhasil diunduh.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunduh Excel.';
      toastError(msg);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Export PDF (.pdf)
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const url = `${getApiBaseUrl()}/api/export/monthly/pdf?month=${selectedMonth}`;
      const token = localStorage.getItem('vaksinku_token');

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Gagal mengekspor file PDF');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Rekap_Vaksinasi_Rotinsulu_${selectedMonth}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      success(`Laporan PDF resmi periode ${selectedMonth} berhasil diunduh.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengunduh PDF.';
      toastError(msg);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-teal-700" />
              Laporan & Ekspor Data Profesional
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Unduh rekapitulasi pelayanan vaksinasi, skrining WUS, stok vaksin, dan sertifikasi buku ICV Klinik Utama Dr. H. A. Rotinsulu Cianjur
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <label htmlFor="report-month" className="font-semibold text-slate-700">Periode Bulan:</label>
            <input
              id="report-month"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Ringkasan Periode Laporan */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-teal-800 mb-3">
            Ringkasan Data Periode {selectedMonth}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Total Pasien Terdaftar</span>
              <span className="text-xl font-bold text-slate-900 font-mono mt-0.5 block">
                {reportStats.totalPatients} Orang
              </span>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-emerald-700 font-semibold block">Vaksinasi Selesai</span>
              <span className="text-xl font-bold text-emerald-900 font-mono mt-0.5 block">
                {reportStats.completed} Orang
              </span>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-amber-700 font-semibold block">Menunggu Tindakan</span>
              <span className="text-xl font-bold text-amber-900 font-mono mt-0.5 block">
                {reportStats.pending} Orang
              </span>
            </div>

            <div className="p-3 rounded-lg bg-teal-50 border border-teal-200">
              <span className="text-teal-700 font-semibold block">Sisa Buku Kuning ICV</span>
              <span className="text-xl font-bold text-teal-900 font-mono mt-0.5 block">
                {reportStats.icvRemaining} Buku
              </span>
            </div>
          </div>
        </div>

        {/* Pilihan Ekspor: Dua Kartu Besar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. KARTU EKSPOR EXCEL */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 flex flex-col justify-between hover:border-teal-300 transition-all">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Format Microsoft Excel (.xlsx)</h3>
                  <p className="text-xs text-slate-500">Buku Kerja Multi-Sheet Lengkap</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Menghasilkan workbook Excel terstruktur dengan penataan header resmi Rumah Sakit, styling border, kolom terformat rapi, dan mencakup 3 lembar kerja (Sheet):
              </p>

              <ul className="text-xs text-slate-700 space-y-2 border-t border-b border-slate-100 py-3">
                <li className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Sheet 1:</strong> Data Rekap Pasien & 24 Kolom Rekam Vaksinasi</span>
                </li>
                <li className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Sheet 2:</strong> Monitoring Stok Vaksin (Batch, Kadaluarsa, Status)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Sheet 3:</strong> Inventaris Buku Kuning ICV (Nomor Seri & Sisa)</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
              >
                <Download className={`w-4 h-4 ${isExportingExcel ? 'animate-bounce' : ''}`} />
                <span>{isExportingExcel ? 'Menyusun File Excel...' : `Unduh Excel (.xlsx) - Periode ${selectedMonth}`}</span>
              </button>
            </div>
          </div>

          {/* 2. KARTU EKSPOR PDF */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 flex flex-col justify-between hover:border-teal-300 transition-all">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Format Dokumen PDF Resmi (.pdf)</h3>
                  <p className="text-xs text-slate-500">Laporan Rekapitulasi Siap Cetak (Landscape)</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Dokumen cetak resmi bertaraf profesional dengan Kop Surat Rumah Sakit, tabel ringkasan eksekutif, tabel data pasien bulanan, serta pengesahan tanda tangan Dokter Penanggung Jawab Pelayanan Vaksinasi:
              </p>

              <ul className="text-xs text-slate-700 space-y-2 border-t border-b border-slate-100 py-3">
                <li className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Kop Surat Resmi Rumah Sakit / Klinik Vaksinasi</span>
                </li>
                <li className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Ringkasan Demografi (Gender, Skrining WUS, Status Layanan)</span>
                </li>
                <li className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Tabel Rekap Pasien, No ICV, & Kolom Pengesahan Pejabat Medis</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
              >
                <Download className={`w-4 h-4 ${isExportingPdf ? 'animate-bounce' : ''}`} />
                <span>{isExportingPdf ? 'Menyusun Dokumen PDF...' : `Unduh PDF Rekapitulasi - Periode ${selectedMonth}`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Informasi Cetak Kartu Individual Pasien */}
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Pencetakan Kartu Bukti Vaksinasi Perorangan (Individual Certificate)</p>
            <p className="text-teal-800">
              Untuk mencetak Surat Keterangan / Kartu Bukti Vaksinasi Internasional untuk masing-masing pasien (beserta hasil skrining WUS dan legalisasi dokter), silakan gunakan tombol <strong>Unduh PDF</strong> pada menu <strong>Data Pasien & Vaksinasi</strong>.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
