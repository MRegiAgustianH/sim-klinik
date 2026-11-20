import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as fs from 'fs';
import { DATA_DIR, IDENTITY_DATA_DIR } from '../config/paths';
import { PERMISSION_CATALOG, PERMISSION_PRESETS } from '../auth/permissions';

// Memindahkan akun staf SIMKlinik ke pengaturan hak akses di portal, sekali jalan.
//
// Sejak akun hanya dibuat di portal, SIMKlinik tidak lagi membaca tabel users
// miliknya. Supaya tidak ada staf yang kehilangan akses, setiap akun aktif di
// tabel users SIMKlinik diberi, di layanan identitas:
//   - akun portal (dibuat bila belum ada, password disalin dari SIMKlinik)
//   - akses aplikasi SIMKlinik
//   - centang fitur sesuai perannya di SIMKlinik (preset Dokter / Perawat)
//
// Akun yang sudah punya centang fitur SIMKlinik tidak diubah, jadi skrip ini
// aman dijalankan ulang. Database SIMKlinik hanya dibaca.
//
// Pemakaian (dari folder apps/simklinik-api/):
//   npm run migrasi:hak-akses -- --dry-run
//   npm run migrasi:hak-akses -- --production --dry-run
//   npm run migrasi:hak-akses -- --production

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const production = args.includes('--production');

const appDbPath = path.join(DATA_DIR, production ? 'vaksinku.sqlite' : 'vaksinku-dev.sqlite');
const identityDbPath = path.join(IDENTITY_DATA_DIR, production ? 'identity.sqlite' : 'identity-dev.sqlite');

interface SimklinikUser {
  username: string;
  password: string;
  fullName: string;
  role: string;
  isActive: number;
}

function main() {
  for (const p of [appDbPath, identityDbPath]) {
    if (!fs.existsSync(p)) {
      console.error(`[GAGAL] File tidak ditemukan: ${p}`);
      process.exit(1);
    }
  }

  console.log(`\nMigrasi hak akses SIMKlinik ke portal${dryRun ? ' (DRY-RUN, tidak ada yang ditulis)' : ''}`);
  console.log(`  Sumber (dibaca saja): ${appDbPath}`);
  console.log(`  Tujuan              : ${identityDbPath}\n`);

  const app = new DatabaseSync(appDbPath, { readOnly: true });
  const identity = new DatabaseSync(identityDbPath);
  identity.exec('PRAGMA foreign_keys = ON;');

  for (const table of ['app_permissions', 'app_permission_presets', 'user_permissions']) {
    const exists = identity.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(table);
    if (!exists) {
      console.error(`[GAGAL] Tabel ${table} belum ada. Jalankan layanan identitas versi terbaru sekali, lalu ulangi.`);
      process.exit(1);
    }
  }

  if (!dryRun) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const backup = path.join(path.dirname(identityDbPath), '..', 'backups', `${path.basename(identityDbPath, '.sqlite')}-sebelum-hak-akses-${stamp}.sqlite`);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    identity.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
    console.log(`Backup database identitas: ${backup}\n`);
  }

  const presetOf = (role: string) => PERMISSION_PRESETS.find((p) => p.code === role.toLowerCase());
  const staff = app
    .prepare('SELECT username, password, fullName, role, isActive FROM users WHERE isActive = 1 ORDER BY id')
    .all() as unknown as SimklinikUser[];

  identity.exec('BEGIN');
  try {
    // Katalog ditulis di sini juga, agar centang langsung terbaca walau
    // backend SIMKlinik belum sempat mendaftarkannya.
    identity.prepare("DELETE FROM app_permissions WHERE appCode = 'simklinik'").run();
    identity.prepare("DELETE FROM app_permission_presets WHERE appCode = 'simklinik'").run();
    PERMISSION_CATALOG.forEach((p, i) =>
      identity
        .prepare("INSERT INTO app_permissions (appCode, code, label, groupName, description, sortOrder) VALUES ('simklinik', ?, ?, ?, ?, ?)")
        .run(p.code, p.label, p.group, p.description ?? null, i)
    );
    PERMISSION_PRESETS.forEach((p, i) =>
      identity
        .prepare("INSERT INTO app_permission_presets (appCode, code, label, permissions, sortOrder) VALUES ('simklinik', ?, ?, ?, ?)")
        .run(p.code, p.label, JSON.stringify(p.permissions), i)
    );

    for (const s of staff) {
      let target = identity
        .prepare('SELECT id, role, isActive FROM users WHERE username = ?')
        .get(s.username) as { id: number; role: string; isActive: number } | undefined;
      const notes: string[] = [];

      if (!target) {
        const role = ['Superadmin', 'Dokter', 'Perawat'].includes(s.role) ? s.role : 'Perawat';
        const result = identity
          .prepare('INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)')
          .run(s.username, s.password, s.fullName, role);
        target = { id: Number(result.lastInsertRowid), role, isActive: 1 };
        identity.prepare("INSERT OR IGNORE INTO app_access (userId, appCode) VALUES (?, 'portal')").run(target.id);
        notes.push('akun portal dibuat (password sama dengan SIMKlinik)');
      }

      if (target.role === 'Superadmin') {
        console.log(`  ${s.username.padEnd(14)} Superadmin: otomatis semua fitur.`);
        continue;
      }
      if (target.isActive !== 1) {
        console.log(`  ${s.username.padEnd(14)} DILEWATI: akun portalnya nonaktif.`);
        continue;
      }

      const access = identity
        .prepare("INSERT OR IGNORE INTO app_access (userId, appCode) VALUES (?, 'simklinik')")
        .run(target.id);
      if (Number(access.changes) > 0) notes.push('akses SIMKlinik diberikan');

      const existing = identity
        .prepare("SELECT COUNT(*) AS c FROM user_permissions WHERE userId = ? AND appCode = 'simklinik'")
        .get(target.id) as { c: number };
      if (existing.c > 0) {
        notes.push(`centang fitur sudah ada (${existing.c}), tidak diubah`);
      } else {
        const preset = presetOf(s.role);
        if (preset) {
          for (const code of preset.permissions) {
            identity
              .prepare("INSERT INTO user_permissions (userId, appCode, permission) VALUES (?, 'simklinik', ?)")
              .run(target.id, code);
          }
          notes.push(`preset ${preset.label} (${preset.permissions.length} fitur)`);
        } else {
          notes.push(`peran '${s.role}' tanpa preset: hanya bisa melihat, atur manual di portal`);
        }
      }
      console.log(`  ${s.username.padEnd(14)} ${notes.join('; ')}`);
    }

    identity.exec(dryRun ? 'ROLLBACK' : 'COMMIT');
  } catch (err) {
    identity.exec('ROLLBACK');
    throw err;
  }

  console.log(dryRun ? '\nDry-run selesai; tidak ada yang ditulis.\n' : '\nMigrasi selesai.\n');
  console.log('Catatan: mulai sekarang login SIMKlinik memakai password akun portal.');
  app.close();
  identity.close();
}

main();
