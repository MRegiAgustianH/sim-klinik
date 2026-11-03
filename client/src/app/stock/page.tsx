'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import {
  Package,
  Plus,
  AlertTriangle,
  History,
  BookOpen,
  Syringe,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  Calendar,
} from 'lucide-react';

interface VaccineStockItem {
  id: number;
  vaccineName: string;
  manufacturer: string | null;
  batchNumber: string;
  initialStock: number;
  currentStock: number;
  unit: string;
  expiryDate: string;
  minStockAlert: number;
  status: 'Tersedia' | 'Menipis' | 'Habis' | 'Kadaluarsa';
  createdAt: string;
  updatedAt: string;
}

interface IcvInventoryItem {
  id: number;
  batchCode: string;
  startSerial: string;
  endSerial: string;
  totalStock: number;
  usedStock: number;
  remainingStock: number;
  receivedDate: string;
  officerName: string;
  notes: string | null;
  createdAt: string;
}

interface StockMutationItem {
  id: number;
  itemType: 'VACCINE' | 'ICV';
  itemId: number | null;
  itemName: string;
  batchOrSerial: string | null;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  notes: string | null;
  officerName: string;
  createdAt: string;
}

export default function StockPage() {
  const { user, hasRole } = useAuth();
  const { success, error: toastError, warning } = useToast();

  const [activeTab, setActiveTab] = useState<'vaccines' | 'icv' | 'mutations'>('vaccines');
  const [isLoading, setIsLoading] = useState(true);

  // Data States
  const [vaccines, setVaccines] = useState<VaccineStockItem[]>([]);
  const [icvData, setIcvData] = useState<{
    summary: { totalReceived: number; totalUsed: number; totalRemaining: number };
    batches: IcvInventoryItem[];
  }>({
    summary: { totalReceived: 0, totalUsed: 0, totalRemaining: 0 },
    batches: [],
  });
  const [mutations, setMutations] = useState<StockMutationItem[]>([]);
  const [vaccineToDelete, setVaccineToDelete] = useState<VaccineStockItem | null>(null);
  // Search & Filter
  const [searchVaccine, setSearchVaccine] = useState('');

  // Modals
  const [isAddVaccineModalOpen, setIsAddVaccineModalOpen] = useState(false);
  const [isAddIcvModalOpen, setIsAddIcvModalOpen] = useState(false);
  const [isAddMutationModalOpen, setIsAddMutationModalOpen] = useState(false);

  // Forms
  const [vaccineForm, setVaccineForm] = useState({
    vaccineName: '',
    manufacturer: '',
    batchNumber: '',
    initialStock: 50,
    unit: 'Vial/Dosis',
    expiryDate: '2027-12-31',
    minStockAlert: 10,
  });

  const [icvForm, setIcvForm] = useState({
    batchCode: '',
    startSerial: '',
    endSerial: '',
    totalStock: 100,
    receivedDate: new Date().toISOString().split('T')[0],
    notes: 'Pengadaan Resmi KKP / Dinas Kesehatan',
  });

  const [mutationForm, setMutationForm] = useState({
    itemType: 'VACCINE' as 'VACCINE' | 'ICV',
    itemId: 0,
    itemName: '',
    batchOrSerial: '',
    type: 'IN' as 'IN' | 'OUT' | 'ADJUSTMENT',
    quantity: 10,
    notes: '',
  });

  const fetchVaccines = async () => {
    const res = await apiFetch<VaccineStockItem[]>('/api/stock/vaccines');
    setVaccines(res);
  };

  const fetchIcv = async () => {
    const res = await apiFetch<{
      summary: { totalReceived: number; totalUsed: number; totalRemaining: number };
      batches: IcvInventoryItem[];
    }>('/api/stock/icv');
    setIcvData(res);
  };

  const fetchMutations = async () => {
    const res = await apiFetch<{ total: number; data: StockMutationItem[] }>('/api/stock/mutations');
    setMutations(res.data);
  };

  const loadAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      await Promise.all([fetchVaccines(), fetchIcv(), fetchMutations()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data logistik.';
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Submit Tambah Stok Vaksin
  const handleSaveVaccine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/stock/vaccines', {
        method: 'POST',
        body: JSON.stringify(vaccineForm),
      });
      success('Stok vaksin baru berhasil ditambahkan.');
      setIsAddVaccineModalOpen(false);
      setVaccineForm({
        vaccineName: '',
        manufacturer: '',
        batchNumber: '',
        initialStock: 50,
        unit: 'Vial/Dosis',
        expiryDate: '2027-12-31',
        minStockAlert: 10,
      });
      loadAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menambahkan vaksin.';
      toastError(msg);
    }
  };

  // Submit Penerimaan ICV
  const handleSaveIcv = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/stock/icv', {
        method: 'POST',
        body: JSON.stringify({
          ...icvForm,
          totalStock: Number(icvForm.totalStock),
        }),
      });
      success('Penerimaan buku kuning ICV baru berhasil dicatat.');
      setIsAddIcvModalOpen(false);
      setIcvForm({
        batchCode: '',
        startSerial: '',
        endSerial: '',
        totalStock: 100,
        receivedDate: new Date().toISOString().split('T')[0],
        notes: 'Pengadaan Resmi KKP / Dinas Kesehatan',
      });
      loadAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat buku ICV.';
      toastError(msg);
    }
  };

  // Submit Mutasi Manual
  const handleSaveMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/stock/mutations', {
        method: 'POST',
        body: JSON.stringify({
          ...mutationForm,
          itemId: mutationForm.itemId ? Number(mutationForm.itemId) : undefined,
          quantity: Number(mutationForm.quantity),
        }),
      });
      success('Mutasi stok logistik berhasil disimpan.');
      setIsAddMutationModalOpen(false);
      loadAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat mutasi stok.';
      toastError(msg);
    }
  };

  // Hapus Stok Vaksin dengan Modal
  const confirmDeleteVaccine = async () => {
    if (!vaccineToDelete) return;
    try {
      await apiFetch(`/api/stock/vaccines/${vaccineToDelete.id}`, { method: 'DELETE' });
      success(`Stok vaksin ${vaccineToDelete.vaccineName} berhasil dihapus.`);
      setVaccineToDelete(null);
      fetchVaccines();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus stok.';
      toastError(msg);
    }
  };

  const filteredVaccines = vaccines.filter(
    (v) =>
      v.vaccineName.toLowerCase().includes(searchVaccine.toLowerCase()) ||
      v.batchNumber.toLowerCase().includes(searchVaccine.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-6 h-6 text-teal-700" />
              Monitoring Stok Vaksin & Buku Kuning (ICV)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Kelola logistik vaksinasi, nomor batch, tanggal kadaluarsa, inventaris ICV, dan riwayat mutasi
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasRole('Superadmin', 'Perawat') && (
              <>
                {activeTab === 'vaccines' && (
                  <button
                    onClick={() => setIsAddVaccineModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Stok Vaksin</span>
                  </button>
                )}
                {activeTab === 'icv' && (
                  <button
                    onClick={() => setIsAddIcvModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Penerimaan Buku ICV</span>
                  </button>
                )}
                {activeTab === 'mutations' && (
                  <button
                    onClick={() => setIsAddMutationModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Catat Mutasi Manual</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('vaccines')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'vaccines'
                ? 'border-teal-700 text-teal-800 bg-teal-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Syringe className="w-4 h-4" />
            <span>Master Stok Vaksin ({vaccines.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('icv')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'icv'
                ? 'border-teal-700 text-teal-800 bg-teal-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Inventaris Buku Kuning ICV ({icvData.batches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('mutations')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'mutations'
                ? 'border-teal-700 text-teal-800 bg-teal-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Mutasi Stok ({mutations.length})</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: MASTER STOK VAKSIN                                    */}
        {/* ============================================================ */}
        {activeTab === 'vaccines' && (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari nama vaksin atau nomor batch..."
                  value={searchVaccine}
                  onChange={(e) => setSearchVaccine(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Total Dosis Tersedia: <strong className="text-slate-900 font-mono text-sm">{vaccines.reduce((a, b) => a + b.currentStock, 0)}</strong> dosis
              </div>
            </div>

            {/* Tabel Vaksin */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">No</th>
                      <th className="py-3 px-4">Nama Vaksin</th>
                      <th className="py-3 px-4">Pabrik / Produsen</th>
                      <th className="py-3 px-4">Nomor Batch</th>
                      <th className="py-3 px-4 text-center">Stok Awal</th>
                      <th className="py-3 px-4 text-center">Stok Saat Ini</th>
                      <th className="py-3 px-4">Satuan</th>
                      <th className="py-3 px-4">Tgl Kadaluarsa</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      {hasRole('Superadmin') && <th className="py-3 px-4 text-center">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVaccines.length > 0 ? (
                      filteredVaccines.map((v, idx) => (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{v.vaccineName}</td>
                          <td className="py-3 px-4 text-slate-600">{v.manufacturer || '-'}</td>
                          <td className="py-3 px-4 font-mono font-bold text-teal-800">{v.batchNumber}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-500">{v.initialStock}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 text-sm">
                            {v.currentStock}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{v.unit}</td>
                          <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">{v.expiryDate}</td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                v.status === 'Tersedia'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : v.status === 'Menipis'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {v.status}
                            </span>
                          </td>
                          {hasRole('Superadmin') && (
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => setVaccineToDelete(v)}
                                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                                title="Hapus Stok"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          Tidak ada stok vaksin yang sesuai.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: INVENTARIS BUKU KUNING (ICV)                          */}
        {/* ============================================================ */}
        {activeTab === 'icv' && (
          <div className="space-y-5">
            {/* Kartu Ringkasan Stok ICV */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-semibold uppercase text-slate-500 block">Total Buku Diterima</span>
                <span className="text-2xl font-bold text-slate-900 font-mono mt-1 block">
                  {icvData.summary.totalReceived}
                </span>
                <span className="text-[11px] text-slate-400">Pengadaan resmi dari KKP/Dinkes</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-semibold uppercase text-slate-500 block">Telah Diterbitkan ke Pasien</span>
                <span className="text-2xl font-bold text-teal-700 font-mono mt-1 block">
                  {icvData.summary.totalUsed}
                </span>
                <span className="text-[11px] text-slate-400">Sesuai rekam nomor ICV pasien</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-semibold uppercase text-slate-500 block">Sisa Stok Fisik Buku</span>
                <span className="text-2xl font-bold text-emerald-800 font-mono mt-1 block">
                  {icvData.summary.totalRemaining}
                </span>
                <span className="text-[11px] text-emerald-600 font-medium">Tersedia di loket vaksinasi</span>
              </div>
            </div>

            {/* Tabel Batch ICV */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Daftar Batch Penerimaan Buku Kuning (ICV)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">No</th>
                      <th className="py-3 px-4">Kode Batch</th>
                      <th className="py-3 px-4">Rentang Nomor Seri (Awal s/d Akhir)</th>
                      <th className="py-3 px-4 text-center">Total Buku</th>
                      <th className="py-3 px-4 text-center">Terpakai</th>
                      <th className="py-3 px-4 text-center">Sisa Buku</th>
                      <th className="py-3 px-4">Tgl Penerimaan</th>
                      <th className="py-3 px-4">Petugas</th>
                      <th className="py-3 px-4">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {icvData.batches.length > 0 ? (
                      icvData.batches.map((b, idx) => (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold font-mono text-slate-900">{b.batchCode}</td>
                          <td className="py-3 px-4 font-mono text-teal-800">
                            <strong>{b.startSerial}</strong> s/d <strong>{b.endSerial}</strong>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">{b.totalStock}</td>
                          <td className="py-3 px-4 text-center font-mono text-amber-700">{b.usedStock}</td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-emerald-800 text-sm">
                            {b.remainingStock}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{b.receivedDate}</td>
                          <td className="py-3 px-4 text-slate-800">{b.officerName}</td>
                          <td className="py-3 px-4 text-slate-500">{b.notes || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          Belum ada data penerimaan buku ICV.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: RIWAYAT MUTASI LOGISTIK                               */}
        {/* ============================================================ */}
        {activeTab === 'mutations' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Log Mutasi Masuk, Keluar & Penyesuaian Stok</h3>
              <p className="text-xs text-slate-500">Pencatatan riwayat pengurangan stok saat vaksinasi dan penerimaan baru</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Tipe Barang</th>
                    <th className="py-3 px-4">Nama Barang</th>
                    <th className="py-3 px-4">Batch / Seri</th>
                    <th className="py-3 px-4 text-center">Jenis Mutasi</th>
                    <th className="py-3 px-4 text-center">Jumlah</th>
                    <th className="py-3 px-4">Petugas</th>
                    <th className="py-3 px-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mutations.length > 0 ? (
                    mutations.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {m.createdAt.replace('T', ' ').substring(0, 19)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.itemType === 'VACCINE' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {m.itemType === 'VACCINE' ? 'Vaksin' : 'Buku ICV'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{m.itemName}</td>
                        <td className="py-3 px-4 font-mono text-slate-700">{m.batchOrSerial || '-'}</td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {m.type === 'IN' && (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                              <ArrowDownRight className="w-3.5 h-3.5" /> Masuk
                            </span>
                          )}
                          {m.type === 'OUT' && (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                              <ArrowUpRight className="w-3.5 h-3.5" /> Keluar
                            </span>
                          )}
                          {m.type === 'ADJUSTMENT' && (
                            <span className="inline-flex items-center gap-1 font-bold text-blue-700">
                              Penyesuaian
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{m.quantity}</td>
                        <td className="py-3 px-4 text-slate-800">{m.officerName}</td>
                        <td className="py-3 px-4 text-slate-600">{m.notes || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Belum ada riwayat mutasi logistik.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL TAMBAH STOK VAKSIN                                     */}
        {/* ============================================================ */}
        {isAddVaccineModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60" onClick={() => setIsAddVaccineModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 z-10 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Tambah Master Stok Vaksin Baru</h3>
                <button onClick={() => setIsAddVaccineModalOpen(false)}>
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveVaccine} className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Vaksin *</label>
                  <input
                    type="text"
                    required
                    value={vaccineForm.vaccineName}
                    onChange={(e) => setVaccineForm({ ...vaccineForm, vaccineName: e.target.value })}
                    placeholder="Contoh: Meningitis ACYW-135"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pabrik / Produsen</label>
                  <input
                    type="text"
                    value={vaccineForm.manufacturer}
                    onChange={(e) => setVaccineForm({ ...vaccineForm, manufacturer: e.target.value })}
                    placeholder="Contoh: Bio Farma / GSK"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nomor Batch *</label>
                    <input
                      type="text"
                      required
                      value={vaccineForm.batchNumber}
                      onChange={(e) => setVaccineForm({ ...vaccineForm, batchNumber: e.target.value })}
                      placeholder="MEN-2026-X1"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Stok Awal (Dosis) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={vaccineForm.initialStock}
                      onChange={(e) => setVaccineForm({ ...vaccineForm, initialStock: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                    <input
                      type="text"
                      value={vaccineForm.unit}
                      onChange={(e) => setVaccineForm({ ...vaccineForm, unit: e.target.value })}
                      placeholder="Vial / Dosis"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tgl Kadaluarsa *</label>
                    <input
                      type="date"
                      required
                      value={vaccineForm.expiryDate}
                      onChange={(e) => setVaccineForm({ ...vaccineForm, expiryDate: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddVaccineModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
                  >
                    Simpan Stok Vaksin
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL PENERIMAAN BUKU KUNING ICV                             */}
        {/* ============================================================ */}
        {isAddIcvModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60" onClick={() => setIsAddIcvModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 z-10 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Catat Penerimaan Buku Kuning (ICV)</h3>
                <button onClick={() => setIsAddIcvModalOpen(false)}>
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveIcv} className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Batch Penerimaan *</label>
                  <input
                    type="text"
                    required
                    value={icvForm.batchCode}
                    onChange={(e) => setIcvForm({ ...icvForm, batchCode: e.target.value })}
                    placeholder="Contoh: ICV-BATCH-2026-02"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No Seri Awal *</label>
                    <input
                      type="text"
                      required
                      value={icvForm.startSerial}
                      onChange={(e) => setIcvForm({ ...icvForm, startSerial: e.target.value })}
                      placeholder="ICV-ID-2026-0501"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">No Seri Akhir *</label>
                    <input
                      type="text"
                      required
                      value={icvForm.endSerial}
                      onChange={(e) => setIcvForm({ ...icvForm, endSerial: e.target.value })}
                      placeholder="ICV-ID-2026-1000"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jumlah Buku Diterima *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={icvForm.totalStock}
                      onChange={(e) => setIcvForm({ ...icvForm, totalStock: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Penerimaan *</label>
                    <input
                      type="date"
                      required
                      value={icvForm.receivedDate}
                      onChange={(e) => setIcvForm({ ...icvForm, receivedDate: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catatan Pengadaan</label>
                  <textarea
                    rows={2}
                    value={icvForm.notes}
                    onChange={(e) => setIcvForm({ ...icvForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddIcvModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
                  >
                    Simpan Penerimaan ICV
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL MUTASI MANUAL                                          */}
        {/* ============================================================ */}
        {isAddMutationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60" onClick={() => setIsAddMutationModalOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 z-10 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">Catat Penyesuaian / Mutasi Manual</h3>
                <button onClick={() => setIsAddMutationModalOpen(false)}>
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveMutation} className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilih Vaksin yang Disesuaikan *</label>
                  <select
                    required
                    value={mutationForm.itemId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const selected = vaccines.find((v) => v.id === id);
                      if (selected) {
                        setMutationForm({
                          ...mutationForm,
                          itemId: id,
                          itemName: selected.vaccineName,
                          batchOrSerial: selected.batchNumber,
                        });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white"
                  >
                    <option value={0}>-- Pilih Vaksin --</option>
                    {vaccines.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vaccineName} (Batch: {v.batchNumber} | Stok: {v.currentStock})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jenis Mutasi *</label>
                    <select
                      value={mutationForm.type}
                      onChange={(e) =>
                        setMutationForm({ ...mutationForm, type: e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT' })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white font-semibold"
                    >
                      <option value="IN">Masuk (+)</option>
                      <option value="OUT">Keluar / Rusak (-)</option>
                      <option value="ADJUSTMENT">Koreksi Stok Fisik</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jumlah Mutasi *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={mutationForm.quantity}
                      onChange={(e) => setMutationForm({ ...mutationForm, quantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alasan / Catatan Penyesuaian *</label>
                  <textarea
                    rows={2}
                    required
                    value={mutationForm.notes}
                    onChange={(e) => setMutationForm({ ...mutationForm, notes: e.target.value })}
                    placeholder="Contoh: Vial pecah saat penyimpanan, stok opname bulanan..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddMutationModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
                  >
                    Simpan Mutasi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Stok Vaksin */}
        <ConfirmModal
          isOpen={!!vaccineToDelete}
          title="Konfirmasi Hapus Stok Vaksin"
          message={`Apakah Anda yakin ingin menghapus data stok vaksin ${vaccineToDelete?.vaccineName} (Batch: ${vaccineToDelete?.batchNumber})? Data riwayat stok ini akan dihapus dari sistem.`}
          confirmText="Ya, Hapus Stok"
          cancelText="Batal"
          onConfirm={confirmDeleteVaccine}
          onCancel={() => setVaccineToDelete(null)}
        />
      </div>
    </AppShell>
  );
}
