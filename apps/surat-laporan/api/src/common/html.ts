import sanitizeHtml from 'sanitize-html';

// Isi surat dan template ditampilkan kembali dengan innerHTML di browser staf
// lain, jadi HTML dari editor dibersihkan di server sebelum disimpan: skrip,
// atribut on*, iframe, dan URL javascript: dibuang. Atribut yang dipakai
// editor SuratPro (data-tabs, data-ls, data-sp-*, class sp-*) dan penanda
// variabel (data-var, data-label) dipertahankan.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'br', 'hr',
    'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col', 'caption',
    'img', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'font',
  ],
  allowedAttributes: {
    '*': ['style', 'class', 'data-*', 'title', 'align'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    td: ['colspan', 'rowspan', 'width'],
    th: ['colspan', 'rowspan', 'width'],
    ol: ['start', 'type'],
    col: ['span', 'width'],
    table: ['width', 'border', 'cellpadding', 'cellspacing'],
    font: ['face', 'size', 'color'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
};

export function sanitizeLetterHtml(html: unknown): string {
  if (typeof html !== 'string') return '';
  return sanitizeHtml(html, OPTIONS);
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Mengganti isi penanda variabel <span data-var="key">…</span> dan token
 * {{key}} yang tersisa. Dipakai saat surat diterbitkan untuk mengisi nomor.
 */
export function fillVariable(html: string, key: string, value: string): string {
  const safe = escapeHtml(value);
  const span = new RegExp(`(<span\\b[^>]*\\bdata-var="${key}"[^>]*>)[\\s\\S]*?(</span>)`, 'g');
  return html.replace(span, `$1${safe}$2`).replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), safe);
}

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
