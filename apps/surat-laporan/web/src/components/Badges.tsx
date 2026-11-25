import React from 'react';
import type { Category, LetterStatus } from '@/lib/types';
import { CATEGORY_INFO } from '@/lib/category';

export function StatusBadge({ status }: { status: LetterStatus }) {
  const map = {
    draft: ['Draft', 'bg-amber-50 text-amber-800 border-amber-200'],
    terbit: ['Terbit', 'bg-emerald-50 text-emerald-800 border-emerald-200'],
    batal: ['Dibatalkan', 'bg-rose-50 text-rose-700 border-rose-200'],
  } as const;
  const [label, tone] = map[status];
  return <span className={`chip ${tone}`}>{label}</span>;
}

export function CategoryBadge({ category }: { category: Category }) {
  const info = CATEGORY_INFO[category] ?? CATEGORY_INFO.internal;
  return <span className={`chip ${info.chip}`}>{category === 'keluar' ? 'Surat keluar · pasien' : info.label}</span>;
}

export function categoryLabel(category: Category) {
  return category === 'keluar' ? 'Surat keluar (pasien)' : (CATEGORY_INFO[category]?.label ?? category);
}
