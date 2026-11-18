// Template standar poin pemeriksaan MCU (dipakai saat laporan lama belum punya examinationSections)
export const MCU_SECTION_CODES = ['vital', 'antropo', 'physical', 'lab', 'support'] as const;
export type McuSectionCode = (typeof MCU_SECTION_CODES)[number];

export const MCU_SECTION_LABELS: Record<McuSectionCode, string> = {
  vital: 'TANDA VITAL',
  antropo: 'ANTROPOMETRI',
  physical: 'PEMERIKSAAN FISIK',
  lab: 'PEMERIKSAAN LABORATORIUM',
  support: 'PEMERIKSAAN PENUNJANG',
};

// Partikel yang tetap huruf kecil saat judul ditulis kapital
const TITLE_PARTICLES = new Set(['dan', 'di', 'ke', 'dari', 'pada', 'untuk', 'yang', 'atau']);

export function formatMcuSectionTitle(code: McuSectionCode, index: number): string {
  const label = MCU_SECTION_LABELS[code]
    .split(' ')
    .map((w, i) => (i > 0 && TITLE_PARTICLES.has(w.toLowerCase()) ? w.toLowerCase() : w))
    .join(' ');
  return `${String.fromCharCode(65 + index)}. ${label}`;
}

export function mcuSectionCode(section: { code?: string; id?: string }): McuSectionCode | null {
  if (section.code && (MCU_SECTION_CODES as readonly string[]).includes(section.code)) {
    return section.code as McuSectionCode;
  }
  const fromId = (section.id || '').replace(/^sec_/, '') as McuSectionCode;
  return (MCU_SECTION_CODES as readonly string[]).includes(fromId) ? fromId : null;
}
