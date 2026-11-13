'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  SeparatorHorizontal,
} from 'lucide-react';

interface McuExamItem {
  id: string;
  name: string;
  value: string;
  // true = poin ini selalu dimulai di halaman baru saat cetak PDF
  pageBreakBefore?: boolean;
}

type McuSectionCode = 'vital' | 'antropo' | 'physical' | 'lab' | 'support';

interface McuExamSection {
  id: string;
  code: McuSectionCode | null;
  title: string;
  items: McuExamItem[];
  // true = seluruh kategori dimulai di halaman baru saat cetak PDF
  pageBreakBefore?: boolean;
}

type ConclusionType = 'Fit' | 'Fit dengan catatan' | 'Temporary unfit' | 'Unfit';

const CONCLUSION_OPTIONS: ConclusionType[] = ['Fit', 'Fit dengan catatan', 'Temporary unfit', 'Unfit'];

// Label yang dicetak/ditampilkan. Nilai tersimpan tetap 'Fit' agar data lama
// dan constraint database yang sudah ada tidak perlu diubah.
const CONCLUSION_LABELS: Record<ConclusionType, string> = {
  Fit: 'Fit to work',
  'Fit dengan catatan': 'Fit dengan catatan',
  'Temporary unfit': 'Temporary unfit',
  Unfit: 'Unfit',
};

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
  conclusionType: ConclusionType | 'Sehat' | 'Sehat dengan catatan' | 'Temporary Unfit';
  conclusionNotes: string | null;
  recommendations: string | null;
  doctorName: string;
  doctorSip: string | null;
  createdAt: string;
  updatedAt: string;
}

const MCU_SECTION_LABELS: Record<McuSectionCode, string> = {
  vital: 'TANDA VITAL',
  antropo: 'ANTROPOMETRI',
  physical: 'PEMERIKSAAN FISIK',
  lab: 'PEMERIKSAAN LABORATORIUM',
  support: 'PEMERIKSAAN PENUNJANG',
};

// Partikel yang tetap huruf kecil saat judul ditulis kapital
const TITLE_PARTICLES = new Set(['dan', 'di', 'ke', 'dari', 'pada', 'untuk', 'yang', 'atau']);

const formatSectionTitle = (label: string, index: number) => {
  const text = label
    .split(' ')
    .map((w, i) => (i > 0 && TITLE_PARTICLES.has(w.toLowerCase()) ? w.toLowerCase() : w))
    .join(' ');
  return `${String.fromCharCode(65 + index)}. ${text}`;
};

const sectionCodeOf = (sec: { code?: string | null; id?: string }): McuSectionCode | null => {
  const candidates = [sec.code, (sec.id || '').replace(/^sec_/, '')];
  const found = candidates.find((c): c is McuSectionCode =>
    !!c && Object.prototype.hasOwnProperty.call(MCU_SECTION_LABELS, c)
  );
  return found ?? null;
};

// Nomor huruf (A, B, C...) selalu dihitung ulang sesuai urutan tampil, agar bisa dipindah bebas
const withRenumberedTitles = (list: McuExamSection[]): McuExamSection[] =>
  list.map((sec, idx) => ({
    ...sec,
    code: sec.code ?? sectionCodeOf(sec),
    title: formatSectionTitle(sec.code ? MCU_SECTION_LABELS[sec.code] : sec.title, idx),
  }));

const buildDefaultSections = (): McuExamSection[] =>
  withRenumberedTitles([
    {
      id: 'sec_vital',
      code: 'vital',
      title: '',
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
      code: 'antropo',
      title: '',
      items: [
        { id: 'antropo_weight', name: 'Berat Badan (BB)', value: '60 kg' },
        { id: 'antropo_height', name: 'Tinggi Badan (TB)', value: '165 cm' },
        { id: 'antropo_bmi', name: 'IMT / BMI', value: '22.0' },
        { id: 'antropo_nutrition', name: 'Status Gizi', value: 'Normal' },
      ],
    },
    {
      id: 'sec_physical',
      code: 'physical',
      title: '',
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
      code: 'lab',
      title: '',
      items: [
        { id: 'lab_blood', name: 'Darah Lengkap', value: 'Dalam batas normal' },
        { id: 'lab_urine', name: 'Urine Lengkap', value: 'Dalam batas normal' },
        { id: 'lab_fasting_glucose', name: 'Gula Puasa', value: 'Dalam batas normal' },
        { id: 'lab_lipid', name: 'Profil Lipid', value: 'Dalam batas normal' },
        { id: 'lab_liver', name: 'Fungsi Hati', value: 'Dalam batas normal' },
        { id: 'lab_kidney', name: 'Faal Ginjal', value: 'Dalam batas normal' },
        { id: 'lab_hbsag', name: 'HBsAg', value: 'Negatif' },
        { id: 'lab_drug_test', name: 'Tes NAPZA', value: 'Negatif' },
      ],
    },
    {
      id: 'sec_sup',
      code: 'support',
      title: '',
      items: [
        {
          id: 'sup_xray',
          name: 'Rontgen Thorax',
          value: 'Tidak tampak TBC paru aktif/pneumonia, Tidak tampak kardiomegali',
        },
        { id: 'sup_ekg', name: 'EKG', value: 'Normal Sinus Rhythm' },
        { id: 'sup_treadmill', name: 'Threadmill', value: 'Normal' },
        { id: 'sup_audio', name: 'Audiometri', value: 'Dalam batas normal' },
        { id: 'sup_spiro', name: 'Spirometri', value: 'Normal' },
      ],
    },
  ]);

const DEFAULT_EXAM_SECTIONS: McuExamSection[] = buildDefaultSections();

// Laporan lama masih memakai istilah Sehat / Sehat dengan catatan
const normalizeConclusionType = (t?: string | null): ConclusionType => {
  if (t === 'Sehat' || t === 'Fit') return 'Fit';
  if (t === 'Sehat dengan catatan' || t === 'Fit dengan catatan') return 'Fit dengan catatan';
  if (t === 'Temporary Unfit' || t === 'Temporary unfit') return 'Temporary unfit';
  return 'Unfit';
};

// Poin pemeriksaan utama yang ikut urutan kustom (dipakai navigasi ↑ ↓)
const REORDERABLE_LABELS: Record<McuSectionCode, string> = {
  vital: 'Tanda Vital',
  antropo: 'Antropometri',
  physical: 'Pemeriksaan Fisik',
  lab: 'Pemeriksaan Laboratorium',
  support: 'Pemeriksaan Penunjang',
};

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
  // true = baris "Dilanjutkan di halaman berikutnya" ikut dicetak
  overflowPending?: boolean;
  promptContinue?: boolean;
  hasConclusionAndSign: boolean;
}

// Tinggi ruang untuk penanda halaman berikutnya (termasuk jarak ke footer)
const CONTINUE_PROMPT_HEIGHT = 26;

// Harus sama dengan geometri di server/src/mcu/mcu.service.ts (generateMcuPdf).
// Pratinjau memakai satuan px dengan 1px = 1pt PDF, jadi ukuran font & jarak bisa disamakan.
const PDF_LAYOUT = {
  pageWidth: 595,
  pageHeight: 842,
  leftMargin: 85,
  printableWidth: 425,
  headerTop: 20,
  headerHeight: Math.round(425 * (401 / 1295)),
  contentTop: 20 + Math.round(425 * (401 / 1295)) + 10,
  maxContentY: 745,
  pointIndent: 8,
  pointLabelWidth: 155,
  pointValueWidth: 425 - 155 - 12,
  pointRowMinHeight: 16,
  idValueWidth: 425 - 145 - 10,
};

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
    conclusionType: 'Fit' as ConclusionType,
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
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
      conclusionType: 'Fit',
      conclusionNotes: '',
      temporaryUnfitNotes: '',
      unfitNotes: '',
      recommendations: 'Pertahankan pola hidup sehat dan olahraga teratur.\nMinum air putih minimal 2 liter per hari.',
      doctorName: user?.fullName?.startsWith('dr') ? user.fullName : 'dr. Arinda Puteri P',
      doctorSip: 'SIP.MR32032507002898',
    });
    setSections(buildDefaultSections());
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
      conclusionType: normalizeConclusionType(r.conclusionType),
      conclusionNotes: r.conclusionNotes || '',
      temporaryUnfitNotes: normalizeConclusionType(r.conclusionType) === 'Temporary unfit' ? r.conclusionNotes || '' : '',
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
      if (secVital.length > 0) parsedSections.push({ id: 'sec_vital', code: 'vital', title: 'A. TANDA VITAL', items: secVital });

      const secAntropo: McuExamItem[] = [];
      if (antropo.weight) secAntropo.push({ id: 'antropo_weight', name: 'Berat Badan (BB)', value: antropo.weight });
      if (antropo.height) secAntropo.push({ id: 'antropo_height', name: 'Tinggi Badan (TB)', value: antropo.height });
      if (antropo.bmi) secAntropo.push({ id: 'antropo_bmi', name: 'IMT / BMI', value: antropo.bmi });
      if (antropo.nutritionStatus) secAntropo.push({ id: 'antropo_nutrition', name: 'Status Gizi', value: antropo.nutritionStatus });
      if (secAntropo.length > 0) parsedSections.push({ id: 'sec_antropo', code: 'antropo', title: 'B. ANTROPOMETRI', items: secAntropo });

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
      if (secPhysical.length > 0) parsedSections.push({ id: 'sec_physical', code: 'physical', title: 'C. PEMERIKSAAN FISIK', items: secPhysical });

      const secLab: McuExamItem[] = [];
      if (lab.completeBlood) secLab.push({ id: 'lab_blood', name: 'Darah Lengkap', value: lab.completeBlood });
      if (lab.completeUrine) secLab.push({ id: 'lab_urine', name: 'Urine Lengkap', value: lab.completeUrine });
      if (lab.fastingGlucose) secLab.push({ id: 'lab_fasting_glucose', name: 'Gula Puasa', value: lab.fastingGlucose });
      if (lab.lipidProfile) secLab.push({ id: 'lab_lipid', name: 'Profil Lipid', value: lab.lipidProfile });
      if (lab.liverFunction) secLab.push({ id: 'lab_liver', name: 'Fungsi Hati', value: lab.liverFunction });
      if (lab.kidneyFunction) secLab.push({ id: 'lab_kidney', name: 'Faal Ginjal', value: lab.kidneyFunction });
      if (lab.hbsag) secLab.push({ id: 'lab_hbsag', name: 'HBsAg', value: lab.hbsag });
      if (lab.drugTest) secLab.push({ id: 'lab_drug_test', name: 'Tes NAPZA', value: lab.drugTest });
      if (secLab.length > 0) parsedSections.push({ id: 'sec_lab', code: 'lab', title: 'D. PEMERIKSAAN LABORATORIUM', items: secLab });

      const secSup: McuExamItem[] = [];
      if (supporting.thoraxXray) secSup.push({ id: 'sup_xray', name: 'Rontgen Thorax', value: supporting.thoraxXray });
      if (supporting.ekg) secSup.push({ id: 'sup_ekg', name: 'EKG', value: supporting.ekg });
      if (supporting.treadmill) secSup.push({ id: 'sup_treadmill', name: 'Threadmill', value: supporting.treadmill });
      if (supporting.audiometry) secSup.push({ id: 'sup_audio', name: 'Audiometri', value: supporting.audiometry });
      if (supporting.spirometry) secSup.push({ id: 'sup_spiro', name: 'Spirometri', value: supporting.spirometry });
      if (secSup.length > 0) parsedSections.push({ id: 'sec_sup', code: 'support', title: 'E. PEMERIKSAAN PENUNJANG', items: secSup });
    }

    setSections(
      withRenumberedTitles(parsedSections.length > 0 ? parsedSections : buildDefaultSections())
    );
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

  // Pindah urutan kategori & sub-poin pemeriksaan (huruf judul dihitung ulang otomatis)
  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const targetId = sections[target].id; // simpan sebelum state berubah
    setSections((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      // withRenumberedTitles membawa seluruh properti section, termasuk pageBreakBefore
      return withRenumberedTitles(next);
    });
    sectionRefs.current[targetId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const moveSectionToEdge = (index: number, edge: 'top' | 'bottom') => {
    const target = edge === 'top' ? 0 : sections.length - 1;
    if (index === target) return;
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return withRenumberedTitles(next);
    });
  };

  const moveItem = (sectionId: string, index: number, direction: -1 | 1) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const target = index + direction;
        if (target < 0 || target >= sec.items.length) return sec;
        const items = [...sec.items];
        // Flag pageBreakBefore menempel pada poin dan ikut berpindah bersamanya
        [items[index], items[target]] = [items[target], items[index]];
        return { ...sec, items };
      })
    );
  };

  // Paksa kategori dimulai di halaman baru saat cetak PDF
  const toggleSectionPageBreak = (sectionId: string) => {
    setSections((prev) => prev.map((sec) => (sec.id === sectionId ? { ...sec, pageBreakBefore: !sec.pageBreakBefore } : sec)));
  };

  // Paksa satu sub-poin dimulai di halaman baru saat cetak PDF
  const toggleItemPageBreak = (sectionId: string, itemId: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        return {
          ...sec,
          items: sec.items.map((it) => (it.id === itemId ? { ...it, pageBreakBefore: !it.pageBreakBefore } : it)),
        };
      })
    );
  };

  const handleAddSection = () => {
    if (!newCategoryName.trim()) return;
    setSections((prev) =>
      withRenumberedTitles([
        ...prev,
        {
          id: `sec_${Date.now()}`,
          code: null,
          title: newCategoryName.trim(),
          items: [{ id: `item_${Date.now()}`, name: '', value: '' }],
        },
      ])
    );
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleRenameSection = (sectionId: string, title: string) => {
    setSections((prev) => prev.map((sec) => (sec.id === sectionId ? { ...sec, title } : sec)));
  };

  const handleRemoveSection = (sectionId: string) => {
    setSections((prev) => withRenumberedTitles(prev.filter((sec) => sec.id !== sectionId)));
  };

  const handleResetToStandard = () => {
    setSections(buildDefaultSections());
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
      if (formData.conclusionType === 'Temporary unfit') {
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

  // Paginasi pratinjau: menghitung tinggi dalam satuan pt, mengikuti geometri PDF server
  // (generateMcuPdf di mcu.service.ts): margin 3 cm, font Arial 11 pt, header ~132 pt.
  const paginatedPages = useMemo<PaginatedPage[]>(() => {
    const lineHeight = 11 * 1.15; // tinggi baris Arial 11 pt di pdfkit (lineGap 0)

    // Estimasi lebar teks Arial 11 pt (rata-rata ~0.5 em per karakter)
    const estimateLines = (text: string, maxWidth: number) => {
      const charsPerLine = Math.max(1, Math.floor(maxWidth / (11 * 0.5)));
      let lines = 0;
      for (const paragraph of (text || '').split('\n')) {
        let current = 0;
        let paraLines = 1;
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
          const wordLen = word.length + 1;
          if (current > 0 && current + wordLen > charsPerLine) {
            paraLines++;
            current = wordLen;
          } else {
            current += wordLen;
          }
        }
        lines += Math.max(1, paraLines);
      }
      return lines;
    };

    const pointRowHeight = (name: string, value: string) => {
      const valLines = estimateLines(`: ${value || '-'}`, PDF_LAYOUT.pointValueWidth);
      const nameLines = estimateLines(name, PDF_LAYOUT.pointLabelWidth);
      return Math.max(PDF_LAYOUT.pointRowMinHeight, Math.max(valLines, nameLines) * lineHeight + 3);
    };

    const sectionTitleHeight = 11.5 * 1.15 + 3;
    const idTableHeight =
      11 * 1.15 + 4 +
      [
        formData.patientName,
        formData.ageGender,
        formData.birthDate || '-',
        formData.address || '-',
        formData.examDate,
        formData.purpose || 'MCU kerja',
      ].reduce((acc, v) => acc + Math.max(16, estimateLines(v, PDF_LAYOUT.idValueWidth) * lineHeight + 3), 0) +
      2;
    const titleHeight = 2 * (12 * 1.15) + 6;

    const recommendationLines = formData.recommendations
      .split('\n')
      .filter((s) => s.trim() !== '');
    const conclusionHeight =
      sectionTitleHeight + 2 +
      CONCLUSION_OPTIONS.length * 16 +
      8 +
      sectionTitleHeight +
      3 +
      Math.max(1, recommendationLines.length) * lineHeight +
      10 +
      6 + 80;
    // PDF memakai checkPageBreak(210) sebelum blok kesimpulan
    const PDF_CONCLUSION_RESERVE = 210;

    let currentY = PDF_LAYOUT.contentTop + titleHeight + idTableHeight;
    let currentPageNumber = 1;
    let currentSectionsInPage: { sectionTitle: string; items: McuExamItem[] }[] = [];
    let currentSectionChunk: { sectionTitle: string; items: McuExamItem[] } | null = null;
    let pageHasContent = false;
    let pageOverflowPending = false;
    const pages: PaginatedPage[] = [];

    const closeChunk = () => {
      if (currentSectionChunk && currentSectionChunk.items.length > 0) {
        currentSectionsInPage.push(currentSectionChunk);
      }
      currentSectionChunk = null;
    };

    const pushCurrentPage = (hasConclusionAndSign: boolean) => {
      closeChunk();
      pages.push({
        pageNumber: currentPageNumber,
        isFirstPage: currentPageNumber === 1,
        sections: currentSectionsInPage,
        overflowPending: pageOverflowPending,
        promptContinue: false,
        hasConclusionAndSign,
      });
    };

    const startNewPage = () => {
      pushCurrentPage(false);
      currentPageNumber++;
      currentSectionsInPage = [];
      currentSectionChunk = null;
      pageHasContent = false;
      pageOverflowPending = false;
      currentY = PDF_LAYOUT.contentTop;
    };

    for (const sec of sections) {
      const validItems = sec.items.filter((it) => it.name.trim() !== '' || it.value.trim() !== '');
      if (validItems.length === 0) continue;

      // PDF: `if ((pageBreakBefore && hasExamOnPage) || y + 40 > maxY) addPage()`
      // hasExamOnPage setara pageHasContent pada pratinjau.
      if (pageHasContent && (sec.pageBreakBefore || currentY + 40 > PDF_LAYOUT.maxContentY)) {
        startNewPage();
      }

      currentSectionChunk = { sectionTitle: sec.title, items: [] };
      currentY += sectionTitleHeight;
      pageHasContent = true;

      for (const item of validItems) {
        const rowHeight = pointRowHeight(item.name, item.value);

        // Opsi "halaman baru" pada sub-poin, atau poin turun karena tidak muat
        if (item.pageBreakBefore && currentSectionChunk.items.length > 0) {
          startNewPage();
          currentSectionChunk = { sectionTitle: `${sec.title} (Lanjutan)`, items: [] };
          currentY += sectionTitleHeight;
          pageHasContent = true;
        } else if (currentY + rowHeight > PDF_LAYOUT.maxContentY) {
          startNewPage();
          currentSectionChunk = { sectionTitle: `${sec.title} (Lanjutan)`, items: [] };
          currentY += sectionTitleHeight;
          pageHasContent = true;
        }

        currentSectionChunk.items.push(item);
        currentY += rowHeight;
      }

      // PDF menambah 6 pt setelah tiap kategori. Untuk kategori terakhir, PDF baru
      // memindah halaman bila total kesimpulan tidak muat (checkPageBreak di bawah).
      closeChunk();
      currentY += 6;
    }

    // Penanda "Dilanjutkan di halaman berikutnya" hanya dipakai bila kesimpulan
    // tidak muat di sisa halaman terakhir. Sisa < 26 pt memicu penanda ini.
    const conclusionFitsHere = !pageHasContent || currentY + PDF_CONCLUSION_RESERVE <= PDF_LAYOUT.maxContentY;
    const needsContinueMarker = !conclusionFitsHere && currentY + 26 >= PDF_LAYOUT.maxContentY;

    if (conclusionFitsHere) {
      pushCurrentPage(true);
    } else {
      pushCurrentPage(false);
      currentPageNumber++;
      pages.push({
        pageNumber: currentPageNumber,
        isFirstPage: false,
        sections: [],
        overflowPending: false,
        promptContinue: false,
        hasConclusionAndSign: true,
      });
    }

    // Penanda hanya untuk halaman terakhir yang berisi pemeriksaan (kesimpulan pindah halaman).
    const lastContentPage = pages.filter((p) => p.sections.length > 0).slice(-1)[0];
    return pages.map((page) => ({
      ...page,
      promptContinue: needsContinueMarker && page === lastContentPage,
    }));
  }, [sections, formData]);
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
                            normalizeConclusionType(r.conclusionType) === 'Fit'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : normalizeConclusionType(r.conclusionType) === 'Fit dengan catatan'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {CONCLUSION_LABELS[normalizeConclusionType(r.conclusionType)]}
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
                            <strong>{sections.length}</strong> kategori. Tombol{' '}
                            <span className="inline-flex items-center gap-1 align-middle px-1 rounded bg-white border border-slate-300 text-[10px] font-bold text-slate-600">
                              <SeparatorHorizontal className="w-3 h-3" /> / Hal. baru
                            </span>{' '}
                            memaksa poin atau kategori dimulai di halaman PDF berikutnya.
                          </div>
                          {/* Navigasi cepat urutan kategori */}
                          <div className="flex flex-wrap items-center gap-1 basis-full">
                            <span className="text-[11px] font-semibold text-slate-500 mr-0.5">Urutan:</span>
                            {(Object.keys(REORDERABLE_LABELS) as McuSectionCode[]).map((code) => {
                              const idx = sections.findIndex((s) => s.code === code);
                              const exists = idx >= 0;
                              return (
                                <div
                                  key={code}
                                  className={`inline-flex items-center gap-0.5 pl-2 pr-0.5 py-0.5 rounded-lg border text-[11px] ${
                                    exists
                                      ? 'bg-white border-slate-300 text-slate-800'
                                      : 'bg-slate-100 border-dashed border-slate-300 text-slate-400'
                                  }`}
                                >
                                  <span className="font-semibold">
                                    {exists ? String.fromCharCode(65 + idx) : '-'} {REORDERABLE_LABELS[code]}
                                  </span>
                                  {exists && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => moveSection(idx, -1)}
                                        disabled={idx <= 0}
                                        className="px-1 py-0.5 rounded text-slate-600 hover:bg-teal-50 hover:text-teal-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                        title="Geser kategori ke atas"
                                        aria-label={`Geser ${REORDERABLE_LABELS[code]} ke atas`}
                                      >
                                        <ArrowUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveSection(idx, 1)}
                                        disabled={idx === sections.length - 1}
                                        className="px-1 py-0.5 rounded text-slate-600 hover:bg-teal-50 hover:text-teal-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                        title="Geser kategori ke bawah"
                                        aria-label={`Geser ${REORDERABLE_LABELS[code]} ke bawah`}
                                      >
                                        <ArrowDown className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
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
                        {sections.map((sec, secIndex) => (
                          <div
                            key={sec.id}
                            ref={(el) => {
                              sectionRefs.current[sec.id] = el;
                            }}
                            className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs"
                          >
                            {/* Section Header */}
                            <div className="bg-slate-100/80 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={sec.title}
                                  onChange={(e) => handleRenameSection(sec.id, e.target.value)}
                                  title="Klik untuk mengganti nama kategori"
                                  aria-label="Nama kategori pemeriksaan"
                                  className="font-bold text-slate-900 text-xs bg-transparent border-b border-dashed border-slate-400 hover:border-slate-700 focus:outline-none focus:border-teal-700 px-1 py-0.5 w-full max-w-sm"
                                />
                                <span className="text-[10px] text-slate-500 font-semibold px-2 py-0.5 bg-slate-200 rounded-full whitespace-nowrap">
                                  {sec.items.length} Poin
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => toggleSectionPageBreak(sec.id)}
                                  aria-pressed={!!sec.pageBreakBefore}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                    sec.pageBreakBefore
                                      ? 'bg-teal-700 border-teal-700 text-white'
                                      : 'bg-white border-slate-300 text-slate-600 hover:border-teal-400 hover:text-teal-800'
                                  }`}
                                  title="Cetak kategori ini mulai di halaman baru"
                                >
                                  Hal. baru
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSectionToEdge(secIndex, 'top')}
                                  disabled={secIndex === 0}
                                  className="p-1 rounded text-slate-500 hover:text-teal-800 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Pindahkan kategori ke paling atas"
                                  aria-label={`Pindahkan ${sec.title} ke paling atas`}
                                >
                                  <ChevronsUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSection(secIndex, -1)}
                                  disabled={secIndex === 0}
                                  className="p-1 rounded text-slate-500 hover:text-teal-800 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Geser kategori ke atas"
                                  aria-label={`Geser ${sec.title} ke atas`}
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSection(secIndex, 1)}
                                  disabled={secIndex === sections.length - 1}
                                  className="p-1 rounded text-slate-500 hover:text-teal-800 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Geser kategori ke bawah"
                                  aria-label={`Geser ${sec.title} ke bawah`}
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSectionToEdge(secIndex, 'bottom')}
                                  disabled={secIndex === sections.length - 1}
                                  className="p-1 rounded text-slate-500 hover:text-teal-800 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title="Pindahkan kategori ke paling bawah"
                                  aria-label={`Pindahkan ${sec.title} ke paling bawah`}
                                >
                                  <ChevronsDown className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-px h-4 bg-slate-300 mx-0.5" aria-hidden="true" />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSection(sec.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Hapus seluruh kategori ini jika tidak dilakukan"
                                  aria-label={`Hapus kategori ${sec.title}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Section Items */}
                            <div className="p-3 space-y-2.5">
                              {sec.items.length === 0 ? (
                                <p className="text-slate-400 italic text-[11px] py-1 text-center">
                                  Kategori ini belum memiliki poin pemeriksaan. Klik &quot;+ Tambah Pemeriksaan&quot; di bawah.
                                </p>
                              ) : (
                                sec.items.map((item, itemIndex) => (
                                  <div
                                    key={item.id}
                                    className={`flex items-start gap-2 p-1.5 rounded-lg border ${
                                      item.pageBreakBefore
                                        ? 'border-teal-300 bg-teal-50/40'
                                        : 'border-slate-100 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex flex-col shrink-0 mt-0.5">
                                      <button
                                        type="button"
                                        onClick={() => moveItem(sec.id, itemIndex, -1)}
                                        disabled={itemIndex === 0}
                                        className="p-0.5 rounded text-slate-400 hover:text-teal-800 hover:bg-teal-50 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                                        title="Geser poin ke atas"
                                        aria-label={`Geser ${item.name || 'poin pemeriksaan'} ke atas`}
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveItem(sec.id, itemIndex, 1)}
                                        disabled={itemIndex === sec.items.length - 1}
                                        className="p-0.5 rounded text-slate-400 hover:text-teal-800 hover:bg-teal-50 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                                        title="Geser poin ke bawah"
                                        aria-label={`Geser ${item.name || 'poin pemeriksaan'} ke bawah`}
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
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
                                      onClick={() => toggleItemPageBreak(sec.id, item.id)}
                                      aria-pressed={!!item.pageBreakBefore}
                                      className={`shrink-0 mt-0.5 p-1 rounded transition-colors cursor-pointer ${
                                        item.pageBreakBefore
                                          ? 'bg-teal-700 text-white'
                                          : 'text-slate-400 hover:text-teal-800 hover:bg-teal-50'
                                      }`}
                                      title={
                                        item.pageBreakBefore
                                          ? 'Poin ini mulai di halaman baru — klik untuk kembali normal'
                                          : 'Cetak poin ini mulai di halaman baru'
                                      }
                                      aria-label={`${item.pageBreakBefore ? 'Batalkan' : 'Aktifkan'} halaman baru untuk poin ${item.name || 'pemeriksaan'}`}
                                    >
                                      <SeparatorHorizontal className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItem(sec.id, item.id)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 mt-0.5 cursor-pointer"
                                      title="Hapus poin pemeriksaan ini jika tidak dilakukan"
                                      aria-label={`Hapus poin ${item.name || 'pemeriksaan'}`}
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
                          {CONCLUSION_OPTIONS.map((option) => {
                            const selected = formData.conclusionType === option;
                            const showNotes = option !== 'Fit';
                            const notesValue =
                              option === 'Fit dengan catatan'
                                ? formData.conclusionNotes
                                : option === 'Temporary unfit'
                                ? formData.temporaryUnfitNotes
                                : formData.unfitNotes;
                            const setNotes = (val: string) => {
                              if (option === 'Fit dengan catatan') {
                                setFormData({ ...formData, conclusionNotes: val });
                              } else if (option === 'Temporary unfit') {
                                setFormData({ ...formData, temporaryUnfitNotes: val });
                              } else {
                                setFormData({ ...formData, unfitNotes: val });
                              }
                            };
                            const notesPlaceholder =
                              option === 'Fit dengan catatan'
                                ? 'Contoh: perbaiki pola makan dan olahraga teratur, gangguan pendengaran'
                                : option === 'Temporary unfit'
                                ? 'Alasan temporary unfit dan perkiraan lama pemulihan...'
                                : 'Alasan tidak layak bekerja (unfit)...';
                            const accentBorder =
                              option === 'Fit'
                                ? 'border-emerald-400 bg-emerald-50/50'
                                : option === 'Fit dengan catatan'
                                ? 'border-amber-400 bg-amber-50/50'
                                : option === 'Temporary unfit'
                                ? 'border-orange-400 bg-orange-50/50'
                                : 'border-rose-400 bg-rose-50/50';
                            const accentText =
                              option === 'Fit'
                                ? 'text-emerald-600 focus:ring-emerald-500'
                                : option === 'Fit dengan catatan'
                                ? 'text-amber-600 focus:ring-amber-500'
                                : option === 'Temporary unfit'
                                ? 'text-orange-600 focus:ring-orange-500'
                                : 'text-rose-600 focus:ring-rose-500';

                            return (
                              <div
                                key={option}
                                className={`p-2.5 rounded-lg border ${
                                  selected && showNotes ? accentBorder : 'border-slate-200'
                                }`}
                              >
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="kesimpulan"
                                    checked={selected}
                                    onChange={() => setFormData({ ...formData, conclusionType: option })}
                                    className={accentText}
                                  />
                                  <span className="font-bold text-slate-900">
                                    {CONCLUSION_LABELS[option]}
                                    {showNotes ? ' :' : ''}
                                  </span>
                                </label>
                                {showNotes && selected && (
                                  <input
                                    type="text"
                                    value={notesValue}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={notesPlaceholder}
                                    className="w-full mt-2 px-3 py-1.5 rounded border border-slate-300 text-slate-900 bg-white"
                                  />
                                )}
                              </div>
                            );
                          })}
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
                              <div className="space-y-6 mx-auto w-full flex flex-col items-center">
                    {paginatedPages.map((page) => {
                      if (activePreviewPage !== 'all' && activePreviewPage !== page.pageNumber) {
                        return null;
                      }

                      return (
                        <div
                          key={page.pageNumber}
                          className="bg-white shadow-2xl border border-slate-300 relative mx-auto shrink-0 overflow-hidden"
                          style={{
                            fontFamily: 'Arial, Helvetica, sans-serif',
                            fontSize: '11px',
                            lineHeight: '12.65px',
                            color: '#000000',
                            width: `${PDF_LAYOUT.pageWidth}px`,
                            height: `${PDF_LAYOUT.pageHeight}px`,
                          }}
                        >
                          {/* Kop Surat: lebar tepat 425 pt seperti di PDF */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/header-hasil.jpeg"
                            alt="Kop Klinik"
                            className="absolute"
                            style={{
                              left: `${PDF_LAYOUT.leftMargin}px`,
                              top: `${PDF_LAYOUT.headerTop}px`,
                              width: `${PDF_LAYOUT.printableWidth}px`,
                              height: `${PDF_LAYOUT.headerHeight}px`,
                              objectFit: 'fill',
                            }}
                          />

                          {/* Area konten: ukuran dalam px = pt PDF (1pt = 1px) agar seragam */}
                          <div
                            className="absolute"
                            style={{
                              left: `${PDF_LAYOUT.leftMargin}px`,
                              top: `${PDF_LAYOUT.contentTop}px`,
                              width: `${PDF_LAYOUT.printableWidth}px`,
                            }}
                          >
                            {/* Judul & Identitas hanya di halaman pertama */}
                            {page.isFirstPage && (
                              <>
                                <div
                                  className="text-center font-bold"
                                  style={{ fontSize: '12px', lineHeight: '13.8px', color: '#1e3a8a' }}
                                >
                                  <div>RESUME HASIL PEMERIKSAAN</div>
                                  <div>MEDICAL CHECK UP ({(formData.purpose || 'MCU KERJA').toUpperCase()})</div>
                                </div>

                                <div style={{ marginTop: '6px' }}>
                                  <div className="font-bold" style={{ fontSize: '11px', lineHeight: '12.65px' }}>
                                    IDENTITAS PASIEN
                                  </div>
                                  <div style={{ marginTop: '4px', border: '0.5px solid #000' }}>
                                    {[
                                      ['Nama', formData.patientName || '[Nama Pasien]', true],
                                      ['Umur / Jenis Kelamin', formData.ageGender, false],
                                      ['Tanggal Lahir', formData.birthDate || '-', false],
                                      ['Alamat', formData.address || '-', false],
                                      ['Tanggal Pemeriksaan', formData.examDate, false],
                                      ['Keperluan', formData.purpose || 'MCU kerja', false],
                                    ].map(([label, value, bold], rowIdx) => (
                                      <div
                                        key={rowIdx}
                                        style={{
                                          display: 'flex',
                                          minHeight: '16px',
                                          borderTop: rowIdx === 0 ? 'none' : '0.5px solid #000',
                                        }}
                                      >
                                        <div
                                          className="font-bold"
                                          style={{ width: '145px', flex: '0 0 145px', padding: '1.5px 6px', lineHeight: '12.65px' }}
                                        >
                                          {label}
                                        </div>
                                        <div
                                          className={bold ? 'font-bold' : ''}
                                          style={{
                                            width: `${PDF_LAYOUT.idValueWidth + 10}px`,
                                            padding: '1.5px 6px',
                                            lineHeight: '12.65px',
                                            wordBreak: 'break-word',
                                          }}
                                        >
                                          {value as string}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Poin pemeriksaan halaman ini */}
                            {page.sections.map((secChunk, idx) => (
                              <div key={idx} style={{ marginTop: '6px' }}>
                                <div className="font-bold" style={{ fontSize: '11.5px', lineHeight: '13.225px', color: '#1e3a8a' }}>
                                  {secChunk.sectionTitle}
                                </div>
                                <div style={{ marginTop: '3px' }}>
                                  {secChunk.items.map((it) => (
                                    <div key={it.id} style={{ display: 'flex', paddingLeft: `${PDF_LAYOUT.pointIndent}px` }}>
                                      <span
                                        style={{
                                          width: `${PDF_LAYOUT.pointLabelWidth}px`,
                                          flex: `0 0 ${PDF_LAYOUT.pointLabelWidth}px`,
                                          color: '#334155',
                                          wordBreak: 'break-word',
                                        }}
                                      >
                                        {it.name}
                                      </span>
                                      <span style={{ flex: 1, color: '#000', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                                        : {it.value || '-'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                            {/* Penanda halaman berikutnya (mengikuti layout PDF) */}
                            {page.promptContinue && (
                              <div
                                className="text-right italic"
                                style={{ marginTop: '10px', fontSize: '10px', lineHeight: '11.5px', color: '#475569' }}
                              >
                                (Dilanjutkan di halaman berikutnya)
                              </div>
                            )}

                            {/* Kesimpulan, Saran & TTD bila muat di halaman ini */}
                            {page.hasConclusionAndSign && (
                              <div style={{ marginTop: '6px' }}>
                                <div className="font-bold" style={{ fontSize: '11.5px', lineHeight: '13.225px', color: '#1e3a8a' }}>
                                  KESIMPULAN
                                </div>
                                <div style={{ marginTop: '2px' }}>
                                  {CONCLUSION_OPTIONS.map((option) => {
                                    const selected = formData.conclusionType === option;
                                    const notesText =
                                      option === 'Fit dengan catatan'
                                        ? formData.conclusionNotes
                                        : option === 'Temporary unfit'
                                        ? formData.temporaryUnfitNotes
                                        : option === 'Unfit'
                                        ? formData.unfitNotes
                                        : '';
                                    return (
                                      <div key={option} style={{ display: 'flex', minHeight: '16px' }}>
                                        <span
                                          className="font-bold"
                                          style={{
                                            marginLeft: '6px',
                                            marginTop: '2px',
                                            width: '9px',
                                            height: '9px',
                                            flex: '0 0 9px',
                                            border: '1px solid #000',
                                            background: selected ? '#000' : 'transparent',
                                            color: '#fff',
                                            fontSize: '8px',
                                            lineHeight: '9px',
                                            textAlign: 'center',
                                          }}
                                        >
                                          {selected ? '✓' : ''}
                                        </span>
                                        <span
                                          className={selected ? 'font-bold' : ''}
                                          style={{ marginLeft: '7px', wordBreak: 'break-word' }}
                                        >
                                          {CONCLUSION_LABELS[option]}
                                          {option !== 'Fit' ? ` : ${notesText || '_____________'}` : ''}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div style={{ marginTop: '8px' }}>
                                  <div className="font-bold" style={{ fontSize: '11.5px', lineHeight: '13.225px', color: '#1e3a8a' }}>
                                    SARAN - SARAN
                                  </div>
                                  <div style={{ marginTop: '3px' }}>
                                    {(formData.recommendations
                                      ? formData.recommendations.split('\n').filter((s) => s.trim() !== '')
                                      : ['Pertahankan pola hidup sehat dan olahraga teratur.']
                                    ).map((s, sIdx) => (
                                      <div key={sIdx} style={{ paddingLeft: '8px', color: '#000', wordBreak: 'break-word' }}>
                                        • {s}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                  <div style={{ width: '180px', textAlign: 'center', lineHeight: '12.65px' }}>
                                    <div style={{ marginTop: '6px' }}>Dokter Pemeriksa,</div>
                                    <div style={{ height: '50px' }} />
                                    <div className="font-bold underline">{formData.doctorName}</div>
                                    <div style={{ fontSize: '10px' }}>{formData.doctorSip}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Footer nomor halaman: Cambria 11 pt, center */}
                          <div
                            className="absolute text-center"
                            style={{
                              left: `${PDF_LAYOUT.leftMargin}px`,
                              top: '792px',
                              width: `${PDF_LAYOUT.printableWidth}px`,
                              fontFamily: 'Cambria, Georgia, serif',
                              fontSize: '11px',
                              lineHeight: '12.65px',
                              color: '#000',
                            }}
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
