import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR, FORM_KOP_IMAGE_PATH, HEADER_IMAGE_PATH, IS_DEV, UPLOADS_DIR } from '../config/paths';
import { DEFAULT_SETTINGS, SEED_LETTERHEADS, SEED_SIGNERS, SEED_TEMPLATES, SeedTemplate } from './seed';
import { FORM_KOP_IMAGE, LATER_SEEDS, SEED_UPGRADES } from './seed-formulir';
import { CATEGORY_CHECK } from '../common/category';

export type SqliteParam = string | number | bigint | null | Buffer;

// Gambar kop bawaan disalin ke folder unggahan dengan nama tetap, sehingga kop
// awal bisa menunjuk /api/uploads/kop-klinik.jpeg tanpa menyimpan base64 di
// setiap surat.
export const DEFAULT_KOP_IMAGE = 'kop-klinik.jpeg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: DatabaseSync;

  onModuleInit() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const dbPath = path.join(DATA_DIR, IS_DEV ? 'surat-dev.sqlite' : 'surat.sqlite');
    this.logger.log(`Inisialisasi SQLite database pada: ${dbPath}`);
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');

    this.runMigrations();
    this.widenCategoryCheck();
    this.seed();
  }

  onModuleDestroy() {
    this.db?.close();
  }

  query<T = Record<string, unknown>>(sql: string, params: SqliteParam[] = []): T[] {
    return this.db.prepare(sql).all(...params) as unknown as T[];
  }

  get<T = Record<string, unknown>>(sql: string, params: SqliteParam[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as unknown as T | undefined;
  }

  run(sql: string, params: SqliteParam[] = []) {
    return this.db.prepare(sql).run(...params);
  }

  /** Menjalankan fn dalam satu transaksi; dipakai saat mengambil nomor surat. */
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  // Migrasi idempoten: berjalan setiap start dan tidak merusak data lama.
  private runMigrations() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS letterheads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        html TEXT NOT NULL DEFAULT '',
        isDefault INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS signers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        idLabel TEXT,
        idNumber TEXT,
        isActive INTEGER NOT NULL DEFAULT 1,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Template disimpan sebagai dokumen bertoken ({{variabel}}), bukan kode.
      -- Kolom JSON: signature, page, numbering, variables.
      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (${CATEGORY_CHECK}),
        description TEXT,
        letterheadMode TEXT NOT NULL DEFAULT 'default',
        letterheadId INTEGER REFERENCES letterheads(id) ON DELETE SET NULL,
        customHeaderHtml TEXT NOT NULL DEFAULT '',
        bodyHtml TEXT NOT NULL DEFAULT '',
        closingHtml TEXT NOT NULL DEFAULT '',
        signature TEXT NOT NULL DEFAULT '{}',
        page TEXT NOT NULL DEFAULT '{}',
        numbering TEXT NOT NULL DEFAULT '{}',
        variables TEXT NOT NULL DEFAULT '[]',
        isActive INTEGER NOT NULL DEFAULT 1,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        createdBy TEXT,
        updatedBy TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Riwayat versi template. Surat lama tetap memakai salinan isinya sendiri
      -- (letters.contentHtml); tabel ini untuk menelusuri dan memulihkan versi.
      CREATE TABLE IF NOT EXISTS template_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        templateId INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        snapshot TEXT NOT NULL,
        createdBy TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (templateId, version)
      );

      -- patientId hanya diisi untuk surat keluar; surat internal tidak pernah
      -- menyentuh data pasien. patientSnapshot menyimpan nama/NIK saat surat
      -- dibuat agar arsip tetap utuh bila data pasien berubah.
      CREATE TABLE IF NOT EXISTS letters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        letterNumber TEXT UNIQUE,
        numberCode TEXT,
        numberPattern TEXT,
        numberYear INTEGER,
        numberSeq INTEGER,
        templateId INTEGER REFERENCES templates(id) ON DELETE SET NULL,
        templateVersion INTEGER,
        templateName TEXT,
        category TEXT NOT NULL CHECK (${CATEGORY_CHECK}),
        subject TEXT,
        recipient TEXT,
        patientId INTEGER,
        patientSnapshot TEXT,
        payload TEXT NOT NULL DEFAULT '{}',
        contentHtml TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'terbit', 'batal')),
        letterDate TEXT NOT NULL,
        createdBy INTEGER,
        createdByName TEXT,
        updatedByName TEXT,
        issuedAt DATETIME,
        issuedByName TEXT,
        cancelledAt DATETIME,
        cancelledByName TEXT,
        cancelReason TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_letters_status ON letters(status);
      CREATE INDEX IF NOT EXISTS idx_letters_date ON letters(letterDate);
      CREATE INDEX IF NOT EXISTS idx_letters_template ON letters(templateId);
      CREATE INDEX IF NOT EXISTS idx_letters_patient ON letters(patientId);

      -- 0..n penandatangan per surat, berurutan lewat level.
      CREATE TABLE IF NOT EXISTS letter_signers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        letterId INTEGER NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
        level INTEGER NOT NULL,
        role TEXT,
        name TEXT,
        idLabel TEXT,
        idNumber TEXT,
        signerId INTEGER
      );

      -- Urutan nomor surat terpisah per kode dan per tahun.
      CREATE TABLE IF NOT EXISTS letter_numbering (
        code TEXT NOT NULL,
        year INTEGER NOT NULL,
        lastSeq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (code, year)
      );
    `);
  }

  /**
   * Database lama dibuat dengan CHECK (category IN ('keluar', 'internal')).
   * SQLite tidak bisa mengubah CHECK, jadi tabelnya dibangun ulang dengan isi
   * yang sama (prosedur resmi SQLite: buat tabel baru, salin, hapus, ganti
   * nama). Hanya berjalan sekali, saat CHECK lama masih terpasang.
   */
  private widenCategoryCheck() {
    const stale = ['templates', 'letters'].filter((table) => {
      const sql = this.get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", [table])?.sql ?? '';
      return !sql.includes("'formulir'");
    });
    if (!stale.length) return;

    this.db.exec('PRAGMA foreign_keys = OFF;');
    try {
      this.transaction(() => {
        for (const table of stale) {
          const sql = this.get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", [table])!.sql;
          const next = sql
            .replace(/CHECK\s*\(\s*category\s+IN\s*\([^)]*\)\s*\)/, `CHECK (${CATEGORY_CHECK})`)
            .replace(/^CREATE TABLE\s+(IF NOT EXISTS\s+)?["`]?\w+["`]?/, `CREATE TABLE ${table}__baru`);
          if (!next.includes("'formulir'") || !next.includes(`${table}__baru`)) {
            throw new Error(`Skema tabel ${table} tidak dikenali; migrasi jenis formulir dibatalkan.`);
          }
          this.db.exec(next);
          this.db.exec(`INSERT INTO ${table}__baru SELECT * FROM ${table}`);
          this.db.exec(`DROP TABLE ${table}`);
          this.db.exec(`ALTER TABLE ${table}__baru RENAME TO ${table}`);
        }
        const broken = this.query('PRAGMA foreign_key_check');
        if (broken.length) throw new Error(`Migrasi jenis formulir: ${broken.length} relasi rusak, dibatalkan.`);
      });
    } finally {
      this.db.exec('PRAGMA foreign_keys = ON;');
    }
    // Indeks ikut terhapus bersama tabel lama; buat ulang.
    this.runMigrations();
    this.logger.log(`Migrasi: tabel ${stale.join(', ')} kini menerima jenis "formulir".`);
  }

  private insertSeedTemplate(t: SeedTemplate, sortOrder: number) {
    const result = this.run(
      `INSERT INTO templates (code, name, category, description, letterheadMode, bodyHtml, closingHtml,
         signature, page, numbering, variables, sortOrder, createdBy, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sistem', 'sistem')`,
      [
        t.code,
        t.name,
        t.category,
        t.description,
        t.letterheadMode ?? 'default',
        t.bodyHtml,
        t.closingHtml ?? '',
        JSON.stringify(t.signature),
        JSON.stringify(t.page ?? {}),
        JSON.stringify({ code: t.code, pattern: '' }),
        JSON.stringify(t.variables),
        sortOrder,
      ]
    );
    const id = Number(result.lastInsertRowid);
    const row = this.get('SELECT * FROM templates WHERE id = ?', [id]);
    this.run('INSERT INTO template_versions (templateId, version, snapshot, createdBy) VALUES (?, 1, ?, ?)', [id, JSON.stringify(row), 'sistem']);
  }

  private seed() {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      this.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }

    const kopTarget = path.join(UPLOADS_DIR, DEFAULT_KOP_IMAGE);
    if (!fs.existsSync(kopTarget) && fs.existsSync(HEADER_IMAGE_PATH)) {
      fs.copyFileSync(HEADER_IMAGE_PATH, kopTarget);
    }
    const formKopTarget = path.join(UPLOADS_DIR, FORM_KOP_IMAGE);
    if (!fs.existsSync(formKopTarget) && fs.existsSync(FORM_KOP_IMAGE_PATH)) {
      fs.copyFileSync(FORM_KOP_IMAGE_PATH, formKopTarget);
    }

    if (this.count('letterheads') === 0) {
      for (const kop of SEED_LETTERHEADS) {
        this.run('INSERT INTO letterheads (name, html, isDefault) VALUES (?, ?, ?)', [kop.name, kop.html, kop.isDefault ? 1 : 0]);
      }
      this.logger.log(`Seeding ${SEED_LETTERHEADS.length} kop surat awal.`);
    }

    if (this.count('signers') === 0) {
      SEED_SIGNERS.forEach((s, i) => {
        this.run('INSERT INTO signers (name, position, idLabel, idNumber, sortOrder) VALUES (?, ?, ?, ?, ?)', [
          s.name,
          s.position,
          s.idLabel,
          s.idNumber,
          i,
        ]);
      });
    }

    // Template bawaan hanya dibuat saat tabel masih kosong, sehingga template
    // yang sudah diubah atau dihapus Superadmin tidak muncul kembali.
    if (this.count('templates') === 0) {
      SEED_TEMPLATES.forEach((t, i) => this.insertSeedTemplate(t, i));
      this.logger.log(`Seeding ${SEED_TEMPLATES.length} template surat awal.`);
      // Database baru sudah memuat semua template; tandai tambahan susulan.
      for (const later of LATER_SEEDS) this.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [later.marker, '1']);
    }

    // Template yang ditambahkan setelah database terisi: dibuat sekali saja.
    for (const later of LATER_SEEDS) {
      if (this.get('SELECT 1 FROM settings WHERE key = ?', [later.marker])) continue;
      const maxOrder = this.get<{ n: number }>('SELECT COALESCE(MAX(sortOrder), 0) AS n FROM templates')?.n ?? 0;
      let added = 0;
      for (const code of later.codes) {
        const t = SEED_TEMPLATES.find((x) => x.code === code);
        if (!t || this.get('SELECT 1 FROM templates WHERE code = ?', [code])) continue;
        this.insertSeedTemplate(t, maxOrder + 1 + added);
        added++;
      }
      this.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [later.marker, '1']);
      if (added) this.logger.log(`Menambahkan ${added} template baru (${later.codes.join(', ')}).`);
    }

    for (const upgrade of SEED_UPGRADES) {
      if (this.get('SELECT 1 FROM settings WHERE key = ?', [upgrade.marker])) continue;
      for (const code of upgrade.codes) this.upgradeSeedTemplate(code);
      this.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [upgrade.marker, '1']);
    }
  }

  // Memperbarui template bawaan ke isi terbaru di kode, hanya bila belum
  // pernah disunting siapa pun. Versi dinaikkan dan disimpan di riwayat,
  // sehingga isi lama tetap bisa dipulihkan dari halaman template.
  private upgradeSeedTemplate(code: string) {
    const seed = SEED_TEMPLATES.find((t) => t.code === code);
    const row = this.get<{ id: number; version: number; updatedBy: string | null; bodyHtml: string; page: string }>(
      'SELECT id, version, updatedBy, bodyHtml, page FROM templates WHERE code = ?',
      [code]
    );
    if (!seed || !row) return;
    if (row.version !== 1 || row.updatedBy !== 'sistem') {
      this.logger.log(`Template ${code} sudah disunting; pembaruan tata letak bawaan dilewati.`);
      return;
    }
    const page = JSON.stringify(seed.page ?? {});
    if (row.bodyHtml === seed.bodyHtml && row.page === page) return;

    this.run(
      `UPDATE templates SET description = ?, bodyHtml = ?, page = ?, variables = ?, version = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [seed.description, seed.bodyHtml, page, JSON.stringify(seed.variables), row.version + 1, row.id]
    );
    const updated = this.get('SELECT * FROM templates WHERE id = ?', [row.id]);
    this.run('INSERT OR REPLACE INTO template_versions (templateId, version, snapshot, createdBy) VALUES (?, ?, ?, ?)', [
      row.id,
      row.version + 1,
      JSON.stringify(updated),
      'sistem',
    ]);
    this.logger.log(`Template ${code} diperbarui ke tata letak terbaru (versi ${row.version + 1}).`);
  }

  private count(table: string): number {
    return this.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0;
  }
}
