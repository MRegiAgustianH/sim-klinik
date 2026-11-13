'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  PlusCircle,
  FileText,
  UserCheck,
  ClipboardList,
} from 'lucide-react';

interface McuExamItem {
  id: string;
  name: string;
  value: string;
}

interface McuExamSection {
  id: string;
  title: string;
  items: McuExamItem[];
}

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
  examinationSections: string | null;
  conclusionType: 'Sehat' | 'Sehat dengan catatan' | 'Temporary Unfit' | 'Unfit';
  conclusionNotes: string | null;
  recommendations: string | null;
  doctorName: string;
  doctorSip: string | null;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_EXAM_SECTIONS: McuExamSection[] = [
  {
    id: 'sec_vital',
    title: 'A. TANDA VITAL',
    items: [
      { id: 'vital_bp', name: 'Tekanan Darah', value: '120/80 mmHg' },
      { id: 'vital_pulse', name: 'Nadi', value: '80 x/menit' },
      { id: 'vital_resp', name: 'Pernafasan', value: '18 x/menit' },
      { id: 'vital_temp', name: 'Suhu', value: '36.5 °C' },
      { id: 'vital_cons', name: 'Kesadaran', value: 'Compos Mentis' },
    ],
  },
  {
    id: 'sec_antropo',
    title: 'B. ANTROPOMETRI',
    items: [
      { id: 'antropo_weight', name: 'Berat Badan (BB)', value: '60 kg' },
      { id: 'antropo_height', name: 'Tinggi Badan (TB)', value: '165 cm' },
      { id: 'antropo_bmi', name: 'IMT / BMI', value: '22.0' },
      { id: 'antropo_nutrition', name: 'Status Gizi', value: 'Normal' },
    ],
  },
  {
    id: 'sec_physical',
    title: 'C. PEMERIKSAAN FISIK',
    items: [
      { id: 'phy_gen', name: 'Keadaan Umum', value: 'Baik' },
      { id: 'phy_head', name: 'Kepala', value: 'Normal' },
      { id: 'phy_eyes', name: 'Mata & Visus', value: 'Visus OD 20/20, OS 20/20' },
      { id: 'phy_color', name: 'Buta Warna', value: 'Tidak Buta Warna' },
      { id: 'phy_teeth', name: 'Gigi & Mulut', value: 'Normal' },
      { id: 'phy_ent', name: 'Telinga, Hidung, Tenggorokan', value: 'Normal' },
      { id: 'phy_neck', name: 'Leher', value: 'Normal' },
      { id: 'phy_heart', name: 'Jantung', value: 'Bunyi jantung reguler, tidak ada murmur' },
      { id: 'phy_lungs', name: 'Paru paru', value: 'Suara nafas vesikuler, tidak ada ronkhi/wheezing' },
      { id: 'phy_abdomen', name: 'Abdomen', value: 'Lunak, tidak ada nyeri tekan' },
      { id: 'phy_ext', name: 'Ekstremitas Atas dan Bawah', value: 'Tidak ada edema, kekuatan otot baik' },
    ],
  },
  {
    id: 'sec_lab',
    title: 'D. PEMERIKSAAN LABORATORIUM',
    items: [
      { id: 'lab_blood', name: 'Darah Lengkap', value: 'Dalam batas normal' },
      { id: 'lab_urine', name: 'Urine Lengkap', value: 'Dalam batas normal' },
      { id: 'lab_chem', name: 'Kimia Darah', value: 'Dalam batas normal' },
      { id: 'lab_lipid', name: 'Profil Lipid & Fungsi Hati', value: 'Dalam batas normal' },
      { id: 'lab_hbsag', name: 'HBsAg', value: 'Negatif' },
      { id: 'lab_drug', name: 'Tes NAFZA', value: 'Negatif' },
    ],
  },
  {
    id: 'sec_sup',
    title: 'E. PEMERIKSAAN PENUNJANG',
    items: [
      { id: 'sup_xray', name: 'Rontgen Thorax', value: 'Cor dan Pulmo dalam batas normal, tidak tampak kelainan aktif.' },
      { id: 'sup_ekg', name: 'EKG', value: 'Normal Sinus Rhythm' },
      { id: 'sup_treadmill', name: 'Threadmill', value: 'Normal' },
      { id: 'sup_audio', name: 'Audiometri', value: 'Dalam batas normal' },
      { id: 'sup_spiro', name: 'Spirometri', value: 'Normal' },
    ],
  },
];

const SUGGESTED_EXAMS = [
  'USG Abdomen',
  'USG Kandungan / Kebidanan',
  'Pemeriksaan Mata / Refraksi',
  'Pemeriksaan Gigi Detail',
  'Audiometri',
  'Spirometri',
  'Threadmill Test',
  'Rontgen Thorax PA',
  'Kolesterol Total',
  'Trigliserida',
  'HDL Kolesterol',
  'LDL Kolesterol',
  'Asam Urat',
  'Ureum & Kreatinin',
  'SGOT & SGPT',
  'Glukosa Puasa (GDP)',
  'Glukosa 2 Jam PP',
  'HbA1c',
  'Tes Kehamilan (PP Test)',
  'Golongan Darah & Rhesus',
  'Tes Buta Warna Ishihara',
];

interface PaginatedPage {
  pageNumber: number;
  isFirstPage: boolean;
  sections: {
    sectionTitle: string;
    items: McuExamItem[];
  }[];
  hasConclusionAndSign: boolean;
}

export default function McuPage() {
  const { user, hasRole } = useAuth();
  const { success, error: toastError } = useToast();

  const [reports, setReports] = useState<McuReportItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Active state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [reportToDelete, setReportToDelete] = useState<McuReportItem | null>(null);

  // Active form tab: 'patient' | 'exams' | 'conclusion'
  const [activeFormTab, setActiveFormTab] = useState<'patient' | 'exams' | 'conclusion'>('patient');
  const [activePreviewPage, setActivePreviewPage] = useState<number | 'all'>('all');

  // Patient Info & Conclusion State
  const [formData, setFormData] = useState({
    patientName: '',
    nik: '',
    ageGender: '35 Tahun / Laki-Laki',
    birthDate: '',
    address: 'Cianjur, Jawa Barat',
    examDate: new Date().toISOString().split('T')[0],
    purpose: 'MCU Kerja',
    conclusionType: 'Sehat' as 'Sehat' | 'Sehat dengan catatan' | 'Temporary Unfit' | 'Unfit',
    conclusionNotes: '',
    temporaryUnfitNotes: '',
    unfitNotes: '',
    recommendations: 'Pertahankan pola hidup sehat dan olahraga teratur.\nMinum air putih minimal 2 liter per hari.',
    doctorName: 'dr. Arinda Puteri P',
    doctorSip: 'SIP.MR32032507002898',
  });

  // Flexible examination sections
  const [sections, setSections] = useState<McuExamSection[]>(DEFAULT_EXAM_SECTIONS);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

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
      const msg = err instanceof Error ? err.message : 'Gagal memuat daftar laporan MCU.';
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, toastError]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Open New Form
  const handleOpenNew = () => {
    setIsEditing(false);
    setSelectedReportId(null);
    setFormData({
      patientName: '',
      nik: '',
      ageGender: '35 Tahun / Laki-Laki',
      birthDate: '',
      address: 'Cianjur, Jawa Barat',
      examDate: new Date().toISOString().split('T')[0],
      purpose: 'MCU Kerja',
      conclusionType: 'Sehat',
      conclusionNotes: '',
      temporaryUnfitNotes: '',
      unfitNotes: '',
      recommendations: 'Pertahankan pola hidup sehat dan olahraga teratur.\nMinum air putih minimal 2 liter per hari.',
      doctorName: user?.fullName?.startsWith('dr') ? user.fullName : 'dr. Arinda Puteri P',
      doctorSip: 'SIP.MR32032507002898',
    });
    setSections(JSON.parse(JSON.stringify(DEFAULT_EXAM_SECTIONS)));
    setActiveFormTab('patient');
    setActivePreviewPage('all');
    setIsEditorOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (r: McuReportItem) => {
    setIsEditing(true);
    setSelectedReportId(r.id);

    let recsText = '';
    if (r.recommendations) {
      try {
        const parsed = JSON.parse(r.recommendations);
        recsText = Array.isArray(parsed) ? parsed.join('\n') : String(parsed);
      } catch {
        recsText = r.recommendations;
      }
    }

    setFormData({
      patientName: r.patientName,
      nik: r.nik || '',
      ageGender: r.ageGender,
      birthDate: r.birthDate || '',
      address: r.address || '',
      examDate: r.examDate,
      purpose: r.purpose || 'MCU Kerja',
      conclusionType: r.conclusionType,
      conclusionNotes: r.conclusionNotes || '',
      temporaryUnfitNotes: r.conclusionType === 'Temporary Unfit' ? r.conclusionNotes || '' : '',
      unfitNotes: r.conclusionType === 'Unfit' ? r.conclusionNotes || '' : '',
      recommendations: recsText,
      doctorName: r.doctorName,
      doctorSip: r.doctorSip || 'SIP.MR32032507002898',
    });

    // Parse sections
    let parsedSections: McuExamSection[] = [];
    if (r.examinationSections) {
      try {
        const parsed = JSON.parse(r.examinationSections);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsedSections = parsed;
        }
      } catch {
        parsedSections = [];
      }
    }

    // Fallback if examinationSections was null (convert from legacy)
    if (parsedSections.length === 0) {
      const parseJson = (s: string | null): Record<string, string> => {
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

      const secVital: McuExamItem[] = [];
      if (vital.bloodPressure) secVital.push({ id: 'vital_bp', name: 'Tekanan Darah', value: vital.bloodPressure });
      if (vital.pulse) secVital.push({ id: 'vital_pulse', name: 'Nadi', value: vital.pulse });
      if (vital.respiration) secVital.push({ id: 'vital_resp', name: 'Pernafasan', value: vital.respiration });
      if (vital.temperature) secVital.push({ id: 'vital_temp', name: 'Suhu', value: vital.temperature });
      if (vital.consciousness) secVital.push({ id: 'vital_cons', name: 'Kesadaran', value: vital.consciousness });
      if (secVital.length > 0) parsedSections.push({ id: 'sec_vital', title: 'A. TANDA VITAL', items: secVital });

      const secAntropo: McuExamItem[] = [];
      if (antropo.weight) secAntropo.push({ id: 'antropo_weight', name: 'Berat Badan (BB)', value: antropo.weight });
      if (antropo.height) secAntropo.push({ id: 'antropo_height', name: 'Tinggi Badan (TB)', value: antropo.height });
      if (antropo.bmi) secAntropo.push({ id: 'antropo_bmi', name: 'IMT / BMI', value: antropo.bmi });
      if (antropo.nutritionStatus) secAntropo.push({ id: 'antropo_nutrition', name: 'Status Gizi', value: antropo.nutritionStatus });
      if (secAntropo.length > 0) parsedSections.push({ id: 'sec_antropo', title: 'B. ANTROPOMETRI', items: secAntropo });

      const secPhysical: McuExamItem[] = [];
      if (physical.generalCondition) secPhysical.push({ id: 'phy_gen', name: 'Keadaan Umum', value: physical.generalCondition });
      if (physical.head) secPhysical.push({ id: 'phy_head', name: 'Kepala', value: physical.head });
      if (physical.eyes) secPhysical.push({ id: 'phy_eyes', name: 'Mata & Visus', value: physical.eyes });
      if (physical.colorVision) secPhysical.push({ id: 'phy_color', name: 'Buta Warna', value: physical.colorVision });
      if (physical.teeth) secPhysical.push({ id: 'phy_teeth', name: 'Gigi & Mulut', value: physical.teeth });
      if (physical.ent) secPhysical.push({ id: 'phy_ent', name: 'Telinga, Hidung, Tenggorokan', value: physical.ent });
      if (physical.neck) secPhysical.push({ id: 'phy_neck', name: 'Leher', value: physical.neck });
      if (physical.heart) secPhysical.push({ id: 'phy_heart', name: 'Jantung', value: physical.heart });
      if (physical.lungs) secPhysical.push({ id: 'phy_lungs', name: 'Paru paru', value: physical.lungs });
      if (physical.abdomen) secPhysical.push({ id: 'phy_abdomen', name: 'Abdomen', value: physical.abdomen });
      if (physical.extremities) secPhysical.push({ id: 'phy_ext', name: 'Ekstremitas Atas dan Bawah', value: physical.extremities });
      if (secPhysical.length > 0) parsedSections.push({ id: 'sec_physical', title: 'C. PEMERIKSAAN FISIK', items: secPhysical });

      const secLab: McuExamItem[] = [];
      if (lab.completeBlood) secLab.push({ id: 'lab_blood', name: 'Darah Lengkap', value: lab.completeBlood });
      if (lab.completeUrine) secLab.push({ id: 'lab_urine', name: 'Urine Lengkap', value: lab.completeUrine });
      if (lab.bloodChemistry) secLab.push({ id: 'lab_chem', name: 'Kimia Darah', value: lab.bloodChemistry });
      if (lab.additionalLab) secLab.push({ id: 'lab_add', name: 'Profil Lipid & Fungsi Hati', value: lab.additionalLab });
      if (lab.hbsag) secLab.push({ id: 'lab_hbsag', name: 'HBsAg', value: lab.hbsag });
      if (lab.drugTest) secLab.push({ id: 'lab_drug', name: 'Tes NAFZA', value: lab.drugTest });
      if (secLab.length > 0) parsedSections.push({ id: 'sec_lab', title: 'D. PEMERIKSAAN LABORATORIUM', items: secLab });

      const secSup: McuExamItem[] = [];
      if (supporting.thoraxXray) secSup.push({ id: 'sup_xray', name: 'Rontgen Thorax', value: supporting.thoraxXray });
      if (supporting.ekg) secSup.push({ id: 'sup_ekg', name: 'EKG', value: supporting.ekg });
      if (supporting.treadmill) secSup.push({ id: 'sup_treadmill', name: 'Threadmill', value: supporting.treadmill });
      if (supporting.audiometry) secSup.push({ id: 'sup_audio', name: 'Audiometri', value: supporting.audiometry });
      if (supporting.spirometry) secSup.push({ id: 'sup_spiro', name: 'Spirometri', value: supporting.spirometry });
      if (secSup.length > 0) parsedSections.push({ id: 'sec_sup', title: 'E. PEMERIKSAAN PENUNJANG', items: secSup });
    }

    setSections(parsedSections.length > 0 ? parsedSections : JSON.parse(JSON.stringify(DEFAULT_EXAM_SECTIONS)));
    setActiveFormTab('patient');
    setActivePreviewPage('all');
    setIsEditorOpen(true);
  };

  // Section item handlers
  const handleAddItem = (sectionId: string, itemName = '', itemValue = '') => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const newItem: McuExamItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: itemName,
          value: itemValue,
        };
        return { ...sec, items: [...sec.items, newItem] };
      })
    );
  };

  const handleRemoveItem = (sectionId: string, itemId: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return { ...sec, items: sec.items.filter((it) => it.id !== itemId) };
      })
    );
  };

  const handleUpdateItem = (sectionId: string, itemId: string, field: 'name' | 'value', value: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          items: sec.items.map((it) => (it.id === itemId ? { ...it, [field]: value } : it)),
        };
      })
    );
  };

  const handleAddSection = () => {
    if (!newCategoryName.trim()) return;
    const newSec: McuExamSection = {
      id: `sec_${Date.now()}`,
      title: newCategoryName.trim(),
      items: [{ id: `item_${Date.now()}`, name: '', value: '' }],
    };
    setSections((prev) => [...prev, newSec]);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleRemoveSection = (sectionId: string) => {
    setSections((prev) => prev.filter((sec) => sec.id !== sectionId));
  };

  const handleResetToStandard = () => {
    setSections(JSON.parse(JSON.stringify(DEFAULT_EXAM_SECTIONS)));
    success('Template pemeriksaan standar berhasil dimuat.');
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
        examinationSections: sections,
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

  // Download PDF
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

  // Confirm delete report
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

  // Total examination points across all sections
  const totalItemsCount = useMemo(() => {
    return sections.reduce((acc, s) => acc + s.items.length, 0);
  }, [sections]);

  // Real-time dynamic pagination algorithm for live preview
  const paginatedPages = useMemo<PaginatedPage[]>(() => {
    let currentPageNumber = 1;
    // Budget Halaman 1: ruang aman setelah Header, Judul & Tabel Identitas (~290px)
    let currentRemainingHeight = 290;
    let currentSectionsInPage: { sectionTitle: string; items: McuExamItem[] }[] = [];
    const pages: PaginatedPage[] = [];

    sections.forEach((sec) => {
      const validItems = sec.items.filter((it) => it.name.trim() !== '' || it.value.trim() !== '');
      if (validItems.length === 0) return;

      let currentSectionChunk: { sectionTitle: string; items: McuExamItem[] } = {
        sectionTitle: sec.title,
        items: [],
      };
      let sectionTitleAdded = false;

      validItems.forEach((item) => {
        // Perhitungan tinggi baris item riil
        const valueLength = item.value?.length || 0;
        const lineCount = Math.max(1, Math.ceil(valueLength / 45));
        const itemHeight = lineCount * 18 + 2; // ~20px per baris teks tunggal
        const neededHeight = (!sectionTitleAdded ? 28 : 0) + itemHeight;

        if (currentRemainingHeight < neededHeight) {
          if (currentSectionChunk.items.length > 0) {
            currentSectionsInPage.push(currentSectionChunk);
          }
          pages.push({
            pageNumber: currentPageNumber,
            isFirstPage: currentPageNumber === 1,
            sections: currentSectionsInPage,
            hasConclusionAndSign: false,
          });
          currentPageNumber++;
          // Budget Halaman 2+: ruang aman di bawah Header gambar (~530px)
          currentRemainingHeight = 530;
          currentSectionsInPage = [];
          currentSectionChunk = { sectionTitle: `${sec.title} (Lanjutan)`, items: [] };
          sectionTitleAdded = false;
        }

        if (!sectionTitleAdded) {
          currentRemainingHeight -= 28;
          sectionTitleAdded = true;
        }
        currentSectionChunk.items.push(item);
        currentRemainingHeight -= itemHeight;
      });

      if (currentSectionChunk.items.length > 0) {
        currentSectionsInPage.push(currentSectionChunk);
      }
      currentRemainingHeight -= 10;
    });

    // Pengecekan ruang untuk Kesimpulan + Saran + TTD (memerlukan ~235px)
    if (currentRemainingHeight >= 235) {
      pages.push({
        pageNumber: currentPageNumber,
        isFirstPage: currentPageNumber === 1,
        sections: currentSectionsInPage,
        hasConclusionAndSign: true,
      });
    } else {
      pages.push({
        pageNumber: currentPageNumber,
        isFirstPage: currentPageNumber === 1,
        sections: currentSectionsInPage,
        hasConclusionAndSign: false,
      });
      currentPageNumber++;
      pages.push({
        pageNumber: currentPageNumber,
        isFirstPage: false,
        sections: [],
        hasConclusionAndSign: true,
      });
    }

    return pages;
  }, [sections]);
  const totalPages = paginatedPages.length;

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
              Kelola laporan hasil MCU dokter dengan poin pemeriksaan fleksibel dan layout adaptif
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
                            title="Unduh PDF Resmi"
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
                    <p className="text-[11px] text-slate-300">
                      Poin pemeriksaan fleksibel: hapus jika tidak dilakukan, tambah pemeriksaan lain sesuka kebutuhan.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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

              {/* Split Body: Input Form (Left) & Live Multi-Page Preview (Right) */}
              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                {/* PANEL KIRI: FORMULIR INPUT DOKTER */}
                <div className="w-full lg:w-1/2 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
                  {/* Tab Selector Form */}
                  <div className="flex border-b border-slate-200 bg-slate-50 text-xs overflow-x-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('patient')}
                      className={`px-4 py-2.5 font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeFormTab === 'patient'
                          ? 'border-teal-700 text-teal-800 bg-white'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>1. Identitas Pasien</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('exams')}
                      className={`px-4 py-2.5 font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeFormTab === 'exams'
                          ? 'border-teal-700 text-teal-800 bg-white'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span>2. Poin Pemeriksaan ({totalItemsCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormTab('conclusion')}
                      className={`px-4 py-2.5 font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                        activeFormTab === 'conclusion'
                          ? 'border-teal-700 text-teal-800 bg-white'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>3. Kesimpulan & Saran</span>
                    </button>
                  </div>

                  {/* Form Scroll Body */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
                    {/* TAB 1: IDENTITAS PASIEN */}
                    {activeFormTab === 'patient' && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            Identitas Pasien
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
                                placeholder="Contoh: 35 Tahun / Laki-Laki"
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
                                placeholder="Contoh: 20 Juni 1989"
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
                            <label className="block font-semibold text-slate-700 mb-1">Keperluan Pemeriksaan</label>
                            <input
                              type="text"
                              value={formData.purpose}
                              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                              placeholder="Contoh: MCU Kerja / Pra-Pekerjaan"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-semibold"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">Alamat Pasien</label>
                            <textarea
                              rows={2}
                              value={formData.address}
                              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                              placeholder="Alamat domisili lengkap..."
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: POIN PEMERIKSAAN FLEKSIBEL */}
                    {activeFormTab === 'exams' && (
                      <div className="space-y-5">
                        {/* Top Actions for Sections */}
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="text-xs text-slate-600">
                            <strong>{totalItemsCount}</strong> poin pemeriksaan aktif dalam{' '}
                            <strong>{sections.length}</strong> kategori.
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleResetToStandard}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                              title="Kembalikan ke template standar lengkap"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                              <span>Reset Template Standar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsAddingCategory(true)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tambah Kategori Baru</span>
                            </button>
                          </div>
                        </div>

                        {/* Modal Tambah Kategori Baru */}
                        {isAddingCategory && (
                          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2">
                            <label className="block font-semibold text-teal-900">Nama Kategori / Bagian Pemeriksaan Baru:</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Contoh: F. PEMERIKSAAN RADIOLOGI / USG"
                                className="flex-1 px-3 py-1.5 rounded-lg border border-teal-300 text-slate-900 text-xs bg-white"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddSection();
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleAddSection}
                                className="px-3 py-1.5 bg-teal-700 text-white font-bold rounded-lg text-xs hover:bg-teal-800"
                              >
                                Tambah
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsAddingCategory(false)}
                                className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-300"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        )}

                        {/* List Kategori dan Poin Pemeriksaan */}
                        {sections.map((sec) => (
                          <div
                            key={sec.id}
                            className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs"
                          >
                            {/* Section Header */}
                            <div className="bg-slate-100/80 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={sec.title}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSections((prev) =>
                                      prev.map((s) => (s.id === sec.id ? { ...s, title: val } : s))
                                    );
                                  }}
                                  className="font-bold text-slate-900 text-xs bg-transparent border-b border-dashed border-slate-400 hover:border-slate-700 focus:outline-none focus:border-teal-700 px-1 py-0.5 w-full max-w-sm"
                                />
                                <span className="text-[10px] text-slate-500 font-semibold px-2 py-0.5 bg-slate-200 rounded-full">
                                  {sec.items.length} Poin
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveSection(sec.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                title="Hapus seluruh kategori ini jika tidak dilakukan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Section Items */}
                            <div className="p-3 space-y-2.5">
                              {sec.items.length === 0 ? (
                                <p className="text-slate-400 italic text-[11px] py-1 text-center">
                                  Kategori ini belum memiliki poin pemeriksaan. Klik &quot;+ Tambah Pemeriksaan&quot; di bawah.
                                </p>
                              ) : (
                                sec.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-slate-50 border border-slate-100"
                                  >
                                    <div className="w-40 shrink-0">
                                      <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => handleUpdateItem(sec.id, item.id, 'name', e.target.value)}
                                        placeholder="Nama Pemeriksaan"
                                        className="w-full px-2 py-1 rounded border border-slate-200 text-slate-900 font-semibold text-xs focus:ring-1 focus:ring-teal-600"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      {item.value.includes('\n') || item.value.length > 50 ? (
                                        <textarea
                                          rows={2}
                                          value={item.value}
                                          onChange={(e) => handleUpdateItem(sec.id, item.id, 'value', e.target.value)}
                                          placeholder="Hasil pemeriksaan..."
                                          className="w-full px-2 py-1 rounded border border-slate-200 text-slate-900 text-xs focus:ring-1 focus:ring-teal-600"
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          value={item.value}
                                          onChange={(e) => handleUpdateItem(sec.id, item.id, 'value', e.target.value)}
                                          placeholder="Hasil pemeriksaan (contoh: Normal / Negatif)"
                                          className="w-full px-2 py-1 rounded border border-slate-200 text-slate-900 text-xs focus:ring-1 focus:ring-teal-600"
                                        />
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItem(sec.id, item.id)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 mt-0.5"
                                      title="Hapus poin pemeriksaan ini jika tidak dilakukan"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))
                              )}

                              {/* Add Item Actions for this section */}
                              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => handleAddItem(sec.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 font-semibold text-[11px] transition-colors cursor-pointer"
                                >
                                  <PlusCircle className="w-3.5 h-3.5 text-teal-700" />
                                  <span>+ Tambah Pemeriksaan di {sec.title.split('.')[1]?.trim() || sec.title}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Quick Add Suggestions */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <span className="block font-bold text-slate-700 text-xs">
                            Pilihan Cepat Tambah Pemeriksaan Lainnya:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {SUGGESTED_EXAMS.map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() => {
                                  // Add to last section or create custom section
                                  if (sections.length > 0) {
                                    handleAddItem(sections[sections.length - 1].id, sug, 'Dalam batas normal');
                                    success(`Pemeriksaan "${sug}" berhasil ditambahkan.`);
                                  }
                                }}
                                className="px-2 py-1 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded text-[11px] text-slate-700 hover:text-teal-900 transition-colors cursor-pointer"
                              >
                                + {sug}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: KESIMPULAN & SARAN */}
                    {activeFormTab === 'conclusion' && (
                      <div className="space-y-4">
                        <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                          Kesimpulan Kelayakan Kerja / MCU
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

                          <div
                            className={`p-2.5 rounded-lg border ${
                              formData.conclusionType === 'Sehat dengan catatan'
                                ? 'border-amber-400 bg-amber-50/50'
                                : 'border-slate-200'
                            }`}
                          >
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
                                placeholder="Contoh: perbaiki pola makan dan olahraga teratur, gangguan pendengaran"
                                className="w-full mt-2 px-3 py-1.5 rounded border border-amber-300 text-slate-900 bg-white"
                              />
                            )}
                          </div>

                          <div
                            className={`p-2.5 rounded-lg border ${
                              formData.conclusionType === 'Temporary Unfit'
                                ? 'border-orange-400 bg-orange-50/50'
                                : 'border-slate-200'
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="kesimpulan"
                                checked={formData.conclusionType === 'Temporary Unfit'}
                                onChange={() => setFormData({ ...formData, conclusionType: 'Temporary Unfit' })}
                                className="text-orange-600 focus:ring-orange-500"
                              />
                              <span className="font-bold text-slate-900">Temporary unfit :</span>
                            </label>
                            {formData.conclusionType === 'Temporary Unfit' && (
                              <input
                                type="text"
                                value={formData.temporaryUnfitNotes}
                                onChange={(e) => setFormData({ ...formData, temporaryUnfitNotes: e.target.value })}
                                placeholder="Alasan temporary unfit..."
                                className="w-full mt-2 px-3 py-1.5 rounded border border-orange-300 text-slate-900 bg-white"
                              />
                            )}
                          </div>

                          <div
                            className={`p-2.5 rounded-lg border ${
                              formData.conclusionType === 'Unfit'
                                ? 'border-rose-400 bg-rose-50/50'
                                : 'border-slate-200'
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="kesimpulan"
                                checked={formData.conclusionType === 'Unfit'}
                                onChange={() => setFormData({ ...formData, conclusionType: 'Unfit' })}
                                className="text-rose-600 focus:ring-rose-500"
                              />
                              <span className="font-bold text-slate-900">Unfit :</span>
                            </label>
                            {formData.conclusionType === 'Unfit' && (
                              <input
                                type="text"
                                value={formData.unfitNotes}
                                onChange={(e) => setFormData({ ...formData, unfitNotes: e.target.value })}
                                placeholder="Alasan tidak layak bekerja (unfit)..."
                                className="w-full mt-2 px-3 py-1.5 rounded border border-rose-300 text-slate-900 bg-white"
                              />
                            )}
                          </div>
                        </div>

                        <div className="space-y-3 pt-2">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            SARAN - SARAN (1 baris per poin)
                          </h3>
                          <textarea
                            rows={4}
                            value={formData.recommendations}
                            onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                            placeholder="Tulis saran dokter per baris..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                          />
                        </div>

                        <div className="space-y-3 pt-2">
                          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-teal-800 pb-1 border-b">
                            Dokter Pemeriksa
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap Dokter *</label>
                              <input
                                type="text"
                                required
                                value={formData.doctorName}
                                onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                                placeholder="dr. Arinda Puteri P"
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">Nomor SIP Dokter</label>
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
                      </div>
                    )}
                  </div>
                </div>

                {/* PANEL KANAN: LIVE DYNAMIC MULTI-PAGE DOCUMENT PREVIEW */}
                <div className="w-full lg:w-1/2 flex flex-col bg-slate-300/80 overflow-y-auto p-3 sm:p-5">
                  {/* Page Navigator Toolbar */}
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-300 shadow-xs mb-4 text-xs shrink-0">
                    <span className="font-bold text-slate-700">
                      Tampilan Cetak A4 ({totalPages} Halaman Otomatis):
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setActivePreviewPage('all')}
                        className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                          activePreviewPage === 'all'
                            ? 'bg-teal-700 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Semua ({totalPages} Hal)
                      </button>
                      {paginatedPages.map((page) => (
                        <button
                          key={page.pageNumber}
                          type="button"
                          onClick={() => setActivePreviewPage(page.pageNumber)}
                          className={`px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer ${
                            activePreviewPage === page.pageNumber
                              ? 'bg-teal-700 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Hal {page.pageNumber}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* DOCUMENT PAGES CONTAINER */}
                  <div className="space-y-6 max-w-[595px] mx-auto w-full">
                    {paginatedPages.map((page) => {
                      if (activePreviewPage !== 'all' && activePreviewPage !== page.pageNumber) {
                        return null;
                      }

                      return (
                        <div
                          key={page.pageNumber}
                          className="bg-white shadow-2xl rounded-xs px-10 py-6 sm:px-12 border border-slate-300 text-[11pt] leading-relaxed text-slate-900 relative flex flex-col justify-between mx-auto shrink-0 overflow-hidden"
                          style={{
                            fontFamily: 'Arial, Helvetica, sans-serif',
                            width: '595px',
                            minHeight: '842px',
                            height: '842px',
                          }}
                        >
                          {/* Konten Utama Halaman A4 */}
                          <div className="space-y-2.5 flex-1 flex flex-col justify-start overflow-hidden">
                          {/* Header Image on EVERY page */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/header-hasil.jpeg"
                            alt="Header RS"
                            className="w-full h-auto object-contain rounded"
                          />

                          {/* Judul & Identitas hanya di Halaman 1 */}
                          {page.isFirstPage && (
                            <>
                              <div className="text-center font-bold text-[11px] uppercase tracking-wide text-blue-900 leading-tight pt-1">
                                <div>RESUME HASIL PEMERIKSAAN</div>
                                <div>MEDICAL CHECK UP ({formData.purpose || 'MCU KERJA'})</div>
                              </div>

                              <div>
                                <p className="font-bold text-[9px] uppercase text-slate-900 mb-1">
                                  IDENTITAS PASIEN
                                </p>
                                <table className="w-full border-collapse border border-slate-800 text-[9.5px]">
                                  <tbody className="divide-y divide-slate-300">
                                    <tr>
                                      <td className="p-1.5 w-36 font-bold text-slate-800 border-r border-slate-300">
                                        Nama
                                      </td>
                                      <td className="p-1.5 font-bold text-slate-900">
                                        : {formData.patientName || '[Nama Pasien]'}
                                      </td>
                                    </tr>
                                    <tr>
                                      <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">
                                        Umur / Jenis Kelamin
                                      </td>
                                      <td className="p-1.5">: {formData.ageGender}</td>
                                    </tr>
                                    <tr>
                                      <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">
                                        Tanggal Lahir
                                      </td>
                                      <td className="p-1.5">: {formData.birthDate || '-'}</td>
                                    </tr>
                                    <tr>
                                      <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">
                                        Alamat
                                      </td>
                                      <td className="p-1.5">: {formData.address || '-'}</td>
                                    </tr>
                                    <tr>
                                      <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">
                                        Tanggal Pemeriksaan
                                      </td>
                                      <td className="p-1.5">: {formData.examDate}</td>
                                    </tr>
                                    <tr>
                                      <td className="p-1.5 font-bold text-slate-800 border-r border-slate-300">
                                        Keperluan
                                      </td>
                                      <td className="p-1.5">: {formData.purpose}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </>
                          )}

                          {/* Examination Sections on this page */}
                          <div className="space-y-3 pt-1 text-[9.5px]">
                            {page.sections.map((secChunk, idx) => (
                              <div key={idx} className="space-y-1">
                                <p className="font-bold text-blue-900">{secChunk.sectionTitle}</p>
                                <div className="space-y-0.5 pl-3">
                                  {secChunk.items.map((it) => (
                                    <div key={it.id} className="flex">
                                      <span className="w-44 font-medium text-slate-700 shrink-0">
                                        {it.name}
                                      </span>
                                      <span className="text-slate-900 whitespace-pre-line">
                                        : {it.value || '-'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Kesimpulan, Saran & TTD jika berada di halaman ini */}
                          {page.hasConclusionAndSign && (
                            <div className="space-y-3 pt-2 text-[9.5px]">
                              {/* KESIMPULAN */}
                              <div>
                                <p className="font-bold text-blue-900 mb-1">Kesimpulan</p>
                                <div className="space-y-1 pl-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`w-3.5 h-3.5 border rounded flex items-center justify-center font-bold text-[8.5px] ${
                                        formData.conclusionType === 'Sehat'
                                          ? 'bg-blue-900 text-white border-blue-900'
                                          : 'border-slate-400'
                                      }`}
                                    >
                                      {formData.conclusionType === 'Sehat' ? '✓' : ''}
                                    </span>
                                    <span>Sehat</span>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <span
                                      className={`w-3.5 h-3.5 border rounded flex items-center justify-center font-bold text-[8.5px] mt-0.5 ${
                                        formData.conclusionType === 'Sehat dengan catatan'
                                          ? 'bg-blue-900 text-white border-blue-900'
                                          : 'border-slate-400'
                                      }`}
                                    >
                                      {formData.conclusionType === 'Sehat dengan catatan' ? '✓' : ''}
                                    </span>
                                    <span>
                                      Sehat dengan catatan :{' '}
                                      <strong className="text-slate-800 font-semibold">
                                        {formData.conclusionNotes || '_____________'}
                                      </strong>
                                    </span>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <span
                                      className={`w-3.5 h-3.5 border rounded flex items-center justify-center font-bold text-[8.5px] mt-0.5 ${
                                        formData.conclusionType === 'Temporary Unfit'
                                          ? 'bg-blue-900 text-white border-blue-900'
                                          : 'border-slate-400'
                                      }`}
                                    >
                                      {formData.conclusionType === 'Temporary Unfit' ? '✓' : ''}
                                    </span>
                                    <span>
                                      Temporary unfit :{' '}
                                      <strong className="text-slate-800 font-semibold">
                                        {formData.temporaryUnfitNotes || '_____________'}
                                      </strong>
                                    </span>
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <span
                                      className={`w-3.5 h-3.5 border rounded flex items-center justify-center font-bold text-[8.5px] mt-0.5 ${
                                        formData.conclusionType === 'Unfit'
                                          ? 'bg-blue-900 text-white border-blue-900'
                                          : 'border-slate-400'
                                      }`}
                                    >
                                      {formData.conclusionType === 'Unfit' ? '✓' : ''}
                                    </span>
                                    <span>
                                      Unfit :{' '}
                                      <strong className="text-slate-800 font-semibold">
                                        {formData.unfitNotes || '_____________'}
                                      </strong>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* SARAN - SARAN */}
                              <div>
                                <p className="font-bold text-blue-900 mb-1">SARAN - SARAN</p>
                                <div className="space-y-0.5 pl-3">
                                  {formData.recommendations ? (
                                    formData.recommendations
                                      .split('\n')
                                      .filter((s) => s.trim() !== '')
                                      .map((s, sIdx) => (
                                        <p key={sIdx} className="text-slate-800">
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
                                  <div className="h-12 flex items-center justify-center text-slate-300 italic text-[9px]">
                                    (Tanda Tangan)
                                  </div>
                                  <p className="font-bold text-slate-900 underline">{formData.doctorName}</p>
                                  <p className="text-slate-500 text-[8.5px] font-mono">{formData.doctorSip}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          </div>

                          {/* Footer Nomor Halaman di Bagian Bawah Kertas A4 */}
                          <div
                            className="pt-2 border-t border-slate-300 text-center text-[10.5pt] text-slate-700 font-medium shrink-0 mt-auto"
                            style={{ fontFamily: 'Cambria, Georgia, serif' }}
                          >
                            Page {page.pageNumber} of {totalPages}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Hapus Laporan MCU */}
        <ConfirmModal
          isOpen={!!reportToDelete}
          title="Hapus Laporan MCU Pasien"
          message={`Apakah Anda yakin ingin menghapus data laporan hasil MCU pasien "${reportToDelete?.patientName}" (${reportToDelete?.reportNumber})? Tindakan ini tidak dapat dibatalkan.`}
          confirmText="Hapus Permanen"
          cancelText="Batal"
          onConfirm={confirmDeleteReport}
          onCancel={() => setReportToDelete(null)}
        />
      </div>
    </AppShell>
  );
}
