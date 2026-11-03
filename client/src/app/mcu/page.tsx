'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { apiFetch, getApiBaseUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import {
  Stethoscope,
  Plus,
  Search,
  FileDown,
  Edit,
  Trash2,
  Sparkles,
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface McuReportItem {
  id: number;
  reportNumber: string | null;
  patientName: string;
  nik: string | null;
  ageGender: string;
  birthDate: string | null;
  address: string | null;
  examDate: string;
  purpose: string;
  vitalSigns: string | null;
  anthropometry: string | null;
  physicalExam: string | null;
  labExam: string | null;
  supportingExam: string | null;
  conclusionType: 'Sehat' | 'Sehat dengan catatan' | 'Temporary Unfit' | 'Unfit';
  conclusionNotes: string | null;
  recommendations: string | null;
  doctorName: string;
  doctorSip: string | null;
  createdAt: string;
}

const DEFAULT_NORMAL_STATE = {
  patientName: '',
  nik: '',
  ageGender: '49 Tahun / Laki-Laki',
  birthDate: '20 Juni 1977',
  address: 'Cianjur, Jawa Barat',
  examDate: new Date().toISOString().split('T')[0],
  purpose: 'MCU kerja',

  // A. TANDA VITAL
  bloodPressure: '127/90 mmHg (Pre-hipertensi)',
  pulse: '95 x/menit (Normal)',
  respiration: '26 x/menit (Normal)',
  temperature: '36.2 °C (Normal)',
  consciousness: 'Compos Mentis',

  // B. ANTROPOMETRI
  weight: '67',
  height: '160',
  bmi: '26.2',
  nutritionStatus: 'Obesitas',

  // C. PEMERIKSAAN FISIK
  head: 'Normal',
  teeth: 'Radics 1, stain+',
  ent: 'Normal',
  neck: 'Normal',
  heart: 'Normal',
  lungs: 'Normal',
  abdomen: 'Normal',
  extremities: 'Normal',

  // D. PEMERIKSAAN LABORATORIUM
  completeBlood: 'Dalam batas normal',
  completeUrine: 'Dalam batas normal',
  bloodChemistry: 'Dalam batas normal', // GDP, Kolesterol total, LDL, Kreatinin, Ureum, Asam Urat
  lipidLiver: 'Hasil tidak batas normal', // TG, HDL, SGOT, SGPT
  hbsag: 'Negatif',
  drugTest: 'Negatif',

  // E - I. PEMERIKSAAN PENUNJANG
  thoraxXray: '• Trakea di tengah, Mediastinum tidak melebar, Cor tidak membesar (<CTR <50%), Sinuses dan diafragma normal\n• Pulmo : Hili normal, Corakan bronkovaskuler normal, Tidak tampak infiltrat/konsolidasi. Soft tissue dan skeletal normal.\nKesan : Tidak tampak TBC paru aktif/pneumonia, Tidak tampak kardiomegali',
  ekg: 'Hasil terlampir',
  treadmill: 'Normal',
  audiometry: 'Rata-rata ambang dengar kedua telinga dalam batas normal, terdapat penurunan pendengaran pada frekuensi 8000Hz sebesar 35dB pada telinga kanan dan frekuensi 8000Hz sebesar 60dB pada telinga kiri',
  spirometry: 'Restrictive',

  // FISIK DETAIL (HALAMAN 3 & 4)
  generalCondition: 'Baik',
  eyesVisus: 'Visus OD 20/20, OS 20/20',
  colorVision: 'Tidak Buta warna',
  earSecret: 'Tidak ada sekret',
  noseSecret: 'Tidak ada sekret',
  neckGland: 'Tidak ada pembesaran kelenjar',
  lungsBreathSound: 'suara nafas vesikuler, tidak ada ronkhi/wheezing',
  heartSound: 'Bunyi jantung reguler, tidak ada murmur',
  abdomenPalpation: 'lunak, tidak ada nyeri tekan',
  liverSpleen: 'tidak teraba',
  extremitiesDetail: 'tidak ada edema, kekuatan otot baik',

  // KESIMPULAN & SARAN
  conclusionType: 'Sehat dengan catatan' as 'Sehat' | 'Sehat dengan catatan' | 'Temporary Unfit' | 'Unfit',
  conclusionNotes: 'perbaiki pola makan dan olahraga teratur, gangguan pendengaran',
  temporaryUnfitNotes: '',
  unfitNotes: '',
  recommendations: 'Konsul Dokter Spesialis THT\nKonsul Gizi\nBerhenti merokok',

  // DOKTER
  doctorName: 'dr. Arinda Puteri P',
  doctorSip: 'SIP.MR32032507002898',
};

export default function McuPage() {
  const { user, hasRole } = useAuth();
  const { success, error: toastError } = useToast();

  const [reports, setReports] = useState<McuReportItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [reportToDelete, setReportToDelete] = useState<McuReportItem | null>(null);

  // Active form section in editor & active preview page (1..4)
  const [activeFormTab, setActiveFormTab] = useState<'resume' | 'lab' | 'physical' | 'conclusion'>('resume');
  const [activePreviewPage, setActivePreviewPage] = useState<number | 'all'>('all');

  // Form State
  const [formData, setFormData] = useState({
    ...DEFAULT_NORMAL_STATE,
    doctorName: user?.fullName?.startsWith('dr') ? user.fullName : 'dr. Arinda Puteri P',
  });

  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (searchTerm.trim()) queryParams.append('search', searchTerm.trim());
      queryParams.append('limit', '50');

      const res = await apiFetch<{ total: number; data: McuReportItem[] }>(`/api/mcu?${queryParams.toString()}`);
      setReports(res.data);
      setTotalCount(res.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat daftar MCU.';
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, toastError]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Auto-calculate BMI & Nutrition Status when Weight/Height changes
  useEffect(() => {
    const w = parseFloat(formData.weight);
    const h = parseFloat(formData.height);
    if (!isNaN(w) && !isNaN(h) && h > 0) {
      const hM = h / 100;
      const bmiVal = (w / (hM * hM)).toFixed(1);
      let status = 'Normal';
      const bmiNum = parseFloat(bmiVal);
      if (bmiNum < 18.5) status = 'Underweight';
      else if (bmiNum < 25) status = 'Normal';
      else if (bmiNum < 30) status = 'Overweight';
      else status = 'Obesitas';

      setFormData((prev) => ({ ...prev, bmi: bmiVal, nutritionStatus: status }));
    }
  }, [formData.weight, formData.height]);

  // Open New Form
  const handleOpenNew = () => {
    setIsEditing(false);
    setSelectedReportId(null);
    setFormData({
      ...DEFAULT_NORMAL_STATE,
      examDate: new Date().toISOString().split('T')[0],
      doctorName: user?.fullName?.startsWith('dr') ? user.fullName : 'dr. Arinda Puteri P',
    });
    setActiveFormTab('resume');
    setActivePreviewPage('all');
    setIsEditorOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (r: McuReportItem) => {
    setIsEditing(true);
    setSelectedReportId(r.id);

    const parseJson = (s: string | null) => {
      try {
        return s ? JSON.parse(s) : {};
      } catch {
        return {};
      }
    };

    const vital = parseJson(r.vitalSigns);
    const antropo = parseJson(r.anthropometry);
    const physical = parseJson(r.physicalExam);
    const lab = parseJson(r.labExam);
    const supporting = parseJson(r.supportingExam);

    let recs = '';
    if (r.recommendations) {
      try {
        const parsed = JSON.parse(r.recommendations);
        recs = Array.isArray(parsed) ? parsed.join('\n') : String(parsed);
      } catch {
        recs = r.recommendations;
      }
    }

    setFormData({
      ...DEFAULT_NORMAL_STATE,
      patientName: r.patientName,
      nik: r.nik || '',
      ageGender: r.ageGender,
      birthDate: r.birthDate || '',
      address: r.address || '',
      examDate: r.examDate,
      purpose: r.purpose || 'MCU kerja',

      bloodPressure: vital.bloodPressure || '120/80 mmHg',
      pulse: vital.pulse || '80 x/menit',
      respiration: vital.respiration || '18 x/menit',
      temperature: vital.temperature || '36.5 °C',
      consciousness: vital.consciousness || 'Compos Mentis',

      weight: antropo.weight ? antropo.weight.replace(/\D/g, '') : '65',
      height: antropo.height ? antropo.height.replace(/\D/g, '') : '160',
      bmi: antropo.bmi || '26.2',
      nutritionStatus: antropo.nutritionStatus || 'Normal',

      head: physical.head || 'Normal',
      teeth: physical.teeth || 'Normal',
      ent: physical.ent || 'Normal',
      neck: physical.neck || 'Normal',
      heart: physical.heart || 'Normal',
      lungs: physical.lungs || 'Normal',
      abdomen: physical.abdomen || 'Normal',
      extremities: physical.extremities || 'Normal',

      completeBlood: lab.completeBlood || 'Dalam batas normal',
      completeUrine: lab.completeUrine || 'Dalam batas normal',
      bloodChemistry: lab.bloodChemistry || 'Dalam batas normal',
      lipidLiver: lab.additionalLab || 'Dalam batas normal',
      hbsag: lab.hbsag || 'Negatif',
      drugTest: lab.drugTest || 'Negatif',

      thoraxXray: supporting.thoraxXray || 'Cor dan Pulmo dalam batas normal',
      ekg: supporting.ekg || 'Normal',
      treadmill: supporting.treadmill || 'Normal',
      audiometry: supporting.audiometry || 'Dalam batas normal',
      spirometry: supporting.spirometry || 'Normal',

      generalCondition: physical.generalCondition || 'Baik',
      eyesVisus: physical.eyes || 'Visus OD 20/20, OS 20/20',
      colorVision: physical.colorVision || 'Tidak Buta warna',
      earSecret: physical.earSecret || 'Tidak ada sekret',
      noseSecret: physical.noseSecret || 'Tidak ada sekret',
      neckGland: physical.neckGland || 'Tidak ada pembesaran kelenjar',
      lungsBreathSound: physical.lungsBreathSound || 'suara nafas vesikuler, tidak ada ronkhi/wheezing',
      heartSound: physical.heartSound || 'Bunyi jantung reguler, tidak ada murmur',
      abdomenPalpation: physical.abdomenPalpation || 'lunak, tidak ada nyeri tekan',
      liverSpleen: physical.liverSpleen || 'tidak teraba',
      extremitiesDetail: physical.extremitiesDetail || 'tidak ada edema, kekuatan otot baik',

      conclusionType: r.conclusionType,
      conclusionNotes: r.conclusionNotes || '',
      temporaryUnfitNotes: r.conclusionType === 'Temporary Unfit' ? r.conclusionNotes || '' : '',
      unfitNotes: r.conclusionType === 'Unfit' ? r.conclusionNotes || '' : '',
      recommendations: recs,

      doctorName: r.doctorName,
      doctorSip: r.doctorSip || 'SIP.MR32032507002898',
    });

    setActiveFormTab('resume');
    setActivePreviewPage('all');
    setIsEditorOpen(true);
  };

  // 1-Click "Pakai Template Normal"
  const handleApplyNormalTemplate = () => {
    setFormData((prev) => ({
      ...prev,
      bloodPressure: '120/80 mmHg (Normal)',
      pulse: '80 x/menit (Normal)',
      respiration: '18 x/menit (Normal)',
      temperature: '36.5 °C (Normal)',
      consciousness: 'Compos Mentis',

      weight: '65',
      height: '165',
      bmi: '23.9',
      nutritionStatus: 'Normal',

      head: 'Normal',
      teeth: 'Normal',
      ent: 'Normal',
      neck: 'Normal',
      heart: 'Normal',
      lungs: 'Normal',
      abdomen: 'Normal',
      extremities: 'Normal',

      completeBlood: 'Dalam batas normal',
      completeUrine: 'Dalam batas normal',
      bloodChemistry: 'Dalam batas normal',
      lipidLiver: 'Dalam batas normal',
      hbsag: 'Negatif',
      drugTest: 'Negatif',

      thoraxXray: 'Cor dan Pulmo dalam batas normal, tidak tampak kelainan aktif.',
      ekg: 'Normal Sinus Rhythm',
      treadmill: 'Normal / Tidak dilakukan',
      audiometry: 'Dalam batas normal',
      spirometry: 'Normal / Tidak dilakukan',

      generalCondition: 'Baik',
      eyesVisus: 'Visus OD 20/20, OS 20/20',
      colorVision: 'Tidak Buta warna',
      earSecret: 'Tidak ada sekret',
      noseSecret: 'Tidak ada sekret',
      neckGland: 'Tidak ada pembesaran kelenjar',
      lungsBreathSound: 'suara nafas vesikuler, tidak ada ronkhi/wheezing',
      heartSound: 'Bunyi jantung reguler, tidak ada murmur',
      abdomenPalpation: 'lunak, tidak ada nyeri tekan',
      liverSpleen: 'tidak teraba',
      extremitiesDetail: 'tidak ada edema, kekuatan otot baik',

      conclusionType: 'Sehat',
      conclusionNotes: '',
      temporaryUnfitNotes: '',
      unfitNotes: '',
      recommendations: 'Pertahankan pola hidup sehat dan olahraga teratur.\nMinum air putih minimal 2 liter per hari.',
    }));
  };

  // Save MCU Report
  const handleSaveReport = async () => {
    if (!formData.patientName.trim()) {
      toastError('Nama pasien wajib diisi.');
      return;
    }

    try {
      let finalConclusionNotes = formData.conclusionNotes;
      if (formData.conclusionType === 'Temporary Unfit') {
        finalConclusionNotes = formData.temporaryUnfitNotes;
      } else if (formData.conclusionType === 'Unfit') {
        finalConclusionNotes = formData.unfitNotes;
      }

      const payload = {
        patientName: formData.patientName.trim(),
        nik: formData.nik.trim() || undefined,
        ageGender: formData.ageGender.trim(),
        birthDate: formData.birthDate.trim() || undefined,
        address: formData.address.trim() || undefined,
        examDate: formData.examDate,
        purpose: formData.purpose,

        vitalSigns: {
          bloodPressure: formData.bloodPressure,
          pulse: formData.pulse,
          respiration: formData.respiration,
          temperature: formData.temperature,
          consciousness: formData.consciousness,
        },
        anthropometry: {
          weight: `${formData.weight} kg`,
          height: `${formData.height} cm`,
          bmi: formData.bmi,
          nutritionStatus: formData.nutritionStatus,
        },
        physicalExam: {
          generalCondition: formData.generalCondition,
          head: formData.head,
          teeth: formData.teeth,
          ent: formData.ent,
          neck: formData.neck,
          heart: formData.heart,
          lungs: formData.lungs,
          abdomen: formData.abdomen,
          extremities: formData.extremities,
          eyes: formData.eyesVisus,
          colorVision: formData.colorVision,
          earSecret: formData.earSecret,
          noseSecret: formData.noseSecret,
          neckGland: formData.neckGland,
          lungsBreathSound: formData.lungsBreathSound,
          heartSound: formData.heartSound,
          abdomenPalpation: formData.abdomenPalpation,
          liverSpleen: formData.liverSpleen,
          extremitiesDetail: formData.extremitiesDetail,
        },
        labExam: {
          completeBlood: formData.completeBlood,
          completeUrine: formData.completeUrine,
          bloodChemistry: formData.bloodChemistry,
          additionalLab: formData.lipidLiver,
          hbsag: formData.hbsag,
          drugTest: formData.drugTest,
        },
        supportingExam: {
          thoraxXray: formData.thoraxXray,
          ekg: formData.ekg,
          treadmill: formData.treadmill,
          audiometry: formData.audiometry,
          spirometry: formData.spirometry,
        },
        conclusionType: formData.conclusionType,
        conclusionNotes: finalConclusionNotes,
        recommendations: formData.recommendations.split('\n').filter((s) => s.trim() !== ''),
        doctorName: formData.doctorName,
        doctorSip: formData.doctorSip,
      };

      if (isEditing && selectedReportId) {
        await apiFetch(`/api/mcu/${selectedReportId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        success('Laporan hasil MCU berhasil diperbarui.');
      } else {
        const created = await apiFetch<McuReportItem>('/api/mcu', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSelectedReportId(created.id);
        setIsEditing(true);
        success('Laporan hasil MCU baru berhasil disimpan.');
      }

      fetchReports();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan laporan MCU.';
      toastError(msg);
    }
  };

  const handleDownloadPdf = async (id: number) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vaksinku_token') : '';
      const url = `${getApiBaseUrl()}/api/mcu/${id}/pdf`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch {
      const token = typeof window !== 'undefined' ? localStorage.getItem('vaksinku_token') : '';
      window.open(`${getApiBaseUrl()}/api/mcu/${id}/pdf?token=${token}`, '_blank');
    }
  };

  const confirmDeleteReport = async () => {
    if (!reportToDelete) return;
    try {
      await apiFetch(`/api/mcu/${reportToDelete.id}`, { method: 'DELETE' });
      success(`Laporan MCU ${reportToDelete.patientName} berhasil dihapus.`);
      setReportToDelete(null);
      fetchReports();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus laporan.';
      toastError(msg);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Stethoscope className="w-6 h-6 text-teal-700" />
              Laporan Hasil Medical Check Up (MCU)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Template digital hasil pemeriksaan MCU dokter Klinik Utama Dr. H. A. Rotinsulu Cianjur
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasRole('Superadmin', 'Dokter') && (
              <button
                type="button"
                onClick={handleOpenNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Laporan MCU Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama pasien, NIK, atau no laporan MCU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-600 text-slate-900"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total Laporan: <strong className="text-slate-900 font-mono">{totalCount}</strong> Dokumen
          </span>
        </div>

        {/* Tabel Daftar Laporan MCU */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No. Laporan</th>
                  <th className="py-3 px-4">Nama Pasien / NIK</th>
                  <th className="py-3 px-4">Umur & JK</th>
                  <th className="py-3 px-4">Tgl Periksa</th>
                  <th className="py-3 px-4">Keperluan</th>
                  <th className="py-3 px-4 text-center">Kesimpulan Kelayakan</th>
                  <th className="py-3 px-4">Dokter Pemeriksa</th>
                  <th className="py-3 px-4 text-center">Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-medium">
                      Memuat data laporan MCU...
                    </td>
                  </tr>
                ) : reports.length > 0 ? (
                  reports.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-teal-800 whitespace-nowrap">
                        {r.reportNumber || `#MCU-${r.id}`}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{r.patientName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{r.nik || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{r.ageGender}</td>
                      <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">{r.examDate}</td>
                      <td className="py-3 px-4 text-slate-700">{r.purpose}</td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            r.conclusionType === 'Sehat'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : r.conclusionType === 'Sehat dengan catatan'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {r.conclusionType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{r.doctorName}</td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(r.id)}
                            className="p-1.5 rounded-lg text-teal-700 hover:text-teal-900 hover:bg-teal-50 cursor-pointer"
                            title="Unduh PDF Resmi 4 Halaman"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(r)}
                            className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer"
                            title="Edit Laporan & Preview"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {hasRole('Superadmin', 'Dokter') && (
                            <button
                              type="button"
                              onClick={() => setReportToDelete(r)}
                              className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer"
                              title="Hapus Laporan MCU"
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
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Belum ada laporan MCU. Klik &quot;Buat Laporan MCU Baru&quot; untuk memulai.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MODAL FULL-SCREEN: FORMULIR INPUT & PRATINJAU DOKUMEN RESMI  */}
        {/* ============================================================ */}
        {isEditorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs" onClick={() => setIsEditorOpen(false)} />
            <div className="relative bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 w-full max-w-7xl h-[95vh] flex flex-col z-10 overflow-hidden">
              {/* Header Modal */}
              <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                    <Stethoscope className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      {isEditing ? `Edit Laporan MCU: ${formData.patientName}` : 'Formulir Laporan Medical Check Up (MCU)'}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyNormalTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    title="Otomatis isi seluruh poin pemeriksaan dengan status normal"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                    <span>Pakai Template Normal</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveReport}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Simpan Laporan</span>
                  </button>

                  {selectedReportId && (
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(selectedReportId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Unduh PDF</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Split Body: Input Form (Left) & Live 4-Page Preview (Right) */}
              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                {/* PANEL KIRI: FORMULIR INPUT DOKTER */}
                <div className="w-full lg:w-1/2 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
                  {/* Tab Selector Form */}
                  <div className="flex border-b border-slate-200 bg-slate-50 text-xs overflow-x-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('resume')}
                      className={`px-3.5 py-2.5 font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                        activeFormTab === 'resume'
                          ? 'border-teal-700 text-teal-800 bg-white'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1. Identitas, Vital & Fisik
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('lab')}
                      className={`px-3.5 py-2.5 font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                        activeFormTab === 'lab'
                          ? 'border-teal-700 text-teal-800 bg-white'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      2. Lab & Penunjang
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('physical')}
                      className={`px-3.5 py-2.5 font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                        activeFormTab === 'physical'
                          ? 'border-teal-700 text-teal-800 bg-white'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      3. Fisik Detail & Organ
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('conclusion')}
                      className={`px-3.5 py-2.5 font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                        activeFormTab === 'conclusion'
                          ? 'border-teal-700 text-teal-800 bg-white'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      4. Kesimpulan & Saran
                    </button>
                  </div>

                  {/* Form Scroll Body */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
                    {/* TAB 1: IDENTITAS, VITAL & FISIK UMUM */}
                    {activeFormTab === 'resume' && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            Identitas Pasien (Satu-satunya yang diberi tabel)
                          </h3>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Nama Pasien *</label>
                            <input
                              type="text"
                              required
                              value={formData.patientName}
                              onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                              placeholder="Contoh: SUHERIONO"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">NIK (16 Digit)</label>
                              <input
                                type="text"
                                value={formData.nik}
                                onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                                placeholder="1207..."
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Umur / Jenis Kelamin *</label>
                              <input
                                type="text"
                                required
                                value={formData.ageGender}
                                onChange={(e) => setFormData({ ...formData, ageGender: e.target.value })}
                                placeholder="Contoh: 49 Tahun / Laki-Laki"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Tanggal Lahir</label>
                              <input
                                type="text"
                                value={formData.birthDate}
                                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                                placeholder="Contoh: 20 Juni 1977"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Tanggal Pemeriksaan *</label>
                              <input
                                type="date"
                                required
                                value={formData.examDate}
                                onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-slate-900 font-medium"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Keperluan</label>
                            <input
                              type="text"
                              value={formData.purpose}
                              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                              placeholder="Contoh: MCU kerja"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
                            <textarea
                              rows={2}
                              value={formData.address}
                              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                              placeholder="Alamat domisili pasien..."
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                            />
                          </div>
                        </div>

                        {/* A. Tanda Vital */}
                        <div className="space-y-3 pt-2">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            A. Tanda Vital
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Tekanan Darah</label>
                              <input
                                type="text"
                                value={formData.bloodPressure}
                                onChange={(e) => setFormData({ ...formData, bloodPressure: e.target.value })}
                                placeholder="Pre-hipertensi (127/90 mmHg)"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Nadi</label>
                              <input
                                type="text"
                                value={formData.pulse}
                                onChange={(e) => setFormData({ ...formData, pulse: e.target.value })}
                                placeholder="Normal (95 x/menit)"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Pernafasan</label>
                              <input
                                type="text"
                                value={formData.respiration}
                                onChange={(e) => setFormData({ ...formData, respiration: e.target.value })}
                                placeholder="Normal (26 x/menit)"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Suhu</label>
                              <input
                                type="text"
                                value={formData.temperature}
                                onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                                placeholder="Normal (36.2 °C)"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block font-semibold text-slate-700 mb-1">Kesadaran</label>
                              <input
                                type="text"
                                value={formData.consciousness}
                                onChange={(e) => setFormData({ ...formData, consciousness: e.target.value })}
                                placeholder="Compos Mentis"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                          </div>
                        </div>

                        {/* B. Antropometri */}
                        <div className="space-y-3 pt-2">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            B. Antropometri
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Berat Badan (BB - kg)</label>
                              <input
                                type="number"
                                value={formData.weight}
                                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                placeholder="67"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Tinggi Badan (TB - cm)</label>
                              <input
                                type="number"
                                value={formData.height}
                                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                                placeholder="160"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">IMT / BMI (Auto)</label>
                              <input
                                type="text"
                                readOnly
                                value={formData.bmi}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Status Gizi (Auto)</label>
                              <input
                                type="text"
                                value={formData.nutritionStatus}
                                onChange={(e) => setFormData({ ...formData, nutritionStatus: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-bold"
                              />
                            </div>
                          </div>
                        </div>

                        {/* C. Pemeriksaan Fisik */}
                        <div className="space-y-3 pt-2">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            C. Pemeriksaan Fisik
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Kepala</label>
                              <input
                                type="text"
                                value={formData.head}
                                onChange={(e) => setFormData({ ...formData, head: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Gigi</label>
                              <input
                                type="text"
                                value={formData.teeth}
                                onChange={(e) => setFormData({ ...formData, teeth: e.target.value })}
                                placeholder="Radics 1, stain+"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Telinga, Hidung, Tenggorokan</label>
                              <input
                                type="text"
                                value={formData.ent}
                                onChange={(e) => setFormData({ ...formData, ent: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Leher</label>
                              <input
                                type="text"
                                value={formData.neck}
                                onChange={(e) => setFormData({ ...formData, neck: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Jantung</label>
                              <input
                                type="text"
                                value={formData.heart}
                                onChange={(e) => setFormData({ ...formData, heart: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Paru paru</label>
                              <input
                                type="text"
                                value={formData.lungs}
                                onChange={(e) => setFormData({ ...formData, lungs: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Abdomen</label>
                              <input
                                type="text"
                                value={formData.abdomen}
                                onChange={(e) => setFormData({ ...formData, abdomen: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Ekstremelitas Atas dan Bawah</label>
                              <input
                                type="text"
                                value={formData.extremities}
                                onChange={(e) => setFormData({ ...formData, extremities: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: LAB & PENUNJANG (D, E, F, G, H, I) */}
                    {activeFormTab === 'lab' && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            D. Pemeriksaan Laboratorium
                          </h3>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Darah Lengkap</label>
                            <input
                              type="text"
                              value={formData.completeBlood}
                              onChange={(e) => setFormData({ ...formData, completeBlood: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Urine Lengkap</label>
                            <input
                              type="text"
                              value={formData.completeUrine}
                              onChange={(e) => setFormData({ ...formData, completeUrine: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              GDP, Kolestrol Total, LDL, Kreatinin, Ureum, Asam Urat
                            </label>
                            <textarea
                              rows={2}
                              value={formData.bloodChemistry}
                              onChange={(e) => setFormData({ ...formData, bloodChemistry: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              TG, HDL, SGOT, SGPT
                            </label>
                            <input
                              type="text"
                              value={formData.lipidLiver}
                              onChange={(e) => setFormData({ ...formData, lipidLiver: e.target.value })}
                              placeholder="Dalam batas normal / Hasil tidak batas normal"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-semibold"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">HBsAg</label>
                              <input
                                type="text"
                                value={formData.hbsag}
                                onChange={(e) => setFormData({ ...formData, hbsag: e.target.value })}
                                placeholder="Negatif"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Tes NAFZA (6 Parameter)</label>
                              <input
                                type="text"
                                value={formData.drugTest}
                                onChange={(e) => setFormData({ ...formData, drugTest: e.target.value })}
                                placeholder="Negatif"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                          </div>
                        </div>

                        {/* E - I. Penunjang */}
                        <div className="space-y-3 pt-2">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            E. Pemeriksaan Rontgen Thorax
                          </h3>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Gambaran Rontgen</label>
                            <textarea
                              rows={4}
                              value={formData.thoraxXray}
                              onChange={(e) => setFormData({ ...formData, thoraxXray: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                            />
                          </div>

                          <div className="space-y-2.5 pt-2">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">F. Pemeriksaan EKG</label>
                              <input
                                type="text"
                                value={formData.ekg}
                                onChange={(e) => setFormData({ ...formData, ekg: e.target.value })}
                                placeholder="Hasil terlampir / Normal"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">G. Pemeriksaan Threadmill</label>
                              <input
                                type="text"
                                value={formData.treadmill}
                                onChange={(e) => setFormData({ ...formData, treadmill: e.target.value })}
                                placeholder="Normal / Tidak dilakukan"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">H. Pemeriksaan Audiometri</label>
                              <textarea
                                rows={2}
                                value={formData.audiometry}
                                onChange={(e) => setFormData({ ...formData, audiometry: e.target.value })}
                                placeholder="Rata-rata ambang dengar kedua telinga dalam batas normal..."
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">I. Pemeriksaan Spirometri</label>
                              <input
                                type="text"
                                value={formData.spirometry}
                                onChange={(e) => setFormData({ ...formData, spirometry: e.target.value })}
                                placeholder="Restrictive / Normal"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: FISIK DETAIL (HALAMAN 3 & 4) */}
                    {activeFormTab === 'physical' && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            Pemeriksaan Fisik Umum
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Keadaan Umum</label>
                              <input
                                type="text"
                                value={formData.generalCondition}
                                onChange={(e) => setFormData({ ...formData, generalCondition: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Kesadaran</label>
                              <input
                                type="text"
                                value={formData.consciousness}
                                onChange={(e) => setFormData({ ...formData, consciousness: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-2">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            Pemeriksaan Kepala dan Leher
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Mata & Visus</label>
                              <input
                                type="text"
                                value={formData.eyesVisus}
                                onChange={(e) => setFormData({ ...formData, eyesVisus: e.target.value })}
                                placeholder="Visus OD 20/20, OS 20/20"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Buta Warna</label>
                              <input
                                type="text"
                                value={formData.colorVision}
                                onChange={(e) => setFormData({ ...formData, colorVision: e.target.value })}
                                placeholder="Tidak Buta warna"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Telinga</label>
                              <input
                                type="text"
                                value={formData.earSecret}
                                onChange={(e) => setFormData({ ...formData, earSecret: e.target.value })}
                                placeholder="Tidak ada sekret"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Hidung</label>
                              <input
                                type="text"
                                value={formData.noseSecret}
                                onChange={(e) => setFormData({ ...formData, noseSecret: e.target.value })}
                                placeholder="Tidak ada sekret"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block font-semibold text-slate-700 mb-1">Leher</label>
                              <input
                                type="text"
                                value={formData.neckGland}
                                onChange={(e) => setFormData({ ...formData, neckGland: e.target.value })}
                                placeholder="Tidak ada pembesaran kelenjar"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-2">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            Pemeriksaan Thorax
                          </h3>
                          <div className="space-y-2.5">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Paru - paru</label>
                              <input
                                type="text"
                                value={formData.lungsBreathSound}
                                onChange={(e) => setFormData({ ...formData, lungsBreathSound: e.target.value })}
                                placeholder="suara nafas vesikuler, tidak ada ronkhi/wheezing"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Jantung</label>
                              <input
                                type="text"
                                value={formData.heartSound}
                                onChange={(e) => setFormData({ ...formData, heartSound: e.target.value })}
                                placeholder="Bunyi jantung reguler, tidak ada murmur"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 pt-2">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            Pemeriksaan Abdomen & Extremitas
                          </h3>
                          <div className="space-y-2.5">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Inspeksi dan Palpasi</label>
                              <input
                                type="text"
                                value={formData.abdomenPalpation}
                                onChange={(e) => setFormData({ ...formData, abdomenPalpation: e.target.value })}
                                placeholder="lunak, tidak ada nyeri tekan"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Hepar dan Lien</label>
                              <input
                                type="text"
                                value={formData.liverSpleen}
                                onChange={(e) => setFormData({ ...formData, liverSpleen: e.target.value })}
                                placeholder="tidak teraba"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Pemeriksaan Extremitas (Atas dan Bawah)</label>
                              <input
                                type="text"
                                value={formData.extremitiesDetail}
                                onChange={(e) => setFormData({ ...formData, extremitiesDetail: e.target.value })}
                                placeholder="tidak ada edema, kekuatan otot baik"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 4: KESIMPULAN & SARAN */}
                    {activeFormTab === 'conclusion' && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                          Kesimpulan
                        </h3>

                        <div className="space-y-2.5">
                          <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                            <input
                              type="radio"
                              name="kesimpulan"
                              checked={formData.conclusionType === 'Sehat'}
                              onChange={() => setFormData({ ...formData, conclusionType: 'Sehat' })}
                              className="text-teal-600 focus:ring-teal-500"
                            />
                            <span className="font-bold text-slate-900">Sehat</span>
                          </label>

                          <div className={`p-2.5 rounded-lg border ${formData.conclusionType === 'Sehat dengan catatan' ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200'}`}>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="kesimpulan"
                                checked={formData.conclusionType === 'Sehat dengan catatan'}
                                onChange={() => setFormData({ ...formData, conclusionType: 'Sehat dengan catatan' })}
                                className="text-amber-600 focus:ring-amber-500"
                              />
                              <span className="font-bold text-slate-900">Sehat dengan catatan :</span>
                            </label>
                            {formData.conclusionType === 'Sehat dengan catatan' && (
                              <input
                                type="text"
                                value={formData.conclusionNotes}
                                onChange={(e) => setFormData({ ...formData, conclusionNotes: e.target.value })}
                                placeholder="perbaiki pola makan dan olahraga teratur, gangguan pendengaran"
                                className="w-full mt-2 px-3 py-1.5 rounded border border-amber-300 text-slate-900 bg-white"
                              />
                            )}
                          </div>

                          <div className={`p-2.5 rounded-lg border ${formData.conclusionType === 'Temporary Unfit' ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'}`}>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="kesimpulan"
                                checked={formData.conclusionType === 'Temporary Unfit'}
                                onChange={() => setFormData({ ...formData, conclusionType: 'Temporary Unfit' })}
                                className="text-rose-600 focus:ring-rose-500"
                              />
                              <span className="font-bold text-slate-900">Temporary unfit, _____________</span>
                            </label>
                            {formData.conclusionType === 'Temporary Unfit' && (
                              <input
                                type="text"
                                value={formData.temporaryUnfitNotes}
                                onChange={(e) => setFormData({ ...formData, temporaryUnfitNotes: e.target.value })}
                                placeholder="Alasan temporary unfit..."
                                className="w-full mt-2 px-3 py-1.5 rounded border border-rose-300 text-slate-900 bg-white"
                              />
                            )}
                          </div>

                          <div className={`p-2.5 rounded-lg border ${formData.conclusionType === 'Unfit' ? 'border-rose-500 bg-rose-50/50' : 'border-slate-200'}`}>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="kesimpulan"
                                checked={formData.conclusionType === 'Unfit'}
                                onChange={() => setFormData({ ...formData, conclusionType: 'Unfit' })}
                                className="text-rose-700 focus:ring-rose-500"
                              />
                              <span className="font-bold text-slate-900">Unfit, _____________</span>
                            </label>
                            {formData.conclusionType === 'Unfit' && (
                              <input
                                type="text"
                                value={formData.unfitNotes}
                                onChange={(e) => setFormData({ ...formData, unfitNotes: e.target.value })}
                                placeholder="Alasan unfit..."
                                className="w-full mt-2 px-3 py-1.5 rounded border border-rose-300 text-slate-900 bg-white"
                              />
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 pt-2">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            Saran Saran
                          </h3>
                          <textarea
                            rows={4}
                            value={formData.recommendations}
                            onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                            placeholder="Konsul Dokter Spesialis THT&#10;Konsul Gizi&#10;Berhenti merokok"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 leading-normal"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Dokter Pemeriksa *</label>
                            <input
                              type="text"
                              required
                              value={formData.doctorName}
                              onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">SIP Dokter Pemeriksa</label>
                            <input
                              type="text"
                              value={formData.doctorSip}
                              onChange={(e) => setFormData({ ...formData, doctorSip: e.target.value })}
                              placeholder="SIP.MR3203..."
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* PANEL KANAN: LIVE 4-PAGE REALISTIC DOCUMENT PREVIEW */}
                <div className="w-full lg:w-1/2 flex flex-col bg-slate-300/80 overflow-y-auto p-3 sm:p-5">
                  {/* Page Navigator Toolbar */}
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-300 shadow-xs mb-4 text-xs shrink-0">
                    <span className="font-bold text-slate-700">Tampilan Halaman Cetak A4:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActivePreviewPage('all')}
                        className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                          activePreviewPage === 'all' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Semua (4 Hal)
                      </button>
                      {[1, 2, 3, 4].map((pNum) => (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => setActivePreviewPage(pNum)}
                          className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                            activePreviewPage === pNum ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Hal {pNum}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* DOCUMENT PAGES CONTAINER */}
                  <div className="space-y-6 max-w-[595px] mx-auto w-full">
                    {/* =================================================== */}
                    {/* HALAMAN 1 (RESUME BAGIAN 1)                         */}
                    {/* =================================================== */}
                    {(activePreviewPage === 'all' || activePreviewPage === 1) && (
                      <div className="bg-white shadow-xl rounded-lg px-12 py-8 sm:px-14 space-y-3.5 border border-slate-300 text-[11pt] leading-relaxed text-slate-900 relative" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        {/* Header Image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/header-hasil.jpeg"
                          alt="Header RS"
                          className="w-full h-auto object-contain rounded"
                        />

                        {/* Title Dua Baris Biru Agak Tua Center */}
                        <div className="text-center font-bold text-[11px] uppercase tracking-wide text-blue-900 leading-tight pt-1">
                          <div>RESUME HASIL PEMERIKSAAN</div>
                          <div>MEDICAL CHECK UP (MCU KERJA)</div>
                        </div>

                        {/* TABEL HANYA UNTUK IDENTITAS PASIEN (JUDUL DI LUAR TABEL) */}
                        <div>
                          <p className="font-bold text-[9px] uppercase text-slate-900 mb-1">IDENTITAS PASIEN</p>
                          <table className="w-full border-collapse border border-slate-800 text-[9.5px]">
                            <tbody className="divide-y divide-slate-300">
                            <tr>
                              <td className="p-1.5 w-36 font-bold text-slate-800 border-r border-slate-300">Nama</td>
                              <td className="p-1.5 font-bold text-slate-900">: {formData.patientName || '[Nama Pasien]'}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">Umur / Jenis Kelamin</td>
                              <td className="p-1.5">: {formData.ageGender}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">Tanggal Lahir</td>
                              <td className="p-1.5">: {formData.birthDate || '-'}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">Alamat</td>
                              <td className="p-1.5">: {formData.address || '-'}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">Tanggal Pemeriksaan</td>
                              <td className="p-1.5">: {formData.examDate}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">Keperluan</td>
                              <td className="p-1.5">: {formData.purpose}</td>
                            </tr>
                            </tbody>
                          </table>
                        </div>
                        {/* POINT-POINT TANPA TABEL (A, B, C) */}
                        <div className="space-y-3 pt-1 text-[9.5px]">
                          <div>
                            <p className="font-bold text-blue-900 mb-1">A. TANDA VITAL</p>
                            <div className="space-y-0.5 pl-3">
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Tekanan Darah</span><span>: {formData.bloodPressure}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Nadi</span><span>: {formData.pulse}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Pernafasan</span><span>: {formData.respiration}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Suhu</span><span>: {formData.temperature}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Kesadaran</span><span>: {formData.consciousness}</span></div>
                            </div>
                          </div>

                          <div>
                            <p className="font-bold text-blue-900 mb-1">B. ANTROPOMETRI</p>
                            <div className="space-y-0.5 pl-3">
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Berat Badan (BB)</span><span>: {formData.weight} kg</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Tinggi Badan (TB)</span><span>: {formData.height} cm</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">IMT / BMI</span><span>: {formData.bmi}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Status Gizi</span><span>: {formData.nutritionStatus}</span></div>
                            </div>
                          </div>

                          <div>
                            <p className="font-bold text-blue-900 mb-1">C. Pemeriksaan Fisik</p>
                            <div className="space-y-0.5 pl-3">
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Kepala</span><span>: {formData.head}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Gigi</span><span>: {formData.teeth}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Telinga, Hidung, Tenggorokan</span><span>: {formData.ent}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Leher</span><span>: {formData.neck}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Jantung</span><span>: {formData.heart}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Paru paru</span><span>: {formData.lungs}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Abdomen</span><span>: {formData.abdomen}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Ekstremelitas Atas dan Bawah</span><span>: {formData.extremities}</span></div>
                            </div>
                          </div>
                        </div>

                        {/* Footer Page Number */}
                        <div className="pt-3 border-t border-slate-200 text-center text-[11pt] text-slate-700 font-medium" style={{ fontFamily: 'Cambria, Georgia, serif' }}>
                          Page 1 of 4
                        </div>
                      </div>
                    )}

                    {/* =================================================== */}
                    {/* HALAMAN 2 (RESUME BAGIAN 2: LAB & PENUNJANG)        */}
                    {/* =================================================== */}
                    {(activePreviewPage === 'all' || activePreviewPage === 2) && (
                      <div className="bg-white shadow-xl rounded-lg px-12 py-8 sm:px-14 space-y-4 border border-slate-300 text-[11pt] leading-relaxed text-slate-900 relative" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/header-hasil.jpeg"
                          alt="Header RS"
                          className="w-full h-auto object-contain rounded"
                        />

                        {/* POINT-POINT TANPA TABEL (D, E, F, G, H, I) */}
                        <div className="space-y-3.5 pt-2 text-[9.5px]">
                          <div>
                            <p className="font-bold text-blue-900 mb-1">D. Pemeriksaan Laboratorium</p>
                            <div className="space-y-1 pl-3">
                              <div className="flex"><span className="w-56 font-medium text-slate-700">Darah Lengkap</span><span>: {formData.completeBlood}</span></div>
                              <div className="flex"><span className="w-56 font-medium text-slate-700">Urine Lengkap</span><span>: {formData.completeUrine}</span></div>
                              <div className="flex"><span className="w-56 font-medium text-slate-700">GDP, Kolestrol Total, LDL, Kreatinin, Ureum, Asam Urat</span><span>: {formData.bloodChemistry}</span></div>
                              <div className="flex"><span className="w-56 font-medium text-slate-700">TG, HDL, SGOT, SGPT</span><span>: {formData.lipidLiver}</span></div>
                              <div className="flex"><span className="w-56 font-medium text-slate-700">HBsAg</span><span>: {formData.hbsag}</span></div>
                              <div className="flex"><span className="w-56 font-medium text-slate-700">Tes NAFZA (6 Parameter)</span><span>: {formData.drugTest}</span></div>
                            </div>
                          </div>

                          <div>
                            <p className="font-bold text-blue-900 mb-1">E. Pemeriksaan Rontgen Thorax</p>
                            <div className="pl-3">
                              <span className="font-medium text-slate-700 block mb-0.5">Gambaran Rontgen:</span>
                              <p className="whitespace-pre-line text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 text-[9px] leading-relaxed">
                                {formData.thoraxXray}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div>
                              <p className="font-bold text-blue-900">F. Pemeriksaan EKG</p>
                              <div className="pl-3 flex"><span className="w-44 font-medium text-slate-700">Hasil EKG</span><span>: {formData.ekg}</span></div>
                            </div>

                            <div>
                              <p className="font-bold text-blue-900">G. Pemeriksaan Threadmill</p>
                              <div className="pl-3 flex"><span className="w-44 font-medium text-slate-700">Hasil Threadmill</span><span>: {formData.treadmill}</span></div>
                            </div>

                            <div>
                              <p className="font-bold text-blue-900">H. Pemeriksaan Audiometri</p>
                              <div className="pl-3 flex"><span className="w-44 font-medium text-slate-700">Hasil Audiometri</span><span>: {formData.audiometry}</span></div>
                            </div>

                            <div>
                              <p className="font-bold text-blue-900">I. Pemeriksaan Spirometri</p>
                              <div className="pl-3 flex"><span className="w-44 font-medium text-slate-700">Hasil Spirometri</span><span>: {formData.spirometry}</span></div>
                            </div>
                          </div>
                        </div>

                        {/* Footer Page Number */}
                        <div className="pt-3 border-t border-slate-200 text-center text-[11pt] text-slate-700 font-medium" style={{ fontFamily: 'Cambria, Georgia, serif' }}>
                          Page 2 of 4
                        </div>
                      </div>
                    )}

                    {/* =================================================== */}
                    {/* HALAMAN 3 (HASIL PEMERIKSAAN FISIK DETAIL)          */}
                    {/* =================================================== */}
                    {(activePreviewPage === 'all' || activePreviewPage === 3) && (
                      <div className="bg-white shadow-xl rounded-lg px-12 py-8 sm:px-14 space-y-3.5 border border-slate-300 text-[11pt] leading-relaxed text-slate-900 relative" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        {/* Header Image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/header-hasil.jpeg"
                          alt="Header RS"
                          className="w-full h-auto object-contain rounded"
                        />

                        {/* Title Dua Baris Biru Agak Tua Center */}
                        <div className="text-center font-bold text-[11px] uppercase tracking-wide text-blue-900 leading-tight pt-1">
                          <div>HASIL PEMERIKSAAN FISIK</div>
                          <div>MEDICAL CHECK UP (MCU KERJA)</div>
                        </div>

                        {/* TABEL IDENTITAS (JUDUL DI LUAR TABEL) */}
                        <div>
                          <p className="font-bold text-[9px] uppercase text-slate-900 mb-1">IDENTITAS</p>
                          <table className="w-full border-collapse border border-slate-800 text-[9.5px]">
                            <tbody className="divide-y divide-slate-300">
                            <tr>
                              <td className="p-1.5 w-36 font-bold text-slate-800 border-r border-slate-300">Nama</td>
                              <td className="p-1.5 font-bold text-slate-900">: {formData.patientName || '[Nama Pasien]'}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">Umur / Jenis Kelamin</td>
                              <td className="p-1.5">: {formData.ageGender}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">Tanggal Lahir</td>
                              <td className="p-1.5">: {formData.birthDate || '-'}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">Alamat</td>
                              <td className="p-1.5">: {formData.address || '-'}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">Tanggal Pemeriksaan</td>
                              <td className="p-1.5">: {formData.examDate}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">Keperluan</td>
                              <td className="p-1.5">: {formData.purpose}</td>
                            </tr>
                            </tbody>
                          </table>
                        </div>
                        {/* DETAIL FISIK TANPA TABEL */}
                        <div className="space-y-2.5 pt-1 text-[9.5px]">
                          <div>
                            <p className="font-bold text-blue-900 mb-0.5">Pemeriksaan Tanda Vital</p>
                            <div className="space-y-0.5 pl-3">
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Tekanan Darah</span><span>: {formData.bloodPressure}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Nadi</span><span>: {formData.pulse}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Pernafasan</span><span>: {formData.respiration}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Suhu</span><span>: {formData.temperature}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Berat Badan (BB)</span><span>: {formData.weight} Kg</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Tinggi Badan (TB)</span><span>: {formData.height} cm</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">IMT / BMI</span><span>: {formData.bmi}</span></div>
                            </div>
                          </div>

                          <div>
                            <p className="font-bold text-blue-900 mb-0.5">Pemeriksaan Fisik Umum</p>
                            <div className="space-y-0.5 pl-3">
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Keadaan Umum</span><span>: {formData.generalCondition}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Kesadaran</span><span>: {formData.consciousness}</span></div>
                            </div>
                          </div>

                          <div>
                            <p className="font-bold text-blue-900 mb-0.5">Pemeriksaan Kepala dan Leher</p>
                            <div className="space-y-0.5 pl-3">
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Mata & Visus</span><span>: {formData.eyesVisus}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Buta Warna</span><span>: {formData.colorVision}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Telinga</span><span>: {formData.earSecret}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Hidung</span><span>: {formData.noseSecret}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Leher</span><span>: {formData.neckGland}</span></div>
                            </div>
                          </div>

                          <div>
                            <p className="font-bold text-blue-900 mb-0.5">Pemeriksaan Thorax</p>
                            <div className="space-y-0.5 pl-3">
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Paru - paru</span><span>: {formData.lungsBreathSound}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Jantung</span><span>: {formData.heartSound}</span></div>
                            </div>
                          </div>
                        </div>

                        {/* Footer Page Number */}
                        <div className="pt-3 border-t border-slate-200 text-center text-[11pt] text-slate-700 font-medium" style={{ fontFamily: 'Cambria, Georgia, serif' }}>
                          Page 3 of 4
                        </div>
                      </div>
                    )}

                    {/* =================================================== */}
                    {/* HALAMAN 4 (ABDOMEN, KESIMPULAN, SARAN & TTD)        */}
                    {/* =================================================== */}
                    {(activePreviewPage === 'all' || activePreviewPage === 4) && (
                      <div className="bg-white shadow-xl rounded-lg px-12 py-8 sm:px-14 space-y-4 border border-slate-300 text-[11pt] leading-relaxed text-slate-900 relative" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/header-hasil.jpeg"
                          alt="Header RS"
                          className="w-full h-auto object-contain rounded"
                        />

                        {/* DETAIL LANJUTAN TANPA TABEL */}
                        <div className="space-y-3 pt-1 text-[9.5px]">
                          <div>
                            <p className="font-bold text-blue-900 mb-1">Pemeriksaan Abdomen</p>
                            <div className="space-y-0.5 pl-3">
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Inspeksi dan Palpasi</span><span>: {formData.abdomenPalpation}</span></div>
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Hepar dan Lien</span><span>: {formData.liverSpleen}</span></div>
                            </div>
                          </div>

                          <div>
                            <p className="font-bold text-blue-900 mb-1">Pemeriksaan Extremitas</p>
                            <div className="space-y-0.5 pl-3">
                              <div className="flex"><span className="w-44 font-medium text-slate-700">Atas dan Bawah</span><span>: {formData.extremitiesDetail}</span></div>
                            </div>
                          </div>
                        </div>

                        {/* KESIMPULAN (TANPA BORDER KOTAK LUAR) */}
                        <div>
                          <p className="font-bold text-blue-900 mb-1">Kesimpulan</p>
                          <div className="space-y-1.5 pl-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center font-bold text-[8.5px] ${formData.conclusionType === 'Sehat' ? 'bg-blue-900 text-white border-blue-900' : 'border-slate-400'}`}>
                                {formData.conclusionType === 'Sehat' ? '✓' : ''}
                              </span>
                              <span>Sehat</span>
                            </div>

                            <div className="flex items-start gap-2">
                              <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center font-bold text-[8.5px] mt-0.5 ${formData.conclusionType === 'Sehat dengan catatan' ? 'bg-blue-900 text-white border-blue-900' : 'border-slate-400'}`}>
                                {formData.conclusionType === 'Sehat dengan catatan' ? '✓' : ''}
                              </span>
                              <span>
                                Sehat dengan catatan : <strong className="text-slate-800 font-semibold">{formData.conclusionNotes || '_____________'}</strong>
                              </span>
                            </div>

                            <div className="flex items-start gap-2">
                              <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center font-bold text-[8.5px] mt-0.5 ${formData.conclusionType === 'Temporary Unfit' ? 'bg-blue-900 text-white border-blue-900' : 'border-slate-400'}`}>
                                {formData.conclusionType === 'Temporary Unfit' ? '✓' : ''}
                              </span>
                              <span>
                                Temporary unfit, <strong className="text-slate-800 font-semibold">{formData.temporaryUnfitNotes || '_____________'}</strong>
                              </span>
                            </div>

                            <div className="flex items-start gap-2">
                              <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center font-bold text-[8.5px] mt-0.5 ${formData.conclusionType === 'Unfit' ? 'bg-blue-900 text-white border-blue-900' : 'border-slate-400'}`}>
                                {formData.conclusionType === 'Unfit' ? '✓' : ''}
                              </span>
                              <span>
                                Unfit, <strong className="text-slate-800 font-semibold">{formData.unfitNotes || '_____________'}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* SARAN SARAN (TANPA BORDER KOTAK LUAR) */}
                        <div>
                          <p className="font-bold text-blue-900 mb-1">SARAN - SARAN</p>
                          <div className="space-y-1 pl-3">
                            {formData.recommendations ? (
                              formData.recommendations.split('\n').filter((s) => s.trim() !== '').map((s, idx) => (
                                <p key={idx} className="text-slate-800">
                                  • {s}
                                </p>
                              ))
                            ) : (
                              <p className="text-slate-400 italic">• Tidak ada saran khusus.</p>
                            )}
                          </div>
                        </div>

                        {/* TANDA TANGAN DOKTER */}
                        <div className="pt-2 flex justify-end text-[9.5px]">
                          <div className="w-52 text-center space-y-1">
                            <p className="text-slate-700">Dokter Pemeriksa,</p>
                            <div className="h-14 flex items-center justify-center text-slate-300 italic text-[9px]">
                              (Tanda Tangan)
                            </div>
                            <p className="font-bold text-slate-900 underline">{formData.doctorName}</p>
                            <p className="text-slate-500 text-[8.5px] font-mono">{formData.doctorSip}</p>
                          </div>
                        </div>

                        {/* Footer Page Number */}
                        <div className="pt-3 border-t border-slate-200 text-center text-[11pt] text-slate-700 font-medium" style={{ fontFamily: 'Cambria, Georgia, serif' }}>
                          Page 4 of 4
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Laporan MCU */}
        <ConfirmModal
          isOpen={!!reportToDelete}
          title="Konfirmasi Hapus Laporan MCU"
          message={`Apakah Anda yakin ingin menghapus data laporan MCU pasien ${reportToDelete?.patientName}? Laporan yang dihapus tidak dapat dipulihkan.`}
          confirmText="Ya, Hapus Laporan"
          cancelText="Batal"
          onConfirm={confirmDeleteReport}
          onCancel={() => setReportToDelete(null)}
        />
      </div>
    </AppShell>
  );
}
