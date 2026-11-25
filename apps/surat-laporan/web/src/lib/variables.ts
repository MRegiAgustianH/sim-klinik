import type { Category, Patient, Settings, TemplateSignature, VarDef } from './types';
import { usesPatient } from './category';

// Variabel yang selalu tersedia di setiap template. Variabel khusus per jenis
// surat (diagnosis, daftar barang, dll.) didefinisikan di template masing-masing.

export interface CatalogVar {
  key: string;
  label: string;
  group: 'Surat' | 'Klinik' | 'Pasien' | 'Penandatangan';
  block?: boolean;
  hint?: string;
}

export const SYSTEM_VARS: CatalogVar[] = [
  { key: 'nomor_surat', label: 'Nomor surat', group: 'Surat', hint: 'Diisi otomatis saat surat diterbitkan.' },
  { key: 'tanggal_surat', label: 'Tanggal surat', group: 'Surat' },
  { key: 'perihal', label: 'Perihal', group: 'Surat' },
  { key: 'tujuan', label: 'Tujuan / kepada', group: 'Surat' },
  { key: 'tanda_tangan', label: 'Blok tanda tangan', group: 'Surat', block: true, hint: 'Letakkan di paragraf sendiri.' },
  { key: 'tahun', label: 'Tahun', group: 'Surat' },
  { key: 'klinik_nama', label: 'Nama klinik', group: 'Klinik' },
  { key: 'klinik_nama_kapital', label: 'NAMA KLINIK (kapital)', group: 'Klinik' },
  { key: 'klinik_alamat', label: 'Alamat klinik', group: 'Klinik' },
  { key: 'klinik_kota', label: 'Kota', group: 'Klinik' },
  { key: 'klinik_telepon', label: 'Telepon klinik', group: 'Klinik' },
  { key: 'klinik_email', label: 'Email klinik', group: 'Klinik' },
  { key: 'klinik_website', label: 'Situs web klinik', group: 'Klinik' },
];

// Untuk template surat keluar dan formulir: surat internal tidak boleh bergantung
// pada data pasien.
export const PATIENT_VARS: CatalogVar[] = [
  { key: 'nama_pasien', label: 'Nama pasien', group: 'Pasien' },
  { key: 'nik', label: 'NIK', group: 'Pasien' },
  { key: 'ttl', label: 'Tempat, tanggal lahir', group: 'Pasien' },
  { key: 'tempat_lahir', label: 'Tempat lahir', group: 'Pasien' },
  { key: 'tanggal_lahir', label: 'Tanggal lahir', group: 'Pasien' },
  { key: 'umur', label: 'Umur', group: 'Pasien' },
  { key: 'jenis_kelamin', label: 'Jenis kelamin', group: 'Pasien' },
  { key: 'alamat_pasien', label: 'Alamat pasien', group: 'Pasien' },
  { key: 'pekerjaan', label: 'Pekerjaan', group: 'Pasien' },
  { key: 'no_hp', label: 'No. HP / WA', group: 'Pasien' },
  { key: 'email_pasien', label: 'Email pasien', group: 'Pasien' },
  { key: 'status_perkawinan', label: 'Status perkawinan', group: 'Pasien' },
];

export function signerVars(count: number): CatalogVar[] {
  const list: CatalogVar[] = [];
  for (let n = 1; n <= Math.max(count, 1); n++) {
    list.push(
      { key: `ttd_${n}_nama`, label: `Penandatangan ${n} — nama`, group: 'Penandatangan' },
      { key: `ttd_${n}_jabatan`, label: `Penandatangan ${n} — jabatan`, group: 'Penandatangan' },
      { key: `ttd_${n}_id`, label: `Penandatangan ${n} — NIP/SIP lengkap`, group: 'Penandatangan' }
    );
  }
  return list;
}

const SIGNER_KEY_RE = /^ttd_(\d+)_(nama|jabatan|id|nip)$/;

/** Semua variabel bawaan yang dikenali untuk satu template. */
export function builtinVars(category: Category, signature?: TemplateSignature): CatalogVar[] {
  return [...SYSTEM_VARS, ...(usesPatient(category) ? PATIENT_VARS : []), ...signerVars(signature?.slots.length ?? 1)];
}

export function isBuiltinKey(key: string, category: Category): boolean {
  if (SIGNER_KEY_RE.test(key)) return true;
  return builtinVars(category).some((v) => v.key === key);
}

/** Token {{x}} yang muncul di HTML, berurutan dan unik. */
export function extractTokens(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/** {{tanggal_acara_hari}} → nama hari dari variabel tanggal tanggal_acara. */
export function dayVarBase(key: string, defs: VarDef[]): VarDef | undefined {
  if (!key.endsWith('_hari')) return undefined;
  const base = key.slice(0, -5);
  return defs.find((d) => d.key === base && d.type === 'date');
}

// ---------------------------------------------------------------------------
// Format tanggal Indonesia
// ---------------------------------------------------------------------------

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateId(iso: string | null | undefined): string {
  const d = parseIso(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

export function dayNameId(iso: string | null | undefined): string {
  const d = parseIso(iso);
  return d ? DAYS[d.getDay()] : '';
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function genderLabel(g: string | null | undefined): string {
  if (!g) return '';
  const v = g.toLowerCase();
  if (v.startsWith('l') || v === 'male' || v === 'pria') return 'Laki-laki';
  if (v.startsWith('p') || v === 'female' || v === 'wanita') return 'Perempuan';
  return g;
}

/** Nilai variabel pasien dari data layanan identitas. */
export function patientValues(p: Patient | null): Record<string, string> {
  if (!p) return {};
  const tgl = formatDateId(p.birthDate);
  return {
    nama_pasien: p.fullName || '',
    nik: p.nik || '',
    tempat_lahir: p.birthPlace || '',
    tanggal_lahir: tgl,
    ttl: [p.birthPlace, tgl].filter(Boolean).join(', '),
    umur: p.age != null ? `${p.age} tahun` : '',
    jenis_kelamin: genderLabel(p.gender),
    alamat_pasien: p.address || '',
    pekerjaan: p.occupation || '',
    no_hp: p.phoneWa || '',
    email_pasien: p.email || '',
    status_perkawinan: p.maritalStatus || '',
  };
}

export function clinicValues(s: Settings): Record<string, string> {
  return {
    klinik_nama: s.klinik_nama || '',
    klinik_nama_kapital: (s.klinik_nama || '').toUpperCase(),
    klinik_alamat: s.klinik_alamat || '',
    klinik_kota: s.klinik_kota || '',
    klinik_telepon: s.klinik_telepon || '',
    klinik_email: s.klinik_email || '',
    klinik_website: s.klinik_website || '',
  };
}
