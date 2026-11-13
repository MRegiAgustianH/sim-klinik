'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';
import {
  QrCode,
  RefreshCw,
  Printer,
  Settings,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Syringe,
  Info,
} from 'lucide-react';

interface GformConfig {
  gformUrl: string;
  spreadsheetId: string;
  sheetName: string;
  syncEnabled: boolean;
  lastSyncTime: string | null;
  lastSyncStatus: string;
  hasCredentialsFile: boolean;
}

export default function SyncAndQrPanel({ onSyncSuccess }: { onSyncSuccess?: () => void }) {
  const { user, hasRole } = useAuth();
  const { success, error: toastError, info } = useToast();

  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<GformConfig>({
    gformUrl: 'https://forms.gle/YQn3NVjU1eaFXZ2f6',
    spreadsheetId: '',
    sheetName: 'Form Responses 1',
    syncEnabled: true,
    lastSyncTime: null,
    lastSyncStatus: 'Memeriksa...',
    hasCredentialsFile: false,
  });

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);

  // Form State untuk modal konfigurasi
  const [editForm, setEditForm] = useState({
    gformUrl: '',
    spreadsheetId: '',
    sheetName: 'Form Responses 1',
    syncEnabled: true,
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiFetch<GformConfig>('/api/patients/sync/config');
      if (res) {
        setConfig(res);
        setEditForm({
          gformUrl: res.gformUrl,
          spreadsheetId: res.spreadsheetId,
          sheetName: res.sheetName,
          syncEnabled: res.syncEnabled,
        });
      }
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Handle Manual Sync
  const handleManualSync = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        message: string;
        newPatientsAdded: number;
        configured: boolean;
      }>('/api/patients/sync', {
        method: 'POST',
      });

      if (!res.configured) {
        toastError(res.message);
      } else if (res.newPatientsAdded > 0) {
        success(`Berhasil menarik ${res.newPatientsAdded} data pasien baru dari Google Form!`);
        if (onSyncSuccess) onSyncSuccess();
      } else {
        info('Tidak ada pasien baru. Semua data formulir sudah tersimpan.');
      }
      fetchConfig();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal melakukan sinkronisasi dengan server.';
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const trimmedId = editForm.spreadsheetId.trim();
      let cleanedId = trimmedId;
      if (trimmedId.includes('/spreadsheets/d/')) {
        const match = trimmedId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          cleanedId = match[1];
        }
      }

      const res = await apiFetch<GformConfig>('/api/patients/sync/config', {
        method: 'POST',
        body: JSON.stringify({
          ...editForm,
          spreadsheetId: cleanedId,
        }),
      });
      setConfig(res);
      setEditForm((prev) => ({ ...prev, spreadsheetId: cleanedId }));
      success('Pengaturan Google Form & Sheets berhasil disimpan.');
      setIsConfigModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.';
      toastError(msg);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          {/* Kolom QR Code Preview */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="p-2.5 rounded-xl border-2 border-teal-600/30 bg-white shadow-xs">
              <QRCodeSVG
                value={config.gformUrl || 'https://forms.gle/YQn3NVjU1eaFXZ2f6'}
                size={88}
                level="M"
                includeMargin={false}
              />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" /> Registrasi Mandiri Pasien
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Pasien di ruang tunggu melakukan scan QR code via HP untuk mengisi formulir
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsPosterModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100/80 px-2.5 py-1 rounded-md border border-teal-200 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Poster Ruang Tunggu</span>
                </button>
                {config.gformUrl && !config.gformUrl.includes('rotinsulu-cianjur') ? (
                  <a
                    href={config.gformUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 underline underline-offset-2"
                  >
                    <span>Buka Form</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-300 cursor-pointer"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Ganti Link Form Asli</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Kolom Aksi Sinkronisasi Data */}
          <div className="flex-1 lg:max-w-md w-full flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <div className="text-left sm:text-right text-xs">
              <p className="font-semibold text-slate-800 flex items-center sm:justify-end gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Sinkronisasi Otomatis 30 Detik</span>
              </p>
              <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5" title={config.lastSyncStatus}>
                Status: <strong>{config.lastSyncStatus}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Menarik Data...' : 'Tarik Data GForm'}</span>
              </button>

              {hasRole('Superadmin', 'Perawat', 'Dokter') && (
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(true)}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  title="Pengaturan Google Form & Sheets"
                  aria-label="Pengaturan Google Form"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: POSTER CETAK QR CODE UNTUK RUANG TUNGGU             */}
      {/* ============================================================ */}
      {isPosterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsPosterModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 z-10 flex flex-col max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print">
              <h3 className="text-sm font-bold text-slate-900">Poster QR Code Ruang Tunggu</h3>
              <button onClick={() => setIsPosterModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Poster Content (Printable Area) */}
            <div id="poster-print-area" className="p-6 text-center border-2 border-dashed border-teal-600/40 rounded-xl bg-teal-50/20 my-4 space-y-4">
              <div className="inline-flex p-2 rounded-xl bg-teal-600 text-white shadow-xs">
                <Syringe className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs uppercase font-extrabold tracking-widest text-teal-800">
                  KLINIK UTAMA DR. H. A. ROTINSULU CIANJUR
                </p>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                  PENDAFTARAN MANDIRI VAKSINASI
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Unit Pelayanan Vaksinasi Umrah, Haji & Perjalanan Internasional
                </p>
              </div>

              {/* QR Code Besar */}
              <div className="inline-block p-4 bg-white rounded-2xl shadow-md border-2 border-teal-600">
                <QRCodeSVG
                  value={config.gformUrl || 'https://forms.gle/YQn3NVjU1eaFXZ2f6'}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Panduan Langkah */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-left text-xs space-y-1.5 text-slate-700 shadow-2xs">
                <p className="font-bold text-teal-900 text-center uppercase tracking-wider text-[11px] mb-1">
                  Cara Pendaftaran:
                </p>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                  <span>Buka kamera HP atau aplikasi pemindai QR Code.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                  <span>Arahkan kamera ke QR Code di atas.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                  <span>Isi formulir pendaftaran (NIK, Nama, No. HP, Jenis Vaksin).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 text-[10px]">4</span>
                  <span>Tunggu panggilan petugas di loket pelayanan.</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 font-mono">
                Link Alternatif: {config.gformUrl}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 no-print">
              <span className="text-xs text-slate-500">Dapat dicetak di kertas A4</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPosterModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Poster</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: KONFIGURASI GOOGLE FORM & GOOGLE SHEETS            */}
      {/* ============================================================ */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsConfigModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 z-10 flex flex-col space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-teal-700" />
                <h3 className="text-sm font-bold text-slate-900">Pengaturan Google Form & Google Sheets</h3>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Kredensial */}
            <div
              className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                config.hasCredentialsFile
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {config.hasCredentialsFile ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">
                  {config.hasCredentialsFile
                    ? 'File google-credentials.json Terdeteksi'
                    : 'File google-credentials.json Belum Terdeteksi'}
                </p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  {config.hasCredentialsFile
                    ? 'Koneksi ke Google Sheets API siap digunakan.'
                    : 'Letakkan file kredensial Service Account JSON Anda di root folder aplikasi dengan nama google-credentials.json.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Link Google Form Pasien (QR Code Link) *
                </label>
                <input
                  type="url"
                  required
                  value={editForm.gformUrl}
                  onChange={(e) => setEditForm({ ...editForm, gformUrl: e.target.value })}
                  placeholder="https://forms.gle/..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  URL ini akan di-generate menjadi QR Code di ruang tunggu pasien.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Spreadsheet ID ATAU URL Google Apps Script Web App *
                </label>
                <input
                  type="text"
                  value={editForm.spreadsheetId}
                  onChange={(e) => setEditForm({ ...editForm, spreadsheetId: e.target.value })}
                  placeholder="https://script.google.com/macros/s/... ATAU Spreadsheet ID"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
                <div className="text-[11px] text-slate-500 mt-1 space-y-1">
                  <p>
                    <strong>Metode Rekomendasi (Bypass GCP Policy):</strong> Masukkan URL Web App Google Apps Script (dari menu Ekstensi &gt; Apps Script di Google Sheets). Bebas tanpa butuh Service Account key!
                  </p>
                  <p>
                    <strong>Metode Alternatif:</strong> Masukkan Spreadsheet ID dari URL Google Sheets (memerlukan file google-credentials.json).
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Tab Sheet
                </label>
                <input
                  type="text"
                  value={editForm.sheetName}
                  onChange={(e) => setEditForm({ ...editForm, sheetName: e.target.value })}
                  placeholder="Form Responses 1"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="toggle-sync"
                  type="checkbox"
                  checked={editForm.syncEnabled}
                  onChange={(e) => setEditForm({ ...editForm, syncEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <label htmlFor="toggle-sync" className="font-semibold text-slate-800 cursor-pointer">
                  Aktifkan penarikan berkala otomatis setiap 30 detik
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold cursor-pointer"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
