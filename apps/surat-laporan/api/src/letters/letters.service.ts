import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, SqliteParam } from '../database/database.service';
import { SettingsService } from '../settings/settings.service';
import { TemplatesService } from '../templates/templates.service';
import { AuthUser, displayName } from '../auth/jwt.strategy';
import { fillVariable, parseJson, sanitizeLetterHtml } from '../common/html';
import { formatLetterNumber, yearOf } from '../common/numbering';
import { Category, isCategory, usesPatient } from '../common/category';

export interface LetterSignerInput {
  level?: number;
  role?: string;
  name?: string;
  idLabel?: string;
  idNumber?: string;
  signerId?: number | null;
}

export interface LetterBody {
  templateId?: number;
  letterDate?: string;
  subject?: string;
  recipient?: string;
  patientId?: number | null;
  patientSnapshot?: Record<string, unknown> | null;
  payload?: Record<string, unknown>;
  contentHtml?: string;
  signers?: LetterSignerInput[];
}

interface LetterRow {
  id: number;
  letterNumber: string | null;
  numberCode: string | null;
  numberPattern: string | null;
  numberYear: number | null;
  numberSeq: number | null;
  templateId: number | null;
  templateVersion: number | null;
  templateName: string | null;
  category: Category;
  subject: string | null;
  recipient: string | null;
  patientId: number | null;
  patientSnapshot: string | null;
  payload: string;
  contentHtml: string;
  status: 'draft' | 'terbit' | 'batal';
  letterDate: string;
  createdBy: number | null;
  createdByName: string | null;
  updatedByName: string | null;
  issuedAt: string | null;
  issuedByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LetterQuery {
  q?: string;
  status?: string;
  category?: string;
  templateId?: string;
  from?: string;
  to?: string;
  patientId?: string;
  mine?: string;
  page?: string;
  limit?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class LettersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly settings: SettingsService,
    private readonly templates: TemplatesService
  ) {}

  private present(row: LetterRow, withContent: false): ReturnType<LettersService['summary']>;
  private present(row: LetterRow, withContent: true): ReturnType<LettersService['detail']>;
  private present(row: LetterRow, withContent: boolean) {
    return withContent ? this.detail(row) : this.summary(row);
  }

  private detail(row: LetterRow) {
    return {
      ...this.summary(row),
      numberCode: row.numberCode,
      numberPattern: row.numberPattern,
      payload: parseJson<Record<string, unknown>>(row.payload, {}),
      contentHtml: row.contentHtml,
      signers: this.db.query<LetterSignerInput & { id: number }>('SELECT * FROM letter_signers WHERE letterId = ? ORDER BY level ASC', [
        row.id,
      ]),
    };
  }

  private summary(row: LetterRow) {
    return {
      id: row.id,
      letterNumber: row.letterNumber,
      templateId: row.templateId,
      templateVersion: row.templateVersion,
      templateName: row.templateName,
      category: row.category,
      subject: row.subject,
      recipient: row.recipient,
      patientId: row.patientId,
      patientSnapshot: parseJson<Record<string, unknown> | null>(row.patientSnapshot, null),
      status: row.status,
      letterDate: row.letterDate,
      createdBy: row.createdBy,
      createdByName: row.createdByName,
      updatedByName: row.updatedByName,
      issuedAt: row.issuedAt,
      issuedByName: row.issuedByName,
      cancelledAt: row.cancelledAt,
      cancelledByName: row.cancelledByName,
      cancelReason: row.cancelReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private row(id: number): LetterRow {
    const row = this.db.get<LetterRow>('SELECT * FROM letters WHERE id = ?', [id]);
    if (!row) throw new NotFoundException('Surat tidak ditemukan.');
    return row;
  }

  get(id: number) {
    return this.present(this.row(id), true);
  }

  list(q: LetterQuery, user: AuthUser) {
    const where: string[] = [];
    const params: SqliteParam[] = [];
    if (q.q?.trim()) {
      const like = `%${q.q.trim()}%`;
      where.push('(letterNumber LIKE ? OR subject LIKE ? OR recipient LIKE ? OR templateName LIKE ? OR patientSnapshot LIKE ?)');
      params.push(like, like, like, like, like);
    }
    if (q.status && ['draft', 'terbit', 'batal'].includes(q.status)) {
      where.push('status = ?');
      params.push(q.status);
    }
    if (q.category && isCategory(q.category)) {
      where.push('category = ?');
      params.push(q.category);
    }
    if (q.templateId && Number(q.templateId) > 0) {
      where.push('templateId = ?');
      params.push(Number(q.templateId));
    }
    if (q.patientId && Number(q.patientId) > 0) {
      where.push('patientId = ?');
      params.push(Number(q.patientId));
    }
    if (q.from && DATE_RE.test(q.from)) {
      where.push('letterDate >= ?');
      params.push(q.from);
    }
    if (q.to && DATE_RE.test(q.to)) {
      where.push('letterDate <= ?');
      params.push(q.to);
    }
    if (q.mine === '1') {
      where.push('createdBy = ?');
      params.push(user.id);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const page = Math.max(Number(q.page) || 1, 1);
    const total = this.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM letters ${whereSql}`, params)?.n ?? 0;
    const rows = this.db.query<LetterRow>(
      `SELECT * FROM letters ${whereSql} ORDER BY letterDate DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    return { total, page, limit, data: rows.map((r) => this.present(r, false)) };
  }

  stats(user: AuthUser) {
    const month = new Date().toISOString().slice(0, 7);
    const count = (sql: string, params: SqliteParam[] = []) => this.db.get<{ n: number }>(sql, params)?.n ?? 0;
    return {
      total: count('SELECT COUNT(*) AS n FROM letters'),
      draft: count("SELECT COUNT(*) AS n FROM letters WHERE status = 'draft'"),
      myDraft: count("SELECT COUNT(*) AS n FROM letters WHERE status = 'draft' AND createdBy = ?", [user.id]),
      issuedThisMonth: count("SELECT COUNT(*) AS n FROM letters WHERE status = 'terbit' AND substr(letterDate, 1, 7) = ?", [month]),
      keluar: count("SELECT COUNT(*) AS n FROM letters WHERE category = 'keluar' AND status != 'batal'"),
      internal: count("SELECT COUNT(*) AS n FROM letters WHERE category = 'internal' AND status != 'batal'"),
      formulir: count("SELECT COUNT(*) AS n FROM letters WHERE category = 'formulir' AND status != 'batal'"),
      templates: count('SELECT COUNT(*) AS n FROM templates WHERE isActive = 1'),
      topTemplates: this.db.query(
        `SELECT templateId, templateName, COUNT(*) AS n FROM letters WHERE status != 'batal' AND templateId IS NOT NULL
         GROUP BY templateId ORDER BY n DESC LIMIT 6`
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Draft
  // ---------------------------------------------------------------------------

  private cleanSigners(list: unknown): LetterSignerInput[] {
    if (!Array.isArray(list)) return [];
    return list.slice(0, 6).map((s, i) => ({
      level: i + 1,
      role: String(s?.role ?? '').slice(0, 150),
      name: String(s?.name ?? '').slice(0, 150),
      idLabel: String(s?.idLabel ?? '').slice(0, 20),
      idNumber: String(s?.idNumber ?? '').slice(0, 60),
      signerId: Number(s?.signerId) > 0 ? Number(s.signerId) : null,
    }));
  }

  private saveSigners(letterId: number, signers: LetterSignerInput[]) {
    this.db.run('DELETE FROM letter_signers WHERE letterId = ?', [letterId]);
    for (const s of signers) {
      this.db.run(
        'INSERT INTO letter_signers (letterId, level, role, name, idLabel, idNumber, signerId) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [letterId, s.level, s.role, s.name, s.idLabel, s.idNumber, s.signerId]
      );
    }
  }

  private cleanDate(raw: unknown): string {
    const date = String(raw || '').slice(0, 10);
    if (!DATE_RE.test(date)) throw new BadRequestException('Tanggal surat tidak valid (format YYYY-MM-DD).');
    return date;
  }

  create(body: LetterBody, user: AuthUser) {
    const templateId = Number(body?.templateId);
    if (!templateId) throw new BadRequestException('Template surat wajib dipilih.');
    const template = this.templates.get(templateId);
    if (!template.isActive) throw new BadRequestException('Template ini sedang dinonaktifkan.');

    // Surat keluar dan formulir boleh menyimpan pasien; surat internal tidak.
    const withPatient = usesPatient(template.category);
    const patientId = withPatient && Number(body.patientId) > 0 ? Number(body.patientId) : null;
    const name = displayName(user);

    const id = this.db.transaction(() => {
      const result = this.db.run(
        `INSERT INTO letters (numberCode, numberPattern, templateId, templateVersion, templateName, category, subject, recipient,
           patientId, patientSnapshot, payload, contentHtml, status, letterDate, createdBy, createdByName, updatedByName)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        [
          template.numbering.code || template.code,
          template.numbering.pattern || null,
          template.id,
          template.version,
          template.name,
          template.category,
          String(body.subject ?? '').trim().slice(0, 300) || template.name,
          String(body.recipient ?? '').trim().slice(0, 300) || null,
          patientId,
          // Surat internal tidak pernah menyimpan data pasien.
          patientId && body.patientSnapshot ? JSON.stringify(body.patientSnapshot) : null,
          JSON.stringify(body.payload && typeof body.payload === 'object' ? body.payload : {}),
          sanitizeLetterHtml(body.contentHtml),
          this.cleanDate(body.letterDate),
          user.id,
          name,
          name,
        ]
      );
      const newId = Number(result.lastInsertRowid);
      this.saveSigners(newId, this.cleanSigners(body.signers));
      return newId;
    });
    return this.get(id);
  }

  update(id: number, body: LetterBody, user: AuthUser) {
    const row = this.row(id);
    if (row.status !== 'draft') {
      throw new BadRequestException('Surat yang sudah terbit atau dibatalkan tidak bisa diubah. Duplikat surat untuk membuat versi baru.');
    }
    const withPatient = usesPatient(row.category);
    const patientId = withPatient && Number(body.patientId) > 0 ? Number(body.patientId) : null;
    this.db.transaction(() => {
      this.db.run(
        `UPDATE letters SET subject = ?, recipient = ?, patientId = ?, patientSnapshot = ?, payload = ?, contentHtml = ?,
           letterDate = ?, updatedByName = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        [
          String(body.subject ?? row.subject ?? '').trim().slice(0, 300) || row.templateName,
          String(body.recipient ?? row.recipient ?? '').trim().slice(0, 300) || null,
          patientId,
          patientId && body.patientSnapshot ? JSON.stringify(body.patientSnapshot) : null,
          JSON.stringify(body.payload && typeof body.payload === 'object' ? body.payload : parseJson(row.payload, {})),
          body.contentHtml !== undefined ? sanitizeLetterHtml(body.contentHtml) : row.contentHtml,
          body.letterDate ? this.cleanDate(body.letterDate) : row.letterDate,
          displayName(user),
          id,
        ]
      );
      if (Array.isArray(body.signers)) this.saveSigners(id, this.cleanSigners(body.signers));
    });
    return this.get(id);
  }

  remove(id: number, user: AuthUser) {
    const row = this.row(id);
    // Surat yang sudah dibatalkan boleh dihapus Superadmin (mis. surat uji
    // coba). Surat terbit harus dibatalkan dulu, jadi tidak ada surat sah
    // yang hilang tanpa jejak. Penghitung nomor tidak dimundurkan, sehingga
    // nomor surat yang dihapus tidak pernah dipakai ulang.
    if (row.status === 'batal') {
      if (!user.isSuperadmin) throw new ForbiddenException('Surat yang sudah dibatalkan hanya bisa dihapus oleh Superadmin.');
      this.db.run('DELETE FROM letters WHERE id = ?', [id]);
      return { message: `Surat ${row.letterNumber ?? ''} dihapus permanen. Nomornya tidak akan dipakai ulang.`.replace('  ', ' ') };
    }
    if (row.status !== 'draft') {
      throw new BadRequestException('Surat terbit tidak bisa dihapus. Batalkan dulu; setelah itu Superadmin bisa menghapusnya.');
    }
    const isOwner = row.createdBy === user.id;
    if (!isOwner && !user.isSuperadmin && !user.permissions.includes('surat.hapus')) {
      throw new ForbiddenException('Draft milik orang lain hanya bisa dihapus oleh pengguna dengan izin "Hapus draft surat milik orang lain".');
    }
    this.db.run('DELETE FROM letters WHERE id = ?', [id]);
    return { message: 'Draft surat dihapus.' };
  }

  duplicate(id: number, user: AuthUser) {
    const src = this.get(id);
    if (!src.templateId) throw new BadRequestException('Template asal surat ini sudah dihapus, jadi tidak bisa diduplikat.');
    const today = new Date();
    const letterDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    // Nomor lama tidak ikut: isi penanda nomor dikosongkan lagi.
    const contentHtml = fillVariable(src.contentHtml, 'nomor_surat', '');
    const template = this.templates.get(src.templateId);
    const name = displayName(user);
    const newId = this.db.transaction(() => {
      const result = this.db.run(
        `INSERT INTO letters (numberCode, numberPattern, templateId, templateVersion, templateName, category, subject, recipient,
           patientId, patientSnapshot, payload, contentHtml, status, letterDate, createdBy, createdByName, updatedByName)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        [
          template.numbering.code || template.code,
          template.numbering.pattern || null,
          src.templateId,
          src.templateVersion,
          src.templateName,
          src.category,
          src.subject,
          src.recipient,
          src.patientId,
          src.patientSnapshot ? JSON.stringify(src.patientSnapshot) : null,
          JSON.stringify(src.payload),
          contentHtml,
          letterDate,
          user.id,
          name,
          name,
        ]
      );
      const id2 = Number(result.lastInsertRowid);
      this.saveSigners(id2, this.cleanSigners(src.signers));
      return id2;
    });
    return this.get(newId);
  }

  // ---------------------------------------------------------------------------
  // Nomor surat
  // ---------------------------------------------------------------------------

  private numberParts(row: Pick<LetterRow, 'numberCode' | 'numberPattern' | 'templateId'>) {
    const s = this.settings.all();
    let code = row.numberCode;
    let pattern = row.numberPattern;
    if ((!code || !pattern) && row.templateId) {
      try {
        const t = this.templates.get(row.templateId);
        code = code || t.numbering.code || t.code;
        pattern = pattern || t.numbering.pattern;
      } catch {
        // Template sudah dihapus: pakai pola umum.
      }
    }
    return {
      code: code || 'SRT',
      pattern: pattern || s.pola_nomor,
      agency: s.kode_instansi,
      digits: Number(s.digit_nomor) || 3,
    };
  }

  /** Perkiraan nomor berikutnya, hanya untuk ditampilkan (belum diambil). */
  preview(templateId: number, date: string) {
    const template = this.templates.get(templateId);
    const d = DATE_RE.test(date) ? date : new Date().toISOString().slice(0, 10);
    const parts = this.numberParts({ numberCode: template.numbering.code, numberPattern: template.numbering.pattern, templateId });
    const last = this.db.get<{ lastSeq: number }>('SELECT lastSeq FROM letter_numbering WHERE code = ? AND year = ?', [
      parts.code,
      yearOf(d),
    ])?.lastSeq;
    return { number: formatLetterNumber(parts.pattern, { ...parts, seq: (last ?? 0) + 1, date: d }), code: parts.code };
  }

  /**
   * Menerbitkan surat: mengambil nomor urut berikutnya (per kode, per tahun),
   * mengisi penanda {{nomor_surat}}, dan mengunci isi surat. Semua dalam satu
   * transaksi, sehingga dua staf yang menerbitkan bersamaan tidak mendapat
   * nomor yang sama.
   */
  issue(id: number, body: { contentHtml?: string }, user: AuthUser) {
    const row = this.row(id);
    if (row.status !== 'draft') throw new BadRequestException('Surat ini sudah terbit atau dibatalkan.');
    if (row.category === 'keluar' && !row.patientId) {
      throw new BadRequestException('Surat keluar wajib memilih pasien sebelum diterbitkan.');
    }

    const parts = this.numberParts(row);
    const year = yearOf(row.letterDate);
    let content = body?.contentHtml !== undefined ? sanitizeLetterHtml(body.contentHtml) : row.contentHtml;
    if (!content.trim()) throw new BadRequestException('Isi surat masih kosong.');

    const number = this.db.transaction(() => {
      this.db.run('INSERT OR IGNORE INTO letter_numbering (code, year, lastSeq) VALUES (?, ?, 0)', [parts.code, year]);
      let seq = (this.db.get<{ lastSeq: number }>('SELECT lastSeq FROM letter_numbering WHERE code = ? AND year = ?', [parts.code, year])
        ?.lastSeq ?? 0) + 1;
      let formatted = formatLetterNumber(parts.pattern, { ...parts, seq, date: row.letterDate });
      // Lewati nomor yang sudah dipakai (mis. pola diubah atau penghitung diatur mundur).
      while (this.db.get('SELECT id FROM letters WHERE letterNumber = ?', [formatted])) {
        seq += 1;
        formatted = formatLetterNumber(parts.pattern, { ...parts, seq, date: row.letterDate });
      }
      this.db.run('UPDATE letter_numbering SET lastSeq = ? WHERE code = ? AND year = ?', [seq, parts.code, year]);

      content = fillVariable(content, 'nomor_surat', formatted);
      const payload = { ...parseJson<Record<string, unknown>>(row.payload, {}), nomor_surat: formatted };
      this.db.run(
        `UPDATE letters SET letterNumber = ?, numberCode = ?, numberPattern = ?, numberYear = ?, numberSeq = ?, contentHtml = ?,
           payload = ?, status = 'terbit', issuedAt = CURRENT_TIMESTAMP, issuedByName = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [formatted, parts.code, parts.pattern, year, seq, content, JSON.stringify(payload), displayName(user), id]
      );
      return formatted;
    });
    return { ...this.get(id), message: `Surat diterbitkan dengan nomor ${number}.` };
  }

  cancel(id: number, body: { reason?: string }, user: AuthUser) {
    const row = this.row(id);
    if (row.status !== 'terbit') throw new BadRequestException('Hanya surat yang sudah terbit yang bisa dibatalkan.');
    const reason = String(body?.reason ?? '').trim();
    if (!reason) throw new BadRequestException('Alasan pembatalan wajib diisi.');
    // Nomor tetap melekat pada surat batal, sehingga tidak dipakai ulang.
    this.db.run(
      `UPDATE letters SET status = 'batal', cancelledAt = CURRENT_TIMESTAMP, cancelledByName = ?, cancelReason = ?,
         updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [displayName(user), reason.slice(0, 500), id]
    );
    return this.get(id);
  }
}
