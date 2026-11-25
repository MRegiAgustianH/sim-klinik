'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { loadSuratPro, SuratProInstance } from '@/lib/suratpro';
import { uploadImage } from '@/lib/api';

interface Props {
  /** HTML awal (boleh dibungkus .sp-doc berisi setelan kertas). Hanya dibaca saat editor dibuat. */
  initialContent: string;
  height?: string;
  fileName?: string;
  onReady?: (ed: SuratProInstance) => void;
  onChange?: (html: string) => void;
  /** Klik pada penanda variabel di dalam surat. */
  onVarClick?: (key: string) => void;
  className?: string;
}

// Pembungkus React untuk editor SuratPro. Editor dibuat sekali saat komponen
// dipasang; perubahan isi berikutnya dilakukan pemanggil lewat instance yang
// diterima di onReady (setContent, applyValues, dll.), bukan lewat props,
// supaya kursor dan riwayat undo tidak hilang setiap kali React merender.
export default function SuratProEditor({ initialContent, height = '100%', fileName, onReady, onChange, onVarClick, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const callbacks = useRef({ onReady, onChange, onVarClick });
  callbacks.current = { onReady, onChange, onVarClick };

  useEffect(() => {
    let ed: SuratProInstance | null = null;
    let cancelled = false;
    let detachClick: (() => void) | null = null;

    loadSuratPro()
      .then((api) => {
        if (cancelled || !hostRef.current) return;
        ed = api.init({
          container: hostRef.current,
          initialContent,
          height,
          fileName,
          title: fileName,
          uploadImage,
          onChange: (html) => callbacks.current.onChange?.(html),
        });
        // Penanda variabel tidak diketik langsung: nilainya dari formulir.
        ed.ed.querySelectorAll('[data-var]').forEach((el) => el.setAttribute('contenteditable', 'false'));
        const instance = ed;
        const onClick = (e: MouseEvent) => {
          const target = (e.target as HTMLElement)?.closest?.('[data-var]');
          if (target && instance.ed.contains(target)) callbacks.current.onVarClick?.(target.getAttribute('data-var') || '');
        };
        instance.ed.addEventListener('click', onClick);
        detachClick = () => instance.ed.removeEventListener('click', onClick);
        setReady(true);
        callbacks.current.onReady?.(instance);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Editor gagal dimuat.'));

    return () => {
      cancelled = true;
      detachClick?.();
      ed?.destroy();
    };
    // Editor sengaja hanya dibuat sekali.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`relative h-full ${className ?? ''}`}>
      <div ref={hostRef} className="h-full surat-editor-host" />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat editor…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="flex items-start gap-2 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        </div>
      )}
    </div>
  );
}

/** Menyisipkan teks (mis. token {{variabel}}) pada posisi kursor editor. */
export function insertAtCaret(ed: SuratProInstance, text: string) {
  const sel = window.getSelection();
  const inside = sel && sel.rangeCount > 0 && ed.ed.contains(sel.getRangeAt(0).commonAncestorContainer);
  if (!inside) {
    ed.restoreSel();
    const again = window.getSelection();
    if (!again || !again.rangeCount || !ed.ed.contains(again.getRangeAt(0).commonAncestorContainer)) {
      // Belum pernah diklik: taruh di akhir dokumen.
      ed.focus();
      const range = document.createRange();
      const last = ed.ed.lastElementChild || ed.ed;
      range.selectNodeContents(last);
      range.collapse(false);
      again?.removeAllRanges();
      again?.addRange(range);
    }
  }
  document.execCommand('insertText', false, text);
  ed.changed();
}
