// Salinan ringkas formatLetterNumber dari backend, hanya untuk pratinjau pola
// nomor di halaman pengaturan. Nomor sebenarnya selalu diambil backend.
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function previewNumber(pattern: string, code: string, agency: string, digits: number, seq = 1): string {
  const d = new Date();
  return (pattern || '{no}/{kode}/{instansi}/{bulan}/{tahun}')
    .replace(/\{no\}/g, String(seq).padStart(Math.min(Math.max(digits || 3, 1), 6), '0'))
    .replace(/\{kode\}/g, code || 'KODE')
    .replace(/\{instansi\}/g, agency)
    .replace(/\{bulan\}/g, ROMAN[d.getMonth()])
    .replace(/\{bulan_angka\}/g, String(d.getMonth() + 1).padStart(2, '0'))
    .replace(/\{tahun\}/g, String(d.getFullYear()));
}

export const PATTERN_TOKENS = [
  ['{no}', 'nomor urut'],
  ['{kode}', 'kode penomoran'],
  ['{instansi}', 'kode instansi'],
  ['{bulan}', 'bulan romawi'],
  ['{bulan_angka}', 'bulan 01–12'],
  ['{tahun}', 'tahun'],
] as const;
