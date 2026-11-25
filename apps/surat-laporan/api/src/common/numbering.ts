const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const DEFAULT_PATTERN = '{no}/{kode}/{instansi}/{bulan}/{tahun}';

/**
 * Menyusun nomor surat dari pola, mis. "{no}/{kode}/{instansi}/{bulan}/{tahun}"
 * menjadi "001/SKS/KU-RTS/XI/2026".
 */
export function formatLetterNumber(
  pattern: string,
  parts: { seq: number; code: string; agency: string; date: string; digits: number }
): string {
  const d = new Date(`${parts.date}T00:00:00`);
  const valid = !Number.isNaN(d.getTime());
  const month = valid ? d.getMonth() : new Date().getMonth();
  const year = valid ? d.getFullYear() : new Date().getFullYear();
  const digits = Math.min(Math.max(parts.digits || 3, 1), 6);
  return (pattern || DEFAULT_PATTERN)
    .replace(/\{no\}/g, String(parts.seq).padStart(digits, '0'))
    .replace(/\{kode\}/g, parts.code)
    .replace(/\{instansi\}/g, parts.agency)
    .replace(/\{bulan\}/g, ROMAN[month])
    .replace(/\{bulan_angka\}/g, String(month + 1).padStart(2, '0'))
    .replace(/\{tahun\}/g, String(year));
}

export function yearOf(date: string): number {
  const y = Number(String(date).slice(0, 4));
  return Number.isInteger(y) && y > 1900 ? y : new Date().getFullYear();
}
