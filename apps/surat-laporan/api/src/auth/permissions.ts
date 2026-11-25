// Daftar fitur aplikasi surat yang bisa diatur Superadmin per orang di portal.
//
// Dikirim ke layanan identitas setiap kali backend start (CatalogRegistrar).
// Melihat arsip dan mencetak surat tidak diatur di sini: siapa pun yang diberi
// akses aplikasi surat di portal boleh melihat.

export const PERMISSIONS = {
  SURAT_BUAT: 'surat.buat',
  SURAT_TERBITKAN: 'surat.terbitkan',
  SURAT_BATAL: 'surat.batal',
  SURAT_HAPUS: 'surat.hapus',
  TEMPLATE_KELOLA: 'template.kelola',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: Array<{ code: Permission; label: string; group: string; description?: string }> = [
  { code: 'surat.buat', label: 'Buat & ubah draft surat', group: 'Surat' },
  {
    code: 'surat.terbitkan',
    label: 'Terbitkan surat (ambil nomor)',
    group: 'Surat',
    description: 'Nomor surat diambil dan isi surat dikunci; tidak bisa diubah lagi.',
  },
  { code: 'surat.batal', label: 'Batalkan surat yang sudah terbit', group: 'Surat' },
  { code: 'surat.hapus', label: 'Hapus draft surat milik orang lain', group: 'Surat' },
  {
    code: 'template.kelola',
    label: 'Kelola template, kop surat, penandatangan & penomoran',
    group: 'Pengelolaan',
  },
];

export const PERMISSION_PRESETS: Array<{ code: string; label: string; permissions: Permission[] }> = [
  { code: 'administrasi', label: 'Administrasi', permissions: ['surat.buat', 'surat.terbitkan'] },
  { code: 'dokter', label: 'Dokter', permissions: ['surat.buat', 'surat.terbitkan'] },
  { code: 'pimpinan', label: 'Pimpinan', permissions: ['surat.buat', 'surat.terbitkan', 'surat.batal', 'surat.hapus'] },
  { code: 'lihat', label: 'Hanya lihat', permissions: [] },
];
