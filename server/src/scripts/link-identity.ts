import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Mengisi kolom patientId di database SIMKlinik dengan mencocokkan NIK ke
// database layanan identitas. Satu-satunya perubahan yang ditulis adalah
// kolom patientId pada vaccination_records dan mcu_reports. Kolom nik,
// patientName, dan seluruh isi rekam medis tidak disentuh.
//
// Pemakaian (dari folder server/):
//   npm run link:identity -- --dry-run
//   npm run link:identity
//   npm run link:identity -- --production   (menulis ke vaksinku.sqlite, bukan dev)

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const production = args.includes('--production');

function resolvePaths() {
  const serverDir = path.resolve(__dirname, '..', '..');
  const repoDir = path.resolve(serverDir, '..');
  return {
    appDb: path.join(serverDir, 'data', production ? 'vaksinku.sqlite' : 'vaksinku-dev.sqlite'),
    identityDb: path.join(
      repoDir,
      'portal',
      'identity-service',
      'data',
      production ? 'identity.sqlite' : 'identity-dev.sqlite'
    ),
  };
}

// Memeriksa apakah backend SIMKlinik sedang mendengarkan di port 4000/4001.
// Sengaja memakai netstat, bukan koneksi HTTP: yang diperiksa adalah ada atau
// tidaknya proses yang memegang port, bukan kesiapannya melayani.
function findRunningBackend(): number | null {
  const ports = [4000, 4001];
  for (const port of ports) {
    try {
      const output = execSync(`netstat -ano | findstr ":${port}"`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      if (/LISTENING/.test(output)) return port;
    } catch {
      // findstr tidak menemukan apa pun -> port tidak dipakai
    }
  }
  return null;
}

function countByLinks(db: DatabaseSync, table: string) {
  return db.prepare(`SELECT COUNT(*) as total, SUM(patientId IS NOT NULL) as linked FROM ${table}`).get() as {
    total: number;
    linked: number | null;
  };
}

function link() {
  const { appDb: appPath, identityDb: identityPath } = resolvePaths();

  for (const p of [appPath, identityPath]) {
    if (!fs.existsSync(p)) {
      console.error(`[GAGAL] File tidak ditemukan: ${p}`);
      process.exit(1);
    }
  }

  // Backend yang hidup memegang database yang sama DAN menjalankan sinkronisasi
  // Google Form setiap 30 detik. Menulis patientId di tengah itu bisa bentrok,
  // jadi backend diminta mati lebih dulu.
  const runningPort = findRunningBackend();
  if (runningPort && !dryRun) {
    console.error('====================================================================');
    console.error(`  [GAGAL] Backend SIMKlinik masih berjalan di port ${runningPort}.`);
    console.error('====================================================================');
    console.error('  Matikan backend dulu (CTRL+C di jendela server), lalu jalankan ulang.');
    console.error('  Saat backend hidup, sinkronisasi Google Form juga menulis ke database ini.');
    console.error('');
    console.error(`  Cek: netstat -ano | findstr ":${runningPort}"`);
    console.error('  Matikan berdasarkan PID: taskkill /F /PID <angka>');
    console.error('====================================================================\n');
    process.exit(1);
  }

  console.log('====================================================================');
  console.log(`  PENAUTAN PASIEN -> IDENTITY SERVICE (${production ? 'PRODUCTION' : 'DEVELOPMENT'})`);
  console.log('====================================================================');
  console.log(`  Database SIMKlinik : ${appPath}`);
  console.log(`  Database identitas : ${identityPath}`);
  console.log(`  Mode              : ${dryRun ? 'DRY-RUN (tidak menulis)' : 'TAUTKAN'}`);
  console.log('====================================================================\n');

  const appDb = new DatabaseSync(appPath);
  const identityDb = new DatabaseSync(identityPath, { readOnly: true });

  try {
    // NIK -> patientId, hanya NIK sah yang bisa dipakai sebagai kunci.
    const identityRows = identityDb
      .prepare('SELECT id, nik FROM patients WHERE nik IS NOT NULL AND length(trim(nik)) = 16')
      .all() as Array<{ id: number; nik: string }>;
    const byNik = new Map(identityRows.map((row) => [row.nik.trim(), row.id]));
    console.log(`  Identitas dengan NIK sah: ${byNik.size}\n`);

    let totalLinked = 0;
    let totalAmbiguous = 0;

    for (const table of ['vaccination_records', 'mcu_reports']) {
      const before = countByLinks(appDb, table);

      if (!dryRun) appDb.exec('BEGIN TRANSACTION;');

      const rows = appDb
        .prepare(`SELECT id, nik FROM ${table} WHERE patientId IS NULL`)
        .all() as Array<{ id: number; nik: string | null }>;

      let linked = 0;
      let mismatched = 0;
      const ambiguous: Array<{ id: number; nik: string }> = [];

      const update = appDb.prepare(`UPDATE ${table} SET patientId = ? WHERE id = ?`);

      for (const row of rows) {
        const nik = (row.nik || '').trim();
        if (nik.length !== 16) {
          // NIK kosong atau tidak sah: dibiarkan NULL, dicatat di ringkasan.
          if (nik.length > 0) ambiguous.push({ id: row.id, nik });
          continue;
        }
        const patientId = byNik.get(nik);
        if (!patientId) {
          mismatched += 1;
          continue;
        }
        if (!dryRun) update.run(patientId, row.id);
        linked += 1;
      }

      if (!dryRun) appDb.exec('COMMIT;');

      totalLinked += linked;
      totalAmbiguous += ambiguous.length;

      const after = dryRun ? before : countByLinks(appDb, table);
      console.log(`  ${table}`);
      console.log(`    total rekam      : ${after.total}`);
      console.log(`    sudah tertaut    : ${after.linked ?? 0}`);
      console.log(`    ditautkan sekarang: ${linked}`);
      if (mismatched > 0) {
        console.log(`    [!] NIK sah tetapi tidak ada di identity service: ${mismatched}`);
        console.log(`        Jalankan impor pasien di identity-service lebih dulu.`);
      }
      if (ambiguous.length > 0) {
        console.log(`    [!] NIK tidak sah (tidak ditautkan, perlu koreksi manual): ${ambiguous.length}`);
        for (const item of ambiguous.slice(0, 10)) {
          console.log(`         - id ${item.id}: "${item.nik}"`);
        }
      }
      console.log('');
    }

    console.log('====================================================================');
    console.log(`  Selesai. ${totalLinked} rekam ditautkan, ${totalAmbiguous} NIK tidak sah.`);
    if (!production) {
      console.log('  [PENTING] Ini database DEVELOPMENT. Data klinik tidak tersentuh.');
      console.log('  Ulangi dengan --production bila memang ingin menautkan data asli.');
    }
    console.log('====================================================================\n');
  } catch (err) {
    try {
      appDb.exec('ROLLBACK;');
    } catch {
      // transaksi mungkin belum dibuka
    }
    console.error('[GAGAL]:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    identityDb.close();
    appDb.close();
  }
}

link();
