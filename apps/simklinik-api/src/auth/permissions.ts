// Daftar fitur SIMKlinik yang bisa diatur Superadmin per orang di portal.
//
// Katalog ini milik SIMKlinik: dikirim ke layanan identitas setiap kali
// backend start (CatalogRegistrar). Menambah fitur baru cukup dengan
// menambah baris di sini lalu memakai @RequirePermission() di endpoint-nya.
//
// Melihat data (dashboard, daftar pasien, MCU, stok) tidak diatur di sini:
// siapa pun yang diberi akses SIMKlinik di portal boleh melihat.

export const PERMISSIONS = {
  PASIEN_TULIS: 'pasien.tulis',
  PASIEN_SETUJUI: 'pasien.setujui',
  PASIEN_SELESAI: 'pasien.selesai',
  PASIEN_HAPUS: 'pasien.hapus',
  REGISTRASI_KELOLA: 'registrasi.kelola',
  MCU_TULIS: 'mcu.tulis',
  MCU_HAPUS: 'mcu.hapus',
  STOK_TULIS: 'stok.tulis',
  STOK_HAPUS: 'stok.hapus',
  LAPORAN_EKSPOR: 'laporan.ekspor',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: Array<{ code: Permission; label: string; group: string; description?: string }> = [
  { code: 'pasien.tulis', label: 'Daftarkan & ubah pasien vaksinasi', group: 'Vaksinasi' },
  { code: 'pasien.setujui', label: 'Persetujuan dokter', group: 'Vaksinasi' },
  { code: 'pasien.selesai', label: 'Tandai vaksinasi selesai', group: 'Vaksinasi', description: 'Mengurangi stok vaksin secara otomatis.' },
  { code: 'pasien.hapus', label: 'Hapus data pasien vaksinasi', group: 'Vaksinasi' },
  { code: 'registrasi.kelola', label: 'Sinkron & pengaturan registrasi Google Form', group: 'Vaksinasi' },
  { code: 'mcu.tulis', label: 'Buat & ubah laporan MCU', group: 'MCU' },
  { code: 'mcu.hapus', label: 'Hapus laporan MCU', group: 'MCU' },
  { code: 'stok.tulis', label: 'Tambah & ubah stok vaksin, buku ICV, mutasi', group: 'Stok' },
  { code: 'stok.hapus', label: 'Hapus stok vaksin', group: 'Stok' },
  { code: 'laporan.ekspor', label: 'Unduh laporan Excel & PDF', group: 'Laporan' },
];

// Preset disusun sama persis dengan hak akses per peran sebelum portal
// mengatur fitur, sehingga staf lama tidak kehilangan akses saat dipindah.
export const PERMISSION_PRESETS: Array<{ code: string; label: string; permissions: Permission[] }> = [
  {
    code: 'dokter',
    label: 'Dokter',
    permissions: ['pasien.tulis', 'pasien.setujui', 'registrasi.kelola', 'mcu.tulis', 'mcu.hapus', 'laporan.ekspor'],
  },
  {
    code: 'perawat',
    label: 'Perawat',
    permissions: ['pasien.tulis', 'pasien.selesai', 'registrasi.kelola', 'stok.tulis', 'laporan.ekspor'],
  },
  {
    code: 'lihat',
    label: 'Hanya lihat',
    permissions: [],
  },
];
