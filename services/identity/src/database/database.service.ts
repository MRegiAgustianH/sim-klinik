import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';
import { DATA_DIR } from '../config/paths';

export type SqliteParam = string | number | bigint | null | Buffer;

// Kode aplikasi dipakai di app_registry dan app_access. 'portal' bukan app di
// app_registry — ia tujuan login dashboard, dan tetap dicatat di app_access
// supaya akses ke portal diatur dengan cara yang sama seperti app lain.
export const APP_CODES = ['portal', 'simklinik', 'surat', 'laporan'] as const;
export type AppCode = (typeof APP_CODES)[number];

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: DatabaseSync;
  private devMode = false;
  private dbPath = '';

  onModuleInit() {
    const dataDir = DATA_DIR;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Pola yang sama dengan backend SIMKlinik: keberadaan .env.local menandai
    // mode pengembangan, sehingga uji coba tidak menyentuh database production.
    this.devMode = fs.existsSync(path.join(process.cwd(), '.env.local'));
    const dbFileName = this.devMode ? 'identity-dev.sqlite' : 'identity.sqlite';
    this.dbPath = path.join(dataDir, dbFileName);
    this.logger.log(`Inisialisasi SQLite database pada: ${this.dbPath}`);
    this.db = new DatabaseSync(this.dbPath);

    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');

    this.runMigrations();
    this.seedInitialData();
  }

  // Dipakai skrip agar bisa mencetak database mana yang sedang dipakai.
  // Tanpa ini, impor yang menulis ke database dev tidak bisa dibedakan dari
  // impor yang menulis ke database production — keduanya melaporkan sukses.
  getInfo() {
    return { path: this.dbPath, mode: this.devMode ? ('development' as const) : ('production' as const) };
  }

  onModuleDestroy() {
    if (this.db) {
      this.db.close();
      this.logger.log('Koneksi SQLite database ditutup.');
    }
  }

  getDb(): DatabaseSync {
    return this.db;
  }

  query<T = Record<string, unknown>>(sql: string, params: SqliteParam[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as unknown as T[];
  }

  get<T = Record<string, unknown>>(sql: string, params: SqliteParam[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as unknown as T | undefined;
  }

  run(sql: string, params: SqliteParam[] = []): { changes: number | bigint; lastInsertRowid: number | bigint } {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  private runMigrations() {
    this.logger.log('Menjalankan migrasi tabel database...');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullName TEXT NOT NULL,
        role TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Satu pasien = satu baris. NIK tidak dibuat UNIQUE oleh constraint tabel
    // karena NIK kosong boleh berulang; keunikannya dijaga indeks parsial di bawah.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nik TEXT,
        fullName TEXT NOT NULL,
        gender TEXT NOT NULL,
        birthPlace TEXT,
        birthDate TEXT,
        email TEXT,
        address TEXT,
        phoneWa TEXT,
        occupation TEXT,
        maritalStatus TEXT,
        bloodType TEXT,
        allergy TEXT,
        sourceApp TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indeks parsial: NIK dianggap unik hanya bila terisi dan panjangnya 16 digit.
    // Dengan begitu NIK kosong atau belum lengkap tidak pernah memblokir penyimpanan,
    // sementara NIK yang sah tetap tidak bisa ganda.
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_nik_unique
      ON patients(nik) WHERE nik IS NOT NULL AND length(trim(nik)) = 16;
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(fullName);
      CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phoneWa);
    `);

    // Layanan yang boleh memakai /api/auth/verify. Portal bisa memverifikasi
    // token untuk app mana pun; app lain hanya untuk dirinya sendiri.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS service_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        keyHash TEXT NOT NULL,
        canVerifyAll INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        lastUsedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        frontendUrl TEXT,
        backendUrl TEXT,
        icon TEXT,
        sortOrder INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        appCode TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(userId, appCode)
      );
    `);

    // Hak akses fitur per aplikasi. Katalog (app_permissions dan presetnya)
    // didaftarkan oleh aplikasi itu sendiri saat start, karena aplikasilah yang
    // tahu fitur apa saja yang ia punya. Superadmin mencentang fitur per orang
    // di portal; hasilnya disimpan di user_permissions.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_permissions (
        appCode TEXT NOT NULL,
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        groupName TEXT,
        description TEXT,
        sortOrder INTEGER DEFAULT 0,
        PRIMARY KEY (appCode, code)
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_permission_presets (
        appCode TEXT NOT NULL,
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        permissions TEXT NOT NULL,
        sortOrder INTEGER DEFAULT 0,
        PRIMARY KEY (appCode, code)
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        appCode TEXT NOT NULL,
        permission TEXT NOT NULL,
        PRIMARY KEY (userId, appCode, permission)
      );
    `);
  }

  private seedInitialData() {
    const usersCount = this.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if (!usersCount || usersCount.count === 0) {
      this.logger.log('Melakukan seeding akun pengguna awal...');
      const salt = bcrypt.genSaltSync(10);
      const seedUsers: Array<[string, string, string, string]> = [
        ['superadmin', 'admin123', 'Superadministrator Klinik', 'Superadmin'],
        ['dokter', 'dokter123', 'dr. H. Rahmat Hidayat, Sp.A', 'Dokter'],
        ['perawat', 'perawat123', 'Ns. Siti Nurhaliza, S.Kep', 'Perawat'],
        ['admin', 'admin123', 'Administrasi Klinik', 'Administrasi'],
      ];
      for (const [username, password, fullName, role] of seedUsers) {
        this.run('INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)', [
          username,
          bcrypt.hashSync(password, salt),
          fullName,
          role,
        ]);
      }
      this.logger.log('Seeding pengguna berhasil.');
    }

    const appsCount = this.get<{ count: number }>('SELECT COUNT(*) as count FROM app_registry');
    if (!appsCount || appsCount.count === 0) {
      const devSuffix = this.devMode ? ' (DEV)' : '';
      const seedApps: Array<[string, string, string, string, string, number]> = [
        [
          'simklinik',
          'SIMKlinik',
          'Vaksinasi internasional, buku ICV, MCU, dan stok vaksin',
          this.devMode ? 'http://localhost:8081' : 'http://localhost:8080',
          this.devMode ? 'http://localhost:4001' : 'http://localhost:4000',
          1,
        ],
        [
          'surat',
          `Sistem Surat${devSuffix}`,
          'Template surat, surat keluar bermuatan pasien, dan surat internal',
          this.devMode ? 'http://localhost:8085' : 'http://localhost:8083',
          this.devMode ? 'http://localhost:4003' : 'http://localhost:4002',
          2,
        ],
      ];
      for (const [code, name, description, frontendUrl, backendUrl, sortOrder] of seedApps) {
        this.run(
          `INSERT INTO app_registry (code, name, description, frontendUrl, backendUrl, sortOrder)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [code, name, description, frontendUrl, backendUrl, sortOrder]
        );
      }
      this.logger.log('Seeding daftar aplikasi berhasil.');
    }

    // Akun staf yang sudah ada saat portal pertama kali diberlakukan
    // otomatis diberi akses ke portal agar tidak terkunci di luar dashboard.
    this.db.exec(`
      INSERT OR IGNORE INTO app_access (userId, appCode)
      SELECT id, 'portal' FROM users WHERE isActive = 1;
    `);

    // Superadmin otomatis punya akses ke seluruh aplikasi yang terdaftar.
    this.db.exec(`
      INSERT OR IGNORE INTO app_access (userId, appCode)
      SELECT u.id, a.code FROM users u CROSS JOIN app_registry a
      WHERE u.role = 'Superadmin';
    `);
  }
}
