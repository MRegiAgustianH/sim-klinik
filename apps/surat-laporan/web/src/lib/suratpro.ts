// Pemuat editor SuratPro (public/suratpro/suratpro.js, lisensi MIT).
//
// SuratPro adalah editor tanpa dependensi yang dipasang sebagai <script>
// biasa dan membuat window.SuratPro. Skrip dimuat sekali per halaman.

export interface SuratProInstance {
  ed: HTMLElement;
  doc: { paper: string; orient: string; m: { t: number; r: number; b: number; l: number }; font: string; size: number; ls: number };
  getContent(): string;
  getCleanHTML(wrap?: boolean): string;
  setContent(html: string): void;
  getText(): string;
  focus(): void;
  print(): void;
  wordHTML(): string;
  changed(): void;
  saveSel(): void;
  restoreSel(): void;
  setZoom(z: number): void;
  destroy(): void;
}

export interface SuratProOptions {
  container: HTMLElement;
  pageSize?: string;
  orientation?: string;
  margins?: { top: number; right: number; bottom: number; left: number };
  fontFamily?: string;
  fontSize?: number;
  lineSpacing?: number;
  height?: string;
  initialContent?: string;
  fileName?: string;
  title?: string;
  uploadImage?: (file: File) => Promise<string>;
  onChange?: (html: string) => void;
}

interface SuratProApi {
  init(o: SuratProOptions): SuratProInstance;
  renderPaper(root: HTMLElement | string): void;
  contentCSS(scope: string): string;
  PAPERS: Record<string, { w: number; h: number }>;
}

declare global {
  interface Window {
    SuratPro?: SuratProApi;
  }
}

let loading: Promise<SuratProApi> | null = null;

export function loadSuratPro(): Promise<SuratProApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SuratPro hanya berjalan di browser.'));
  if (window.SuratPro) return Promise.resolve(window.SuratPro);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-suratpro]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/suratpro/suratpro.css';
      link.setAttribute('data-suratpro', '1');
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = '/suratpro/suratpro.js';
    script.async = true;
    script.onload = () => (window.SuratPro ? resolve(window.SuratPro) : reject(new Error('SuratPro gagal dimuat.')));
    script.onerror = () => {
      loading = null;
      reject(new Error('Berkas editor /suratpro/suratpro.js tidak dapat dimuat.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Editor tersembunyi sekali pakai, untuk mencetak atau mengunduh .doc surat
 * yang sedang ditampilkan sebagai lembar kertas (bukan di editor).
 */
async function withHiddenEditor<T>(html: string, title: string, fn: (ed: SuratProInstance) => T): Promise<T> {
  const api = await loadSuratPro();
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1200px;height:900px;overflow:hidden';
  document.body.appendChild(host);
  const ed = api.init({ container: host, initialContent: html, title, height: '900px' });
  try {
    return fn(ed);
  } finally {
    // print() memakai iframe sendiri, jadi editor boleh dilepas sesudahnya.
    setTimeout(() => {
      ed.destroy();
      host.remove();
    }, 500);
  }
}

export function printHtml(html: string, title: string) {
  return withHiddenEditor(html, title, (ed) => ed.print());
}

export function downloadDocHtml(html: string, fileName: string) {
  return withHiddenEditor(html, fileName, (ed) => exportDoc(ed, fileName));
}

/**
 * Unduh .doc dari editor. Alamat gambar relatif (/api/uploads/...) diubah
 * menjadi alamat lengkap, karena Word membuka file di luar browser dan tidak
 * tahu server asalnya.
 */
export function exportDoc(ed: SuratProInstance, fileName: string) {
  const origin = window.location.origin;
  const html = ed.wordHTML().replace(/(<img\b[^>]*\bsrc=")\/(?!\/)/g, `$1${origin}/`);
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(fileName)}.doc`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

export function safeFileName(name: string): string {
  return (name || 'surat').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'surat';
}
