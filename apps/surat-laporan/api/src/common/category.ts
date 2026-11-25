// Jenis dokumen di sistem surat.
//
// - keluar   : surat untuk/tentang pasien; pasien wajib dipilih sebelum terbit.
// - internal : administrasi klinik; tidak pernah menyimpan data pasien.
// - formulir : formulir yang diisi/ditandatangani pasien (mis. permohonan
//              vaksinasi). Data pasien boleh dipilih untuk mengisi otomatis,
//              tetapi tidak wajib — formulir kosong bisa dicetak untuk diisi
//              tangan.

export const CATEGORIES = ['keluar', 'internal', 'formulir'] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return CATEGORIES.includes(value as Category);
}

/** Jenis yang boleh menyimpan data pasien. */
export function usesPatient(category: string): boolean {
  return category === 'keluar' || category === 'formulir';
}

/** Ekspresi CHECK untuk kolom category di SQLite. */
export const CATEGORY_CHECK = `category IN (${CATEGORIES.map((c) => `'${c}'`).join(', ')})`;
