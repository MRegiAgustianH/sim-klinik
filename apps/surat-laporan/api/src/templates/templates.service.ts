import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { parseJson, sanitizeLetterHtml } from '../common/html';
import { Category, isCategory } from '../common/category';

const PAGE_SIZES = ['A4', 'F4', 'Letter', 'Legal', 'A5'];
const LAYOUTS = ['kanan', 'kiri', 'tengah', 'kolom', 'bertingkat', 'tanpa'];
const KOP_MODES = ['default', 'library', 'custom', 'none'];
const VAR_TYPES = ['text', 'textarea', 'number', 'date', 'time', 'select', 'list', 'tabel'];
const LIST_STYLES = ['decimal', 'lower-alpha', 'disc', 'none'];

export interface TemplateVariable {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  columns?: string[];
  default?: string;
  hint?: string;
  heading?: string;
  listStyle?: string;
}

export interface TemplateSignature {
  layout: string;
  showPlaceDate: boolean;
  slots: Array<{ prefix?: string; label: string; signerId?: number | null; signerPosition?: string; showId?: boolean }>;
}

export interface TemplatePage {
  pageSize: string;
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
}

export const DEFAULT_PAGE: TemplatePage = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 1.5, right: 2, bottom: 2, left: 2.5 },
  fontFamily: 'Times New Roman',
  fontSize: 12,
  lineSpacing: 1.15,
};

interface TemplateRow {
  id: number;
  code: string;
  name: string;
  category: Category;
  description: string | null;
  letterheadMode: string;
  letterheadId: number | null;
  customHeaderHtml: string;
  bodyHtml: string;
  closingHtml: string;
  signature: string;
  page: string;
  numbering: string;
  variables: string;
  isActive: number;
  sortOrder: number;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TemplateBody = Partial<{
  code: string;
  name: string;
  category: string;
  description: string;
  letterheadMode: string;
  letterheadId: number | null;
  customHeaderHtml: string;
  bodyHtml: string;
  closingHtml: string;
  signature: unknown;
  page: unknown;
  numbering: unknown;
  variables: unknown;
  isActive: boolean;
  sortOrder: number;
}>;

@Injectable()
export class TemplatesService {
  constructor(private readonly db: DatabaseService) {}

  /** Bentuk yang dikirim ke frontend: kolom JSON sudah diurai. */
  private present(row: TemplateRow) {
    return {
      ...row,
      isActive: row.isActive === 1,
      signature: parseJson<TemplateSignature>(row.signature, { layout: 'kanan', showPlaceDate: true, slots: [] }),
      page: { ...DEFAULT_PAGE, ...parseJson<Partial<TemplatePage>>(row.page, {}) },
      numbering: { code: row.code, pattern: '', ...parseJson<{ code?: string; pattern?: string }>(row.numbering, {}) },
      variables: parseJson<TemplateVariable[]>(row.variables, []),
    };
  }

  list(includeInactive: boolean) {
    const rows = this.db.query<TemplateRow & { letterCount: number }>(
      `SELECT t.id, t.code, t.name, t.category, t.description, t.isActive, t.sortOrder, t.version, t.updatedAt, t.updatedBy,
         t.numbering, t.variables, t.signature, t.page, t.letterheadMode, t.letterheadId, '' AS customHeaderHtml,
         '' AS bodyHtml, '' AS closingHtml, t.createdBy, t.createdAt,
         (SELECT COUNT(*) FROM letters l WHERE l.templateId = t.id) AS letterCount
       FROM templates t ${includeInactive ? '' : 'WHERE t.isActive = 1'}
       ORDER BY t.category ASC, t.sortOrder ASC, t.name ASC`
    );
    return rows.map((row) => {
      const t = this.present(row);
      return {
        id: t.id,
        code: t.code,
        name: t.name,
        category: t.category,
        description: t.description,
        isActive: t.isActive,
        version: t.version,
        updatedAt: t.updatedAt,
        updatedBy: t.updatedBy,
        numbering: t.numbering,
        variableCount: t.variables.length,
        signerCount: t.signature.slots.length,
        pageSize: t.page.pageSize,
        letterCount: row.letterCount,
      };
    });
  }

  private row(id: number): TemplateRow {
    const row = this.db.get<TemplateRow>('SELECT * FROM templates WHERE id = ?', [id]);
    if (!row) throw new NotFoundException('Template tidak ditemukan.');
    return row;
  }

  get(id: number) {
    return this.present(this.row(id));
  }

  // ---------------------------------------------------------------------------
  // Validasi
  // ---------------------------------------------------------------------------

  private cleanCode(raw: unknown): string {
    const code = String(raw || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(code)) {
      throw new BadRequestException('Kode template 1–20 karakter: huruf besar, angka, atau tanda hubung (mis. SKS, SPB-ATK).');
    }
    return code;
  }

  private cleanSignature(raw: unknown): TemplateSignature {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<TemplateSignature>;
    const layout = LAYOUTS.includes(String(s.layout)) ? String(s.layout) : 'kanan';
    const slots = Array.isArray(s.slots) ? s.slots.slice(0, 6) : [];
    return {
      layout,
      showPlaceDate: s.showPlaceDate !== false,
      slots: slots.map((slot) => ({
        prefix: String(slot?.prefix ?? '').slice(0, 100),
        label: String(slot?.label ?? '').slice(0, 150),
        signerId: Number.isInteger(Number(slot?.signerId)) && Number(slot?.signerId) > 0 ? Number(slot.signerId) : null,
        signerPosition: String(slot?.signerPosition ?? '').slice(0, 150),
        showId: slot?.showId !== false,
      })),
    };
  }

  private cleanPage(raw: unknown): TemplatePage {
    const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<TemplatePage>;
    const num = (v: unknown, min: number, max: number, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : fallback;
    };
    const m = (p.margins || {}) as Partial<TemplatePage['margins']>;
    return {
      pageSize: PAGE_SIZES.includes(String(p.pageSize)) ? String(p.pageSize) : DEFAULT_PAGE.pageSize,
      orientation: p.orientation === 'landscape' ? 'landscape' : 'portrait',
      margins: {
        top: num(m.top, 0, 10, DEFAULT_PAGE.margins.top),
        right: num(m.right, 0, 10, DEFAULT_PAGE.margins.right),
        bottom: num(m.bottom, 0, 10, DEFAULT_PAGE.margins.bottom),
        left: num(m.left, 0, 10, DEFAULT_PAGE.margins.left),
      },
      fontFamily: String(p.fontFamily || DEFAULT_PAGE.fontFamily).slice(0, 60),
      fontSize: num(p.fontSize, 6, 72, DEFAULT_PAGE.fontSize),
      lineSpacing: num(p.lineSpacing, 0.5, 4, DEFAULT_PAGE.lineSpacing),
    };
  }

  private cleanNumbering(raw: unknown, code: string) {
    const n = (raw && typeof raw === 'object' ? raw : {}) as { code?: string; pattern?: string };
    const numberCode = String(n.code || code).trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(numberCode)) {
      throw new BadRequestException('Kode penomoran 1–20 karakter: huruf besar, angka, titik, atau tanda hubung.');
    }
    const pattern = String(n.pattern || '').trim();
    if (pattern && !pattern.includes('{no}')) throw new BadRequestException('Pola nomor wajib memuat {no}.');
    return { code: numberCode, pattern: pattern.slice(0, 120) };
  }

  private cleanVariables(raw: unknown): TemplateVariable[] {
    if (raw == null) return [];
    if (!Array.isArray(raw)) throw new BadRequestException('Daftar variabel tidak valid.');
    const seen = new Set<string>();
    return raw.slice(0, 80).map((v, i) => {
      const key = String(v?.key || '').trim();
      if (!/^[a-z][a-z0-9_]{0,40}$/.test(key)) {
        throw new BadRequestException(`Variabel ke-${i + 1}: kunci "${key}" hanya boleh huruf kecil, angka, dan garis bawah.`);
      }
      if (seen.has(key)) throw new BadRequestException(`Variabel "${key}" ditulis dua kali.`);
      seen.add(key);
      const type = VAR_TYPES.includes(String(v?.type)) ? String(v.type) : 'text';
      const strList = (list: unknown) =>
        Array.isArray(list) ? list.map((x) => String(x).trim()).filter(Boolean).slice(0, 50) : undefined;
      const out: TemplateVariable = {
        key,
        label: String(v?.label || key).slice(0, 120),
        type,
      };
      if (v?.required) out.required = true;
      if (v?.default != null && String(v.default) !== '') out.default = String(v.default).slice(0, 2000);
      if (v?.hint) out.hint = String(v.hint).slice(0, 300);
      if (type === 'select') out.options = strList(v.options) ?? [];
      if (type === 'tabel') {
        out.columns = strList(v.columns) ?? [];
        if (!out.columns.length) throw new BadRequestException(`Variabel tabel "${key}" wajib punya minimal satu kolom.`);
      }
      if (type === 'list') {
        if (v?.heading) out.heading = String(v.heading).slice(0, 120);
        out.listStyle = LIST_STYLES.includes(String(v?.listStyle)) ? String(v.listStyle) : 'decimal';
      }
      return out;
    });
  }

  private clean(body: TemplateBody, current?: TemplateRow) {
    const code = this.cleanCode(body.code ?? current?.code);
    const name = String(body.name ?? current?.name ?? '').trim();
    if (!name) throw new BadRequestException('Nama template wajib diisi.');
    const category = String(body.category ?? current?.category);
    if (!isCategory(category)) {
      throw new BadRequestException('Jenis surat harus "keluar" (berkaitan dengan pasien), "internal", atau "formulir".');
    }
    const letterheadMode = KOP_MODES.includes(String(body.letterheadMode)) ? String(body.letterheadMode) : 'default';
    let letterheadId: number | null = null;
    if (letterheadMode === 'library') {
      letterheadId = Number(body.letterheadId);
      if (!this.db.get('SELECT id FROM letterheads WHERE id = ?', [letterheadId])) {
        throw new BadRequestException('Kop surat yang dipilih tidak ditemukan.');
      }
    }
    return {
      code,
      name: name.slice(0, 150),
      category,
      description: String(body.description ?? current?.description ?? '').trim().slice(0, 500),
      letterheadMode,
      letterheadId,
      customHeaderHtml: sanitizeLetterHtml(body.customHeaderHtml ?? current?.customHeaderHtml ?? ''),
      bodyHtml: sanitizeLetterHtml(body.bodyHtml ?? current?.bodyHtml ?? ''),
      closingHtml: sanitizeLetterHtml(body.closingHtml ?? current?.closingHtml ?? ''),
      signature: JSON.stringify(this.cleanSignature(body.signature ?? parseJson(current?.signature, {}))),
      page: JSON.stringify(this.cleanPage(body.page ?? parseJson(current?.page, {}))),
      numbering: JSON.stringify(this.cleanNumbering(body.numbering ?? parseJson(current?.numbering, {}), code)),
      variables: JSON.stringify(this.cleanVariables(body.variables ?? parseJson(current?.variables, []))),
      isActive: body.isActive === undefined ? (current?.isActive ?? 1) : body.isActive ? 1 : 0,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : (current?.sortOrder ?? 0),
    };
  }

  private assertCodeFree(code: string, exceptId?: number) {
    const other = this.db.get<{ id: number; name: string }>('SELECT id, name FROM templates WHERE code = ?', [code]);
    if (other && other.id !== exceptId) {
      throw new ConflictException(`Kode ${code} sudah dipakai template "${other.name}".`);
    }
  }

  private snapshot(id: number, version: number, by: string) {
    const row = this.row(id);
    this.db.run('INSERT OR REPLACE INTO template_versions (templateId, version, snapshot, createdBy) VALUES (?, ?, ?, ?)', [
      id,
      version,
      JSON.stringify(row),
      by,
    ]);
  }

  // ---------------------------------------------------------------------------
  // Tulis
  // ---------------------------------------------------------------------------

  create(body: TemplateBody, by: string) {
    const t = this.clean(body);
    this.assertCodeFree(t.code);
    const id = this.db.transaction(() => {
      const result = this.db.run(
        `INSERT INTO templates (code, name, category, description, letterheadMode, letterheadId, customHeaderHtml, bodyHtml,
           closingHtml, signature, page, numbering, variables, isActive, sortOrder, createdBy, updatedBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          t.code, t.name, t.category, t.description, t.letterheadMode, t.letterheadId, t.customHeaderHtml, t.bodyHtml,
          t.closingHtml, t.signature, t.page, t.numbering, t.variables, t.isActive, t.sortOrder, by, by,
        ]
      );
      const newId = Number(result.lastInsertRowid);
      this.snapshot(newId, 1, by);
      return newId;
    });
    return this.get(id);
  }

  update(id: number, body: TemplateBody, by: string) {
    const current = this.row(id);
    const t = this.clean(body, current);
    this.assertCodeFree(t.code, id);
    const nextVersion = current.version + 1;
    this.db.transaction(() => {
      this.db.run(
        `UPDATE templates SET code = ?, name = ?, category = ?, description = ?, letterheadMode = ?, letterheadId = ?,
           customHeaderHtml = ?, bodyHtml = ?, closingHtml = ?, signature = ?, page = ?, numbering = ?, variables = ?,
           isActive = ?, sortOrder = ?, version = ?, updatedBy = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          t.code, t.name, t.category, t.description, t.letterheadMode, t.letterheadId, t.customHeaderHtml, t.bodyHtml,
          t.closingHtml, t.signature, t.page, t.numbering, t.variables, t.isActive, t.sortOrder, nextVersion, by, id,
        ]
      );
      this.snapshot(id, nextVersion, by);
    });
    return this.get(id);
  }

  setActive(id: number, active: boolean, by: string) {
    this.row(id);
    // Mengaktifkan/menonaktifkan tidak mengubah isi, jadi tidak membuat versi baru.
    this.db.run('UPDATE templates SET isActive = ?, updatedBy = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [active ? 1 : 0, by, id]);
    return this.get(id);
  }

  duplicate(id: number, by: string) {
    const src = this.row(id);
    let code = `${src.code}-2`.slice(0, 20);
    for (let n = 2; this.db.get('SELECT id FROM templates WHERE code = ?', [code]); n++) {
      code = `${src.code.slice(0, 16)}-${n}`;
    }
    const numbering = parseJson<{ code?: string; pattern?: string }>(src.numbering, {});
    return this.create(
      {
        ...src,
        code,
        name: `${src.name} (salinan)`,
        isActive: true,
        signature: parseJson(src.signature, {}),
        page: parseJson(src.page, {}),
        // Salinan tetap memakai urutan nomor yang sama dengan aslinya kecuali diubah.
        numbering: { code: numbering.code || src.code, pattern: numbering.pattern || '' },
        variables: parseJson(src.variables, []),
      },
      by
    );
  }

  remove(id: number) {
    const row = this.row(id);
    const used = this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM letters WHERE templateId = ?', [id])?.n ?? 0;
    if (used > 0) {
      // Surat lama tetap utuh karena menyimpan salinan isi, tetapi tautan ke
      // template dipertahankan untuk arsip: template cukup dinonaktifkan.
      this.db.run('UPDATE templates SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [id]);
      return { deleted: false, message: `Template "${row.name}" dipakai ${used} surat, jadi dinonaktifkan (bukan dihapus).` };
    }
    this.db.run('DELETE FROM templates WHERE id = ?', [id]);
    return { deleted: true, message: `Template "${row.name}" dihapus.` };
  }

  versions(id: number) {
    this.row(id);
    return this.db.query<{ version: number; createdBy: string; createdAt: string }>(
      'SELECT version, createdBy, createdAt FROM template_versions WHERE templateId = ? ORDER BY version DESC',
      [id]
    );
  }

  restore(id: number, version: number, by: string) {
    const snap = this.db.get<{ snapshot: string }>('SELECT snapshot FROM template_versions WHERE templateId = ? AND version = ?', [
      id,
      version,
    ]);
    if (!snap) throw new NotFoundException(`Versi ${version} tidak ditemukan.`);
    const old = parseJson<TemplateRow | null>(snap.snapshot, null);
    if (!old) throw new BadRequestException('Salinan versi rusak dan tidak bisa dipulihkan.');
    // Kode dipertahankan dari versi sekarang agar penomoran tidak berpindah diam-diam.
    const current = this.row(id);
    return this.update(
      id,
      {
        ...old,
        code: current.code,
        isActive: current.isActive === 1,
        signature: parseJson(old.signature, {}),
        page: parseJson(old.page, {}),
        numbering: parseJson(old.numbering, {}),
        variables: parseJson(old.variables, []),
      },
      by
    );
  }
}
