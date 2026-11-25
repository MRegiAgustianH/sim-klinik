// Menyusun surat dari template: kop + isi + blok tanda tangan + penutup,
// lalu mengganti setiap token {{variabel}} dengan penanda
//   <span data-var="kunci" data-label="Label">nilai</span>   (sebaris)
//   <div data-var="kunci" data-label="Label">…</div>          (daftar / tabel)
//
// Penanda itu yang membuat formulir di samping editor bisa memperbarui isi
// surat tanpa menghapus suntingan manual: hanya isi penanda yang diganti.
// Saat surat diterbitkan, backend mengisi penanda nomor_surat.

import type { Category, LetterSigner, PageSetup, Patient, Settings, Signer, Template, TemplateSignature, VarDef, VarValue } from './types';
import { builtinVars, clinicValues, dayNameId, dayVarBase, formatDateId, patientValues } from './variables';
import { usesPatient } from './category';

export const PAPERS: Record<string, { w: number; h: number; label: string }> = {
  A4: { w: 21, h: 29.7, label: 'A4 (21 × 29,7 cm)' },
  F4: { w: 21.5, h: 33, label: 'F4 / Folio (21,5 × 33 cm)' },
  Letter: { w: 21.59, h: 27.94, label: 'Letter (21,59 × 27,94 cm)' },
  Legal: { w: 21.59, h: 35.56, label: 'Legal (21,59 × 35,56 cm)' },
  A5: { w: 14.8, h: 21, label: 'A5 (14,8 × 21 cm)' },
};

export const FONTS = ['Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Bookman Old Style', 'Book Antiqua', 'Century Gothic', 'Garamond', 'Georgia', 'Tahoma', 'Verdana'];

export function esc(value: string): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function contentWidthCm(page: PageSetup): number {
  const p = PAPERS[page.pageSize] || PAPERS.A4;
  const w = page.orientation === 'landscape' ? p.h : p.w;
  return w - page.margins.left - page.margins.right;
}

/** Atribut pembungkus .sp-doc yang dibaca editor SuratPro (kertas, margin, font). */
export function docAttrs(page: PageSetup): string {
  const m = page.margins;
  const font = /\s/.test(page.fontFamily) ? `'${page.fontFamily}'` : page.fontFamily;
  return (
    `class="sp-doc" data-sp-paper="${esc(page.pageSize)}" data-sp-orient="${page.orientation}" ` +
    `data-sp-margins="${m.top} ${m.right} ${m.bottom} ${m.left}" data-sp-ls="${page.lineSpacing}" ` +
    `style="font-family:${esc(font)};font-size:${page.fontSize}pt"`
  );
}

export function wrapDoc(page: PageSetup, inner: string): string {
  return `<div ${docAttrs(page)}>${inner}</div>`;
}

/** Isi .sp-doc tanpa pembungkus. */
export function unwrapDoc(html: string): string {
  if (typeof document === 'undefined') return html;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const first = tmp.firstElementChild;
  if (first && tmp.children.length === 1 && first.classList.contains('sp-doc')) return first.innerHTML;
  return html;
}

// ---------------------------------------------------------------------------
// Blok tanda tangan
// ---------------------------------------------------------------------------

export const LAYOUT_LABELS: Record<TemplateSignature['layout'], string> = {
  kanan: 'Satu, di kanan',
  kiri: 'Satu, di kiri',
  tengah: 'Satu, di tengah',
  kolom: 'Berjajar (2–4 kolom)',
  bertingkat: 'Dua berjajar + mengetahui di bawah',
  tanpa: 'Tanpa tanda tangan',
};

function slotLines(sig: TemplateSignature, index: number, withPlaceDate: boolean): { top: string[]; rest: string[] } {
  const slot = sig.slots[index];
  const n = index + 1;
  const top: string[] = [];
  if (withPlaceDate) top.push('{{klinik_kota}}, {{tanggal_surat}}');
  if (slot.prefix) top.push(esc(slot.prefix));
  const rest = [
    slot.label ? esc(slot.label) : `{{ttd_${n}_jabatan}}`,
    '<br>',
    '<br>',
    '<br>',
    `<b><u>{{ttd_${n}_nama}}</u></b>`,
  ];
  if (slot.showId !== false) rest.push(`{{ttd_${n}_id}}`);
  return { top, rest };
}

function columnCells(sig: TemplateSignature, indexes: number[], placeDateAt: number | null): string {
  const blocks = indexes.map((i) => slotLines(sig, i, i === placeDateAt));
  const maxTop = Math.max(0, ...blocks.map((b) => b.top.length));
  const width = Math.floor(100 / indexes.length);
  return blocks
    .map((b) => {
      const lines = [...Array(maxTop - b.top.length).fill('<br>'), ...b.top, ...b.rest];
      return `<td style="width:${width}%;text-align:center;vertical-align:top">${lines
        .map((l) => `<p style="text-align:center">${l}</p>`)
        .join('')}</td>`;
    })
    .join('');
}

export function signatureHtml(sig: TemplateSignature, page: PageSetup): string {
  const count = sig.slots.length;
  if (sig.layout === 'tanpa' || count === 0) return '';

  if (sig.layout === 'kanan' || sig.layout === 'kiri' || sig.layout === 'tengah' || count === 1) {
    const half = Math.round((contentWidthCm(page) / 2) * 100) / 100;
    const style =
      sig.layout === 'kiri' ? `margin-right:${half}cm;text-align:center` : sig.layout === 'tengah' ? 'text-align:center' : `margin-left:${half}cm;text-align:center`;
    const { top, rest } = slotLines(sig, 0, sig.showPlaceDate);
    return [...top, ...rest].map((l) => `<p style="${style}">${l}</p>`).join('');
  }

  const table = (cells: string) => `<table class="sp-nob" style="width:100%;border-collapse:collapse"><tbody><tr>${cells}</tr></tbody></table>`;

  if (sig.layout === 'kolom') {
    const all = sig.slots.map((_, i) => i).slice(0, 4);
    return table(columnCells(sig, all, sig.showPlaceDate ? all[all.length - 1] : null));
  }

  // bertingkat: dua pertama berjajar, sisanya di tengah di bawahnya.
  const firstRow = [0, 1].filter((i) => i < count);
  let html = table(columnCells(sig, firstRow, sig.showPlaceDate ? firstRow[firstRow.length - 1] : null));
  for (let i = 2; i < count; i++) {
    const { top, rest } = slotLines(sig, i, false);
    html += '<p><br></p>' + [...top, ...rest].map((l) => `<p style="text-align:center">${l}</p>`).join('');
  }
  return html;
}

// ---------------------------------------------------------------------------
// Nilai variabel
// ---------------------------------------------------------------------------

export interface ValueContext {
  category: Category;
  defs: VarDef[];
  values: Record<string, VarValue>;
  letterDate: string;
  subject: string;
  recipient: string;
  letterNumber?: string | null;
  settings: Settings;
  patient: Patient | null;
  signers: LetterSigner[];
}

/** Nilai awal variabel khusus template (dari nilai bawaan). */
export function defaultValues(defs: VarDef[]): Record<string, VarValue> {
  const out: Record<string, VarValue> = {};
  for (const d of defs) {
    if (d.type === 'tabel') out[d.key] = [];
    else if (d.type === 'list') out[d.key] = d.default ? d.default.split('\n').filter(Boolean) : [];
    else out[d.key] = d.default ?? '';
  }
  return out;
}

export function resolveValues(ctx: ValueContext): Record<string, VarValue> {
  const all: Record<string, VarValue> = {
    ...clinicValues(ctx.settings),
    ...(usesPatient(ctx.category) ? patientValues(ctx.patient) : {}),
    nomor_surat: ctx.letterNumber || '',
    tanggal_surat: formatDateId(ctx.letterDate),
    tahun: ctx.letterDate ? ctx.letterDate.slice(0, 4) : '',
    perihal: ctx.subject || '',
    tujuan: ctx.recipient || '',
  };
  ctx.signers.forEach((s, i) => {
    const n = i + 1;
    all[`ttd_${n}_nama`] = s.name || '';
    all[`ttd_${n}_jabatan`] = s.role || '';
    all[`ttd_${n}_nip`] = s.idNumber || '';
    all[`ttd_${n}_id`] = s.idNumber ? `${s.idLabel ? `${s.idLabel}. ` : ''}${s.idNumber}` : '';
  });
  for (const d of ctx.defs) {
    const raw = ctx.values[d.key];
    all[d.key] = raw === undefined ? (defaultValues([d])[d.key] as VarValue) : raw;
  }
  return all;
}

function labelOf(key: string, defs: VarDef[], category: Category): string {
  const def = defs.find((d) => d.key === key);
  if (def) return def.label;
  const base = dayVarBase(key, defs);
  if (base) return `Hari (${base.label})`;
  const builtin = builtinVars(category, { layout: 'kolom', showPlaceDate: true, slots: new Array(6).fill({ label: '' }) }).find(
    (v) => v.key === key
  );
  return builtin?.label ?? key;
}

/** Nilai sebaris yang sudah di-escape. */
export function renderInline(key: string, all: Record<string, VarValue>, defs: VarDef[]): string {
  const base = dayVarBase(key, defs);
  if (base) return esc(dayNameId(String(all[base.key] ?? '')));
  const def = defs.find((d) => d.key === key);
  const value = all[key];
  if (value == null) return '';
  if (Array.isArray(value)) {
    if (def?.type === 'tabel') return '';
    return esc((value as string[]).filter(Boolean).join(', '));
  }
  if (def?.type === 'date') return esc(formatDateId(value));
  if (def?.type === 'textarea') return esc(value).replace(/\n/g, '<br>');
  return esc(value);
}

const CELL = 'border:1px solid #000;padding:2pt 4pt';

/** Nilai blok: daftar bernomor atau tabel. */
export function renderBlock(key: string, all: Record<string, VarValue>, defs: VarDef[]): string {
  const def = defs.find((d) => d.key === key);
  const value = all[key];
  if (def?.type === 'tabel') {
    const rows = (Array.isArray(value) ? value : []) as string[][];
    const cols = def.columns ?? [];
    const head = `<tr><th style="${CELL};text-align:center;width:1cm">No</th>${cols.map((c) => `<th style="${CELL};text-align:center">${esc(c)}</th>`).join('')}</tr>`;
    const filled = rows.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim()));
    const body = (filled.length ? filled : [cols.map(() => '')])
      .map(
        (r, i) =>
          `<tr><td style="${CELL};text-align:center">${filled.length ? i + 1 : ''}</td>${cols
            .map((_, ci) => `<td style="${CELL}">${esc(String(r[ci] ?? '')) || '<br>'}</td>`)
            .join('')}</tr>`
      )
      .join('');
    return `<table style="width:100%;border-collapse:collapse"><tbody>${head}${body}</tbody></table>`;
  }
  if (def?.type === 'list') {
    const items = (Array.isArray(value) ? (value as string[]) : String(value ?? '').split('\n')).map((s) => String(s).trim()).filter(Boolean);
    if (!items.length) return '';
    const heading = def.heading ? `<p>${esc(def.heading)}</p>` : '';
    if (def.listStyle === 'none') return heading + items.map((it) => `<p style="text-align:justify">${esc(it)}</p>`).join('');
    const tag = def.listStyle === 'disc' ? 'ul' : 'ol';
    return `${heading}<${tag} style="list-style-type:${def.listStyle || 'decimal'}">${items.map((it) => `<li style="text-align:justify">${esc(it)}</li>`).join('')}</${tag}>`;
  }
  return `<p>${renderInline(key, all, defs)}</p>`;
}

function isBlockDef(key: string, defs: VarDef[]): boolean {
  const def = defs.find((d) => d.key === key);
  return def?.type === 'list' || def?.type === 'tabel';
}

// ---------------------------------------------------------------------------
// Menyusun dokumen
// ---------------------------------------------------------------------------

/** HTML kop yang dipakai template, sesuai mode kopnya. */
export function kopHtmlFor(
  t: { letterheadMode: Template['letterheadMode']; letterheadId: number | null; customHeaderHtml: string },
  letterheads: Array<{ id: number; html: string; isDefault: number }>
): string {
  if (t.letterheadMode === 'none') return '';
  if (t.letterheadMode === 'custom') return t.customHeaderHtml || '';
  const fallback = letterheads.find((k) => k.isDefault) ?? letterheads[0];
  if (t.letterheadMode === 'library') return (letterheads.find((k) => k.id === t.letterheadId) ?? fallback)?.html ?? '';
  return fallback?.html ?? '';
}

export interface ComposeTemplate {
  category: Template['category'];
  bodyHtml: string;
  closingHtml: string;
  signature: TemplateSignature;
  page: PageSetup;
  variables: VarDef[];
}

/** Kop + isi + tanda tangan + penutup, masih berupa token {{...}}. */
export function assembleTokens(t: ComposeTemplate, kopHtml: string): string {
  const sig = signatureHtml(t.signature, t.page);
  let body = t.bodyHtml || '';
  const sigPara = /<p\b[^>]*>\s*\{\{\s*tanda_tangan\s*\}\}\s*<\/p>/;
  if (sigPara.test(body)) body = body.replace(sigPara, sig);
  else if (/\{\{\s*tanda_tangan\s*\}\}/.test(body)) body = body.replace(/\{\{\s*tanda_tangan\s*\}\}/, sig);
  else body += sig;
  return `${kopHtml || ''}${body}${t.closingHtml ? `<p><br></p>${t.closingHtml}` : ''}`;
}

// Formulir: isian kosong dicetak sebagai titik-titik agar bisa ditulis
// tangan, seperti formulir kertas. Panjangnya disimpan di atribut data-blank
// pada penanda, sehingga applyValues bisa memakainya lagi saat nilai dihapus.
const BLANK_LONG = 30;
const BLANK_SHORT = 7;

function blankText(el: Element): string {
  const n = Number(el.getAttribute('data-blank'));
  return n > 0 ? '…'.repeat(Math.min(n, 80)) : '';
}

/** True bila offset berada di dalam sel tabel (titiknya dibuat lebih pendek). */
function insideCell(html: string, offset: number): boolean {
  const before = html.slice(0, offset);
  return (before.match(/<td\b/g)?.length ?? 0) > (before.match(/<\/td>/g)?.length ?? 0);
}

/** Mengganti token dengan penanda data-var berisi nilai saat ini. */
export function fillTokens(html: string, all: Record<string, VarValue>, defs: VarDef[], category: Category): string {
  const attr = (key: string) => `data-var="${key}" data-label="${esc(labelOf(key, defs, category))}"`;
  // Token blok yang berdiri sendiri dalam satu paragraf menjadi <div>.
  let out = html.replace(/<p\b[^>]*>\s*\{\{\s*([a-z][a-z0-9_]*)\s*\}\}\s*<\/p>/g, (whole, key: string) =>
    isBlockDef(key, defs) ? `<div ${attr(key)}>${renderBlock(key, all, defs)}</div>` : whole
  );
  const withBlank = category === 'formulir';
  out = out.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, (_, key: string, offset: number, src: string) => {
    const value = renderInline(key, all, defs);
    if (!withBlank) return `<span ${attr(key)}>${value}</span>`;
    const n = insideCell(src, offset) ? BLANK_SHORT : BLANK_LONG;
    return `<span ${attr(key)} data-blank="${n}">${value || '…'.repeat(n)}</span>`;
  });
  return out;
}

export function composeLetter(t: ComposeTemplate, kopHtml: string, ctx: ValueContext): string {
  const all = resolveValues(ctx);
  return wrapDoc(t.page, fillTokens(assembleTokens(t, kopHtml), all, ctx.defs, t.category));
}

// ---------------------------------------------------------------------------
// Memperbarui penanda di dalam editor
// ---------------------------------------------------------------------------

const lastApplied = new WeakMap<Element, string>();

/**
 * Mengisi ulang setiap penanda data-var di dalam root dengan nilai terbaru.
 * Mengembalikan true bila ada yang berubah (editor perlu menata ulang halaman).
 */
export function applyValues(root: HTMLElement, all: Record<string, VarValue>, defs: VarDef[]): boolean {
  let changed = false;
  root.querySelectorAll<HTMLElement>('[data-var]').forEach((el) => {
    const key = el.getAttribute('data-var') || '';
    const html = el.tagName === 'DIV' ? renderBlock(key, all, defs) : renderInline(key, all, defs) || blankText(el);
    const previous = lastApplied.get(el) ?? el.innerHTML;
    if (previous !== html) {
      el.innerHTML = html;
      changed = true;
    }
    lastApplied.set(el, html);
    if (el.getAttribute('contenteditable') !== 'false') el.setAttribute('contenteditable', 'false');
  });
  return changed;
}

/**
 * Penandatangan awal per slot: tersimpan di surat, atau dari daftar
 * penandatangan sesuai pilihan bawaan template (id, lalu kecocokan jabatan).
 */
export function defaultSigners(sig: TemplateSignature, master: Signer[], saved?: LetterSigner[]): LetterSigner[] {
  return sig.slots.map((slot, i) => {
    const s = saved?.[i];
    if (s) return { role: s.role ?? '', name: s.name ?? '', idLabel: s.idLabel ?? '', idNumber: s.idNumber ?? '', signerId: s.signerId ?? null };
    const pos = (slot.signerPosition ?? '').toLowerCase();
    const pick = master.find((m) => m.id === slot.signerId) ?? (pos ? master.find((m) => m.position.toLowerCase() === pos) : undefined);
    return pick
      ? { role: pick.position, name: pick.name, idLabel: pick.idLabel ?? '', idNumber: pick.idNumber ?? '', signerId: pick.id }
      : { role: slot.signerPosition ?? '', name: '', idLabel: 'NIP', idNumber: '', signerId: null };
  });
}

/** Variabel wajib yang belum diisi (untuk peringatan sebelum terbit). */
export function missingRequired(defs: VarDef[], values: Record<string, VarValue>): VarDef[] {
  return defs.filter((d) => {
    if (!d.required) return false;
    const v = values[d.key];
    if (Array.isArray(v)) return !v.some((x) => (Array.isArray(x) ? x.some((c) => String(c).trim()) : String(x).trim()));
    return !String(v ?? '').trim();
  });
}
