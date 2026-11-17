import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from '../app.module';
import { DatabaseService } from '../database/database.service';

// Logger di level modul: dipakai main() maupun fungsi impor per sumber.
const logger = new Logger('ImportPatients');

// Membaca database SIMKlinik secara READ-ONLY dan menyalin identitas pasien ke
// identity.sqlite. Skrip ini TIDAK mengubah database SIMKlinik sama sekali:
// koneksi dibuka dengan mode readOnly, dan tidak ada ALTER/UPDATE/DELETE.
//
// Pemakaian:
//   npm run import:patients                      (cari otomatis database production SIMKlinik)
//   npm run import:patients -- --source="D:\...\vaksinku.sqlite"
//   npm run import:patients -- --dry-run         (lihat hasil tanpa menulis)
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sourceArg = args.find((arg) => arg.startsWith('--source='));

  const sourcePath = sourceArg
    ? sourceArg.slice('--source='.length).replace(/^"|"$/g, '')
    : defaultSourcePath();

  if (!fs.existsSync(sourcePath)) {
    logger.error(`Database sumber tidak ditemukan: ${sourcePath}`);
    logger.log('Tentukan manual dengan --source="D:\\requirements\\sim-klinik\\server\\data\\vaksinku.sqlite"');
    process.exit(1);
  }

  logger.log(`Sumber (read-only): ${sourcePath}`);
  logger.log(`Mode: ${dryRun ? 'DRY-RUN (tidak menulis apa pun)' : 'IMPORT'}`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const identityDb = app.get(DatabaseService);

  // Database tujuan wajib dicetak. Tanpa ini, impor ke database dev dan
  // database production sama-sama melaporkan sukses dan selisihnya tidak terlihat.
  const target = identityDb.getInfo();
  logger.log(`Tujuan (${target.mode}): ${target.path}`);
  if (target.mode === 'development' && !dryRun) {
    logger.warn('Mode DEVELOPMENT aktif karena ada .env.local. Data TIDAK masuk ke identity.sqlite.');
    logger.warn('Hapus .env.local bila ingin menulis ke database production.');
  }

  const source = new DatabaseSync(sourcePath, { readOnly: true });

  try {
    const fromVaccination = importFromVaccination(source, identityDb, dryRun);
    const fromMcu = importFromMcu(source, identityDb, dryRun);

    const total = identityDb.get<{ count: number }>('SELECT COUNT(*) as count FROM patients');

    logger.log('---------------- Hasil impor ----------------');
    logger.log(`Vaksinasi : ${fromVaccination.inserted} baru, ${fromVaccination.merged} digabung, ` +
      `${fromVaccination.skippedNoNik} tanpa NIK (dilewati), ${fromVaccination.conflicts} bentrok data`);
    logger.log(`MCU       : ${fromMcu.inserted} baru, ${fromMcu.skippedNoNik} tanpa NIK (dilewati), ` +
      `${fromMcu.skippedDuplicate} sudah ada, ${fromMcu.conflicts} bentrok data`);
    logger.log(`Total pasien di identity service: ${total?.count ?? 0}`);
    logger.log(`Tanggal lahir: ${fromMcu.statedBirthDate} dari laporan, ` +
      `${fromMcu.estimatedBirthDate} perkiraan dari usia`);
    logger.log('---------------------------------------------');

    if (fromVaccination.conflicts + fromMcu.conflicts > 0) {
      logger.warn('Bentrok data = NIK sudah terdaftar tetapi nama atau tanggal lahir berbeda.');
      logger.warn('Data lama TIDAK ditimpa. Periksa manual di dashboard sebelum dipakai.');
    }

    const suspect = [...fromVaccination.suspectNik, ...fromMcu.suspectNik];
    if (suspect.length > 0) {
      logger.warn(`${suspect.length} NIK tidak valid (bukan 16 digit) dan TIDAK diimpor:`);
      for (const item of suspect) {
        logger.warn(`  - ${item.source}: ${item.name} | NIK: "${item.nik}" (${item.nik.length} digit)`);
      }
      logger.warn('Perbaiki NIK tersebut di SIMKlinik, lalu jalankan impor ini lagi.');
    }
  } finally {
    source.close();
    await app.close();
  }
}

function defaultSourcePath(): string {
  // __dirname = <service>/src/scripts (ts-node) atau <service>/dist/scripts (build)
  const serviceRoot = path.resolve(__dirname, '..', '..');
  const repoRoot = path.resolve(serviceRoot, '..', '..');
  return path.join(repoRoot, 'server', 'data', 'vaksinku.sqlite');
}

interface ImportStats {
  inserted: number;
  merged: number;
  skippedNoNik: number;
  skippedDuplicate: number;
  conflicts: number;
  // NIK yang ada isinya tetapi panjangnya bukan 16 digit. Hampir selalu salah
  // ketik; dikumpulkan agar bisa diperbaiki, bukan sekadar dibuang.
  suspectNik: Array<{ name: string; nik: string; source: string }>;
  // Tanggal lahir yang terbaca dari laporan vs yang hanya diperkirakan dari
  // usia. Angka perkiraan yang tinggi berarti data lama perlu dirapikan.
  statedBirthDate: number;
  estimatedBirthDate: number;
}

interface LegacyPatient {
  nik: string | null;
  fullName: string | null;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  email: string | null;
  address: string | null;
  phoneWa: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  ageGender?: string | null;
  examDate?: string | null;
}

// NIK hanya bisa dipakai sebagai kunci penggabungan bila tepat 16 digit.
// Selain itu diklasifikasikan agar laporan impor bisa membedakan "tidak punya
// NIK" dari "NIK perlu diperbaiki".
function classifyNik(nik: string | null) {
  const value = (nik || '').trim();
  if (value.length === 0) return { kind: 'kosong' as const, value };
  if (value.length === 16 && /^\d{16}$/.test(value)) return { kind: 'sah' as const, value };
  return { kind: 'mencurigakan' as const, value };
}

function emptyStats(): ImportStats {
  return {
    inserted: 0,
    merged: 0,
    skippedNoNik: 0,
    skippedDuplicate: 0,
    conflicts: 0,
    suspectNik: [],
    statedBirthDate: 0,
    estimatedBirthDate: 0,
  };
}

function importFromVaccination(source: DatabaseSync, identityDb: DatabaseService, dryRun: boolean): ImportStats {
  const stats = emptyStats();

  // Data vaksinasi adalah sumber terlengkap, jadi diproses lebih dulu. Baris
  // dengan NIK lebih awal (tanggal kunjungan terlama) dipakai sebagai acuan.
  const rows = source
    .prepare(
      `SELECT nik, fullName, gender, birthPlace, birthDate, email, address, phoneWa, occupation, maritalStatus
       FROM vaccination_records ORDER BY date(plannedDate) ASC, id ASC`
    )
    .all() as unknown as LegacyPatient[];

  for (const row of rows) {
    const fullName = (row.fullName || '').trim();
    const nik = classifyNik(row.nik);

    if (nik.kind !== 'sah') {
      if (nik.kind === 'mencurigakan') {
        stats.suspectNik.push({ name: fullName || '(tanpa nama)', nik: nik.value, source: 'vaksinasi' });
      }
      stats.skippedNoNik += 1;
      continue;
    }

    // Nama kosong berarti baris ini tidak bisa dipakai sebagai identitas pasien.
    if (fullName.length === 0) {
      stats.skippedNoNik += 1;
      continue;
    }

    const outcome = upsertLegacyPatient(identityDb, { ...row, nik: nik.value, fullName }, 'simklinik', dryRun);
    if (outcome === 'inserted') stats.inserted += 1;
    else if (outcome === 'merged') stats.merged += 1;
    else stats.conflicts += 1;
  }

  return stats;
}

function importFromMcu(source: DatabaseSync, identityDb: DatabaseService, dryRun: boolean): ImportStats {
  const stats = emptyStats();

  const rows = source
    .prepare(
      `SELECT nik, patientName as fullName, birthDate, address, ageGender, examDate
       FROM mcu_reports ORDER BY date(examDate) ASC, id ASC`
    )
    .all() as unknown as LegacyPatient[];

  for (const row of rows) {
    const fullName = (row.fullName || '').trim();
    const nik = classifyNik(row.nik);

    // MCU tanpa NIK sah tidak bisa dicocokkan dengan pasien mana pun.
    if (nik.kind !== 'sah') {
      if (nik.kind === 'mencurigakan') {
        stats.suspectNik.push({ name: fullName || '(tanpa nama)', nik: nik.value, source: 'MCU' });
      }
      stats.skippedNoNik += 1;
      continue;
    }

    // Tanggal lahir yang tertulis di laporan dipakai apa adanya. Perkiraan dari
    // usia hanya dipakai bila tanggalnya memang tidak ada — bukan sebaliknya.
    const stated = normalizeDate(row.birthDate);
    const birthDate = stated || birthDateFromAgeGender(row.ageGender, row.examDate);
    if (stated) stats.statedBirthDate += 1;
    else if (birthDate) {
      stats.estimatedBirthDate += 1;
      logger.warn(
        `Tanggal lahir ${fullName || '(tanpa nama)'} tidak terbaca ("${row.birthDate}"); ` +
          `dipakai perkiraan ${birthDate} dari usia saat periksa. Perlu dikoreksi manual.`
      );
    }

    const outcome = upsertLegacyPatient(
      identityDb,
      { ...row, nik: nik.value, fullName, birthDate, gender: genderFromAgeGender(row.ageGender) },
      'simklinik',
      dryRun
    );
    if (outcome === 'inserted') stats.inserted += 1;
    else if (outcome === 'merged') stats.merged += 1;
    else if (outcome === 'conflict') stats.conflicts += 1;
    else stats.skippedDuplicate += 1;
  }

  return stats;
}

// Aturan penggabungan: NIK yang sama = pasien yang sama. Field kosong di data
// lama diisi dari data baru; field yang sudah terisi TIDAK ditimpa, supaya
// perubahan yang sudah dilakukan staf di identity service tidak hilang.
function upsertLegacyPatient(
  identityDb: DatabaseService,
  row: LegacyPatient,
  sourceApp: string,
  dryRun: boolean
): 'inserted' | 'merged' | 'conflict' | 'skipped' {
  const birthDate = normalizeDate(row.birthDate);
  const existing = identityDb.get<{
    id: number;
    fullName: string;
    birthDate: string | null;
    gender: string;
  }>('SELECT id, fullName, birthDate, gender FROM patients WHERE nik = ?', [row.nik]);

  if (!existing) {
    if (!dryRun) {
      // node:sqlite menolak undefined; setiap field opsional wajib null.
      // mcu_reports tidak punya birthPlace/occupation/maritalStatus/email/
      // phoneWa, jadi field itu memang selalu undefined dari sumbernya.
      const clean = (value: string | null | undefined) => {
        const text = value === null || value === undefined ? '' : String(value).trim();
        return text === '' ? null : text;
      };

      identityDb.run(
        `INSERT INTO patients (nik, fullName, gender, birthPlace, birthDate, email, address, phoneWa, occupation, maritalStatus, sourceApp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clean(row.nik),
          clean(row.fullName) || '(tanpa nama)',
          row.gender || 'Lainnya',
          clean(row.birthPlace),
          birthDate,
          clean(row.email),
          clean(row.address),
          clean(row.phoneWa),
          clean(row.occupation),
          clean(row.maritalStatus),
          sourceApp,
        ]
      );
    }
    return 'inserted';
  }

  // Nama berbeda pada NIK yang sama bisa berarti salah ketik NIK atau pasang
  // NIK orang lain. Jangan diputuskan otomatis — laporkan untuk diperiksa.
  const sameName = normalizeName(existing.fullName) === normalizeName(row.fullName || '');
  const sameBirth =
    !existing.birthDate || !birthDate || normalizeDate(existing.birthDate) === birthDate;
  if (!sameName || !sameBirth) {
    return 'conflict';
  }

  const fill: Array<[string, string | null | undefined]> = [
    ['birthPlace', row.birthPlace],
    ['birthDate', birthDate],
    ['email', row.email],
    ['address', row.address],
    ['phoneWa', row.phoneWa],
    ['occupation', row.occupation],
    ['maritalStatus', row.maritalStatus],
  ];

  const updates: string[] = [];
  const params: (string | number)[] = [];
  for (const [column, value] of fill) {
    if (value === null || value === undefined || String(value).trim() === '') continue;
    const current = identityDb.get<Record<string, string | null>>(
      `SELECT ${column} FROM patients WHERE id = ?`,
      [existing.id]
    );
    if (current && (current[column] === null || String(current[column]).trim() === '')) {
      updates.push(`${column} = ?`);
      params.push(String(value).trim());
    }
  }

  if (updates.length === 0) return 'skipped';

  if (!dryRun) {
    params.push(existing.id);
    identityDb.run(
      `UPDATE patients SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
  }
  return 'merged';
}

function normalizeName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const MONTHS_ID: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
};

// birthDate di SIMKlinik seharusnya YYYY-MM-DD, tetapi data lama hasil impor
// bisa berisi teks bebas. Yang tidak bisa dibaca dengan aman dikembalikan null
// daripada disimpan sebagai tanggal salah.
function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // "15 April 1983" dan "15 April 1983" dengan spasi ganda. Pola ini wajib
  // diperiksa sebelum cadangan usia, karena tanpa itu tanggal lahir yang
  // tertulis lengkap akan hilang dan diganti perkiraan dari umur.
  const named = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (named) {
    const month = MONTHS_ID[named[2].toLowerCase()];
    if (month) return `${named[3]}-${month}-${named[1].padStart(2, '0')}`;
  }

  const localized = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (localized) {
    const [, d, m, y] = localized;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

// Usia di SIMKlinik lama disimpan sebagai teks (mis. "35 Tahun / Laki-laki").
// Dipakai sebagai cadangan bila MCU tidak punya tanggal lahir, karena tanggal
// lahir yang dihitung ulang dari usia pemeriksaan selalu lebih tepat daripada
// membuang pasiennya.
function birthDateFromAgeGender(ageGender: string | null, examDate: string | null): string | null {
  if (!ageGender) return null;
  const ageMatch = String(ageGender).match(/(\d{1,3})\s*(?:tahun|th|t)?\b/i);
  if (!ageMatch) return null;
  const age = Number(ageMatch[1]);
  if (age <= 0 || age > 120) return null;

  const exam = normalizeDate(examDate) || new Date().toISOString().slice(0, 10);
  const year = Number(exam.slice(0, 4)) - age;
  if (year < 1900) return null;
  return `${year}${exam.slice(4)}`;
}

function genderFromAgeGender(ageGender: string | null): string {
  const text = String(ageGender || '').toLowerCase();
  if (text.includes('perempuan') || text.includes('wanita') || text.includes('female')) return 'Perempuan';
  if (text.includes('laki') || text.includes('pria') || text.includes('male')) return 'Laki-laki';
  return 'Lainnya';
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
