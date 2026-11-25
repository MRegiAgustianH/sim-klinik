'use client';

import React, { useEffect, useRef } from 'react';
import { loadSuratPro } from '@/lib/suratpro';

// Menampilkan HTML surat (.sp-doc) sebagai lembar kertas, sama seperti di
// editor: ukuran kertas dan margin dibaca dari atribut data-sp-*.
export default function PaperView({ html, className, zoom = 1 }: { html: string; className?: string; zoom?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (ref.current) ref.current.innerHTML = html;
    loadSuratPro()
      .then((api) => {
        if (!cancelled && ref.current) api.renderPaper(ref.current);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [html]);

  return (
    <div className={`paper-stage overflow-auto ${className ?? ''}`}>
      <div className="surat-preview py-4" style={{ zoom }} ref={ref} />
    </div>
  );
}
