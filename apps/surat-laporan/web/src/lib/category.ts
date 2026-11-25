import type { Category } from './types';

// Jenis dokumen. Sama dengan api/src/common/category.ts.
//  - keluar   : untuk/tentang pasien; pasien wajib sebelum terbit.
//  - internal : administrasi klinik; tanpa data pasien.
//  - formulir : diisi/ditandatangani pasien; data pasien opsional, isian
//               kosong dicetak titik-titik untuk ditulis tangan.

export const CATEGORIES: Category[] = ['keluar', 'internal', 'formulir'];

export const CATEGORY_INFO: Record<Category, { label: string; short: string; desc: string; designer: string; chip: string }> = {
  keluar: {
    label: 'Surat keluar',
    short: 'Keluar',
    desc: 'Berkaitan dengan pasien — data diambil dari data induk pasien.',
    designer: 'Memakai data pasien (wajib)',
    chip: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  internal: {
    label: 'Surat internal',
    short: 'Internal',
    desc: 'Administrasi klinik — tanpa data pasien.',
    designer: 'Tanpa data pasien',
    chip: 'bg-violet-50 text-violet-800 border-violet-200',
  },
  formulir: {
    label: 'Formulir',
    short: 'Formulir',
    desc: 'Diisi dan ditandatangani pasien. Pilih pasien untuk mengisi otomatis, atau cetak kosong untuk ditulis tangan.',
    designer: 'Data pasien opsional; isian kosong dicetak titik-titik',
    chip: 'bg-amber-50 text-amber-800 border-amber-200',
  },
};

/** Jenis yang boleh memakai data pasien. */
export function usesPatient(category: Category): boolean {
  return category === 'keluar' || category === 'formulir';
}
