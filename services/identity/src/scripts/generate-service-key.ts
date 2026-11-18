import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../app.module';
import { DatabaseService } from '../database/database.service';
import { SERVICE_KEYS_DIR } from '../config/paths';

// Membuat service key untuk satu aplikasi. Yang disimpan di database adalah
// hash bcrypt-nya, jadi kunci aslinya tidak bisa dibaca kembali. Kunci ditulis
// ke file agar backend app terkait bisa membacanya sendiri saat start —
// runner.js menyalakan proses tanpa terminal, jadi kunci tidak bisa diketik.
async function main() {
  const logger = new Logger('GenerateServiceKey');

  const args = process.argv.slice(2);
  const name = args.find((arg) => !arg.startsWith('--'));
  const canVerifyAll = args.includes('--portal');

  if (!name) {
    logger.error('Nama layanan wajib diisi.');
    logger.log('Contoh:');
    logger.log('  npm run generate-key -- portal --portal');
    logger.log('  npm run generate-key -- simklinik');
    logger.log('  npm run generate-key -- surat');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const db = app.get(DatabaseService);

  const target = db.getInfo();
  logger.log(`Database (${target.mode}): ${target.path}`);

  const key = crypto.randomBytes(32).toString('hex');
  const keyHash = bcrypt.hashSync(key, bcrypt.genSaltSync(10));

  const existing = db.get<{ id: number }>('SELECT id FROM service_keys WHERE name = ?', [name]);
  if (existing) {
    db.run('UPDATE service_keys SET keyHash = ?, canVerifyAll = ?, isActive = 1 WHERE id = ?', [
      keyHash,
      canVerifyAll ? 1 : 0,
      existing.id,
    ]);
    logger.log(`Service key untuk '${name}' diperbarui (kunci lama langsung tidak berlaku).`);
  } else {
    db.run('INSERT INTO service_keys (name, keyHash, canVerifyAll) VALUES (?, ?, ?)', [
      name,
      keyHash,
      canVerifyAll ? 1 : 0,
    ]);
    logger.log(`Service key untuk '${name}' dibuat.`);
  }

  await app.close();

  // Kunci ditulis ke secrets/service-keys/. Kunci dev berakhiran -dev agar
  // mode dev dan production tidak saling menimpa.
  const keyDir = SERVICE_KEYS_DIR;
  fs.mkdirSync(keyDir, { recursive: true });
  const suffix = target.mode === 'development' ? '-dev' : '';
  const keyFile = path.join(keyDir, `${name}${suffix}.key`);
  fs.writeFileSync(keyFile, key, { encoding: 'utf8', mode: 0o600 });

  console.log('\n====================================================================');
  console.log('  SERVICE KEY DIBUAT');
  console.log('====================================================================');
  console.log(`  Nama layanan   : ${name}`);
  console.log(`  boleh verify   : ${canVerifyAll ? 'semua app (portal)' : 'hanya token sendiri'}`);
  console.log(`  database       : ${target.mode} (${path.basename(target.path)})`);
  console.log(`  file kunci     : ${keyFile}`);
  console.log('');
  console.log('  Backend app membaca file itu otomatis saat start.');
  console.log('  File ini RAHASIA: jangan di-commit (sudah masuk .gitignore).');
  console.log('  Kunci lama langsung tidak berlaku bila dijalankan ulang.');
  console.log('====================================================================\n');
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
