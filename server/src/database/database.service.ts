import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';

export type SqliteParam = string | number | bigint | null | Buffer;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: DatabaseSync;

  onModuleInit() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'vaksinku.sqlite');
    this.logger.log(`Inisialisasi SQLite database pada: ${dbPath}`);
    this.db = new DatabaseSync(dbPath);

    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');

    this.runMigrations();
    this.seedInitialData();
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
        role TEXT NOT NULL CHECK(role IN ('Superadmin', 'Dokter', 'Perawat')),
        isActive INTEGER DEFAULT 1,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vaccination_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nik TEXT NOT NULL,
        fullName TEXT NOT NULL,
        gender TEXT NOT NULL CHECK(gender IN ('Laki-laki', 'Perempuan')),
        birthPlace TEXT NOT NULL,
        birthDate TEXT NOT NULL,
        email TEXT,
        address TEXT NOT NULL,
        phoneWa TEXT NOT NULL,
        occupation TEXT,
        maritalStatus TEXT CHECK(maritalStatus IN ('Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati')),
        vaccineType TEXT NOT NULL,
        plannedDate TEXT NOT NULL,
        plannedTime TEXT NOT NULL,
        doctorApproval TEXT DEFAULT 'Menunggu Persetujuan' CHECK(doctorApproval IN ('Disetujui', 'Ditolak', 'Menunggu Persetujuan')),
        doctorNotes TEXT,
        status TEXT DEFAULT 'Belum' CHECK(status IN ('Selesai', 'Belum')),
        doctorName TEXT,
        nurseName TEXT,
        adminName TEXT,
        notes TEXT,
        infoSource TEXT,
        icvNumber TEXT,
        monthYear TEXT NOT NULL,
        pregnancyTestResult TEXT DEFAULT 'Tidak Dilakukan' CHECK(pregnancyTestResult IN ('Negatif', 'Positif', 'Tidak Dilakukan')),
        batchNumber TEXT,
        vaccinatedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_records_nik ON vaccination_records(nik);
      CREATE INDEX IF NOT EXISTS idx_records_plannedDate ON vaccination_records(plannedDate);
      CREATE INDEX IF NOT EXISTS idx_records_monthYear ON vaccination_records(monthYear);
      CREATE INDEX IF NOT EXISTS idx_records_status ON vaccination_records(status);
      CREATE INDEX IF NOT EXISTS idx_records_vaccineType ON vaccination_records(vaccineType);
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vaccine_stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vaccineName TEXT NOT NULL,
        manufacturer TEXT,
        batchNumber TEXT NOT NULL UNIQUE,
        initialStock INTEGER DEFAULT 0,
        currentStock INTEGER DEFAULT 0,
        unit TEXT DEFAULT 'Dosis',
        expiryDate TEXT NOT NULL,
        minStockAlert INTEGER DEFAULT 10,
        status TEXT DEFAULT 'Tersedia' CHECK(status IN ('Tersedia', 'Menipis', 'Habis', 'Kadaluarsa')),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS icv_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batchCode TEXT NOT NULL,
        startSerial TEXT NOT NULL,
        endSerial TEXT NOT NULL,
        totalStock INTEGER NOT NULL,
        usedStock INTEGER DEFAULT 0,
        remainingStock INTEGER NOT NULL,
        receivedDate TEXT NOT NULL,
        officerName TEXT NOT NULL,
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS stock_mutations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        itemType TEXT NOT NULL CHECK(itemType IN ('VACCINE', 'ICV')),
        itemId INTEGER,
        itemName TEXT NOT NULL,
        batchOrSerial TEXT,
        type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'ADJUSTMENT')),
        quantity INTEGER NOT NULL,
        referenceId INTEGER,
        notes TEXT,
        officerName TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabel Laporan Hasil MCU Dokter
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mcu_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reportNumber TEXT,
        patientName TEXT NOT NULL,
        nik TEXT,
        ageGender TEXT NOT NULL,
        birthDate TEXT,
        address TEXT,
        examDate TEXT NOT NULL,
        purpose TEXT DEFAULT 'MCU Kerja',
        vitalSigns TEXT,
        anthropometry TEXT,
        physicalExam TEXT,
        labExam TEXT,
        supportingExam TEXT,
        conclusionType TEXT NOT NULL CHECK(conclusionType IN ('Sehat', 'Sehat dengan catatan', 'Temporary Unfit', 'Unfit')),
        conclusionNotes TEXT,
        recommendations TEXT,
        doctorName TEXT NOT NULL,
        doctorSip TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private seedInitialData() {
    const usersCount = this.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if (!usersCount || usersCount.count === 0) {
      this.logger.log('Melakukan seeding akun pengguna awal (Superadmin, Dokter, Perawat)...');
      const salt = bcrypt.genSaltSync(10);
      const hashAdmin = bcrypt.hashSync('admin123', salt);
      const hashDokter = bcrypt.hashSync('dokter123', salt);
      const hashPerawat = bcrypt.hashSync('perawat123', salt);

      this.run(
        `INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)`,
        ['superadmin', hashAdmin, 'Superadministrator Rumah Sakit', 'Superadmin']
      );
      this.run(
        `INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)`,
        ['dokter', hashDokter, 'dr. H. Rahmat Hidayat, Sp.A', 'Dokter']
      );
      this.run(
        `INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)`,
        ['perawat', hashPerawat, 'Ns. Siti Nurhaliza, S.Kep', 'Perawat']
      );
      this.logger.log('Seeding pengguna berhasil.');
    }

    const stockCount = this.get<{ count: number }>('SELECT COUNT(*) as count FROM vaccine_stocks');
    if (!stockCount || stockCount.count === 0) {
      this.logger.log('Melakukan seeding data awal master stok vaksin...');
      const initialVaccines = [
        {
          name: 'Meningitis Meningokokus ACYW-135',
          manufacturer: 'Bio Farma / GSK',
          batch: 'MEN-2026-X1',
          stock: 120,
          current: 115,
          unit: 'Vial/Dosis',
          expiry: '2027-08-30',
          min: 20,
          status: 'Tersedia'
        },
        {
          name: 'Yellow Fever (Demam Kuning)',
          manufacturer: 'Sanofi Pasteur',
          batch: 'YF-99420-A',
          stock: 60,
          current: 52,
          unit: 'Vial/Dosis',
          expiry: '2027-05-15',
          min: 15,
          status: 'Tersedia'
        },
        {
          name: 'Polio Oral (bOPV / IPV)',
          manufacturer: 'Bio Farma',
          batch: 'POL-7718-B',
          stock: 80,
          current: 74,
          unit: 'Dosis',
          expiry: '2026-12-31',
          min: 15,
          status: 'Tersedia'
        },
        {
          name: 'Influenza Kuadrivalen',
          manufacturer: 'Sanofi / Abbott',
          batch: 'INF-2026-K9',
          stock: 50,
          current: 12,
          unit: 'Prefilled Syringe',
          expiry: '2027-02-28',
          min: 15,
          status: 'Menipis'
        },
        {
          name: 'Hepatitis B Dewasa',
          manufacturer: 'Bio Farma',
          batch: 'HEP-5512-C',
          stock: 40,
          current: 38,
          unit: 'Vial',
          expiry: '2027-11-20',
          min: 10,
          status: 'Tersedia'
        }
      ];

      for (const v of initialVaccines) {
        this.run(
          `INSERT INTO vaccine_stocks (vaccineName, manufacturer, batchNumber, initialStock, currentStock, unit, expiryDate, minStockAlert, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [v.name, v.manufacturer, v.batch, v.stock, v.current, v.unit, v.expiry, v.min, v.status]
        );
      }
    }

    const icvCount = this.get<{ count: number }>('SELECT COUNT(*) as count FROM icv_inventory');
    if (!icvCount || icvCount.count === 0) {
      this.logger.log('Melakukan seeding data awal stok buku ICV...');
      this.run(
        `INSERT INTO icv_inventory (batchCode, startSerial, endSerial, totalStock, usedStock, remainingStock, receivedDate, officerName, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'ICV-BATCH-2026-01',
          'ICV-ID-2026-0001',
          'ICV-ID-2026-0500',
          500,
          35,
          465,
          '2026-01-15',
          'Superadministrator',
          'Pengadaan resmi KKP/Dinas Kesehatan'
        ]
      );
    }

    const recordCount = this.get<{ count: number }>('SELECT COUNT(*) as count FROM vaccination_records');
    if (!recordCount || recordCount.count === 0) {
      this.logger.log('Melakukan seeding contoh data pasien & rekam vaksinasi...');
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = today.substring(0, 7);

      const demoPatients = [
        {
          nik: '3201015504920002',
          fullName: 'Ahmad Fauzi Rahman',
          gender: 'Laki-laki',
          birthPlace: 'Jakarta',
          birthDate: '1992-04-15',
          email: 'ahmad.fauzi@email.com',
          address: 'Jl. Melati No. 14, RT 03/RW 05, Cilandak, Jakarta Selatan',
          phoneWa: '081234567890',
          occupation: 'Wiraswasta',
          maritalStatus: 'Kawin',
          vaccineType: 'Meningitis Meningokokus ACYW-135',
          plannedDate: today,
          plannedTime: '08:30 WIB',
          doctorApproval: 'Disetujui',
          doctorNotes: 'Kondisi fisik prima, tensi 120/80 mmHg, tidak ada alergi',
          status: 'Selesai',
          doctorName: 'dr. H. Rahmat Hidayat, Sp.A',
          nurseName: 'Ns. Siti Nurhaliza, S.Kep',
          adminName: 'Admin Registrasi',
          notes: 'Vaksinasi persiapan Umroh 1448 H',
          infoSource: 'Rekomendasi Agen Travel/Umroh',
          icvNumber: 'ICV-ID-2026-0012',
          monthYear: currentMonth,
          pregnancyTestResult: 'Tidak Dilakukan',
          batchNumber: 'MEN-2026-X1'
        },
        {
          nik: '3273024808950004',
          fullName: 'Dewi Anggraini Putri',
          gender: 'Perempuan',
          birthPlace: 'Bandung',
          birthDate: '1995-08-08',
          email: 'dewi.putri@email.com',
          address: 'Jl. Dago Asri No. 88, Coblong, Bandung',
          phoneWa: '081398765432',
          occupation: 'Pegawai BUMN',
          maritalStatus: 'Kawin',
          vaccineType: 'Yellow Fever (Demam Kuning)',
          plannedDate: today,
          plannedTime: '09:15 WIB',
          doctorApproval: 'Disetujui',
          doctorNotes: 'WUS: Hasil tes kehamilan negatif, screening fit to vaccinate',
          status: 'Selesai',
          doctorName: 'dr. H. Rahmat Hidayat, Sp.A',
          nurseName: 'Ns. Siti Nurhaliza, S.Kep',
          adminName: 'Admin Registrasi',
          notes: 'Dinas perjalanan ke Afrika Barat',
          infoSource: 'Media Sosial',
          icvNumber: 'ICV-ID-2026-0013',
          monthYear: currentMonth,
          pregnancyTestResult: 'Negatif',
          batchNumber: 'YF-99420-A'
        },
        {
          nik: '3171056209980001',
          fullName: 'Rina Kusuma Wardhani',
          gender: 'Perempuan',
          birthPlace: 'Semarang',
          birthDate: '1998-09-22',
          email: 'rina.wardhani@email.com',
          address: 'Jl. Anggrek Garuda No. 5, Palmerah, Jakarta Barat',
          phoneWa: '085712349988',
          occupation: 'Karyawan Swasta',
          maritalStatus: 'Kawin',
          vaccineType: 'Yellow Fever (Demam Kuning)',
          plannedDate: today,
          plannedTime: '10:00 WIB',
          doctorApproval: 'Ditolak',
          doctorNotes: 'WUS: Hasil tes kehamilan POSITIF. Vaksin hidup Yellow Fever dikontraindikasikan pada kehamilan.',
          status: 'Belum',
          doctorName: 'dr. H. Rahmat Hidayat, Sp.A',
          nurseName: 'Ns. Siti Nurhaliza, S.Kep',
          adminName: 'Admin Registrasi',
          notes: 'Diberikan surat keterangan kontraindikasi medis',
          infoSource: 'Website Rumah Sakit',
          icvNumber: '-',
          monthYear: currentMonth,
          pregnancyTestResult: 'Positif',
          batchNumber: '-'
        },
        {
          nik: '3204121503880005',
          fullName: 'Bambang Sudarsono',
          gender: 'Laki-laki',
          birthPlace: 'Surabaya',
          birthDate: '1988-03-15',
          email: 'bambang.s@email.com',
          address: 'Perum Gading Asri Blok C-12, Kelapa Gading, Jakarta Utara',
          phoneWa: '081122334455',
          occupation: 'Konsultan Teknik',
          maritalStatus: 'Kawin',
          vaccineType: 'Influenza Kuadrivalen',
          plannedDate: today,
          plannedTime: '11:00 WIB',
          doctorApproval: 'Menunggu Persetujuan',
          doctorNotes: 'Sedang menunggu pemeriksaan dokter',
          status: 'Belum',
          doctorName: '-',
          nurseName: 'Ns. Siti Nurhaliza, S.Kep',
          adminName: 'Admin Registrasi',
          notes: 'Vaksinasi rutin tahunan',
          infoSource: 'Teman/Keluarga',
          icvNumber: '-',
          monthYear: currentMonth,
          pregnancyTestResult: 'Tidak Dilakukan',
          batchNumber: '-'
        }
      ];

      for (const p of demoPatients) {
        this.run(
          `INSERT INTO vaccination_records (
            nik, fullName, gender, birthPlace, birthDate, email, address, phoneWa,
            occupation, maritalStatus, vaccineType, plannedDate, plannedTime,
            doctorApproval, doctorNotes, status, doctorName, nurseName, adminName,
            notes, infoSource, icvNumber, monthYear, pregnancyTestResult, batchNumber, vaccinatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.nik, p.fullName, p.gender, p.birthPlace, p.birthDate, p.email, p.address, p.phoneWa,
            p.occupation, p.maritalStatus, p.vaccineType, p.plannedDate, p.plannedTime,
            p.doctorApproval, p.doctorNotes, p.status, p.doctorName, p.nurseName, p.adminName,
            p.notes, p.infoSource, p.icvNumber, p.monthYear, p.pregnancyTestResult, p.batchNumber,
            p.status === 'Selesai' ? new Date().toISOString() : null
          ]
        );
      }
      this.logger.log('Seeding pasien & rekam vaksinasi selesai.');
    }

    // 5. Seed Pengaturan Awal (Google Form & Sheets Sync)
    const settingsCount = this.get<{ count: number }>('SELECT COUNT(*) as count FROM app_settings');
    if (!settingsCount || settingsCount.count === 0) {
      this.run(`INSERT OR IGNORE INTO app_settings (key, value, description) VALUES (?, ?, ?)`, [
        'gform_url',
        'https://forms.gle/UQbvWGhwFHSknGkv5',
        'URL Formulir Pendaftaran Mandiri Google Form',
      ]);
      this.run(`INSERT OR IGNORE INTO app_settings (key, value, description) VALUES (?, ?, ?)`, [
        'gform_spreadsheet_id',
        '1vuDSgzwTMJ67TZOSpZIhzdjWJbDe3O0bQv7J_BGpTVs',
        'Google Sheets Spreadsheet ID',
      ]);
      this.run(`INSERT OR IGNORE INTO app_settings (key, value, description) VALUES (?, ?, ?)`, [
        'gform_sheet_name',
        'Form Responses 1',
        'Nama Tab Sheet Google Sheets',
      ]);
      this.run(`INSERT OR IGNORE INTO app_settings (key, value, description) VALUES (?, ?, ?)`, [
        'gform_sync_enabled',
        'true',
        'Status Sinkronisasi Otomatis Setiap 30 Detik',
      ]);
      this.run(`INSERT OR IGNORE INTO app_settings (key, value, description) VALUES (?, ?, ?)`, [
        'gform_last_sync_status',
        'Siap (Menunggu konfigurasi kredensial)',
        'Status Sinkronisasi Terakhir',
      ]);
    }

    // 6. Seed Laporan MCU Awal (Berdasarkan Dokumen SUHERIONO)
    const mcuCount = this.get<{ count: number }>('SELECT COUNT(*) as count FROM mcu_reports');
    if (!mcuCount || mcuCount.count === 0) {
      this.logger.log('Melakukan seeding template laporan MCU awal (SUHERIONO)...');
      const suherionoVital = JSON.stringify({
        bloodPressure: '127/90 mmHg (Pre-hipertensi)',
        pulse: '95 x/menit (Normal)',
        respiration: '26 x/menit (Normal)',
        temperature: '36.2 °C (Normal)',
        consciousness: 'Compos Mentis',
      });

      const suherionoAntropo = JSON.stringify({
        weight: '67 kg',
        height: '160 cm',
        bmi: '26.2',
        nutritionStatus: 'Obesitas',
      });

      const suherionoPhysical = JSON.stringify({
        generalCondition: 'Baik',
        head: 'Normal',
        eyes: 'Visus OD 20/20, OS 20/20',
        colorVision: 'Tidak Buta warna',
        teeth: 'Radics 1, stain+',
        ent: 'Tidak ada sekret, Normal',
        neck: 'Tidak ada pembesaran kelenjar, Normal',
        heart: 'Bunyi jantung reguler, tidak ada murmur, Normal',
        lungs: 'Suara nafas vesikuler, tidak ada ronkhi/wheezing, Normal',
        abdomen: 'Lunak, tidak ada nyeri tekan, Hepar dan Lien tidak teraba, Normal',
        extremities: 'Tidak ada edema, kekuatan otot baik, Normal',
      });

      const suherionoLab = JSON.stringify({
        completeBlood: 'Dalam batas normal',
        completeUrine: 'Dalam batas normal',
        bloodChemistry: 'GDP, Kolesterol total, LDL, HDL, TG, SGOT, SGPT, Ureum, Kreatinin, Asam Urat: Dalam batas normal',
        hbsag: 'Negatif',
        drugTest: 'Negatif (6 Parameter)',
        additionalLab: '',
      });

      const suherionoSupporting = JSON.stringify({
        thoraxXray: 'Trakea di tengah, Mediastinum tidak melebar, Cor tidak membesar (CTR <50%), Sinuses dan diafragma normal. Pulmo: Hili normal, Corakan bronkovaskuler normal, Tidak tampak infiltrat/konsolidasi. Soft tissue dan skeletal normal. Kesan: Tidak tampak TBC paru aktif/pneumonia, Tidak tampak kardiomegali.',
        ekg: 'Normal (Hasil terlampir)',
        treadmill: 'Normal',
        audiometry: 'Rata-rata ambang dengar kedua telinga dalam batas normal, terdapat penurunan pendengaran pada frekuensi 8000Hz sebesar 35dB pada telinga kanan dan frekuensi 8000Hz sebesar 60dB pada telinga kiri.',
        spirometry: 'Restrictive',
        additionalExam: '',
      });

      const suherionoRecs = JSON.stringify([
        'Konsul Dokter Spesialis THT',
        'Konsul Gizi',
        'Berhenti merokok',
        'Perbaiki pola makan dan olahraga teratur',
      ]);

      this.run(
        `INSERT INTO mcu_reports (
          reportNumber, patientName, nik, ageGender, birthDate, address,
          examDate, purpose, vitalSigns, anthropometry, physicalExam, labExam,
          supportingExam, conclusionType, conclusionNotes, recommendations,
          doctorName, doctorSip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'MCU-2026-11-001',
          'SUHERIONO',
          '1207022006770001',
          '49 Tahun / Laki-Laki',
          '20 Juni 1977',
          'Lk. I Gg. Amri Rt. 000/000 Delitua Barat Deli Tua Kabupaten Deli Serdang Sumatra Utara',
          '2026-11-02',
          'MCU Kerja',
          suherionoVital,
          suherionoAntropo,
          suherionoPhysical,
          suherionoLab,
          suherionoSupporting,
          'Sehat dengan catatan',
          'Perbaiki pola makan dan olahraga teratur, gangguan pendengaran',
          suherionoRecs,
          'dr. Arinda Puteri P',
          'SIP.MR32032507002898',
        ]
      );
    }
  }
}
