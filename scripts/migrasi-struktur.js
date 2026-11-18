// scripts/migrasi-struktur.js — peralihan sekali jalan ke struktur folder baru.
//
// Git sudah memindahkan semua file yang ter-commit. Yang tertinggal di folder
// lama adalah file yang di-.gitignore: database, kredensial, service key,
// backup, dan node_modules. Skrip ini memindahkannya ke lokasi baru:
//
//   server/data/*                          -> data/simklinik/
//   portal/identity-service/data/*.sqlite* -> data/identity/
//   portal/identity-service/data/service-keys/ -> secrets/service-keys/
//   backups/*                              -> data/backups/
//   server/google-credentials.json         -> secrets/google-credentials.json        (akun aktif)
//   google-credentials.json (root)         -> secrets/google-credentials-baru.json   (akun baru, belum dipakai)
//   node_modules tiap aplikasi             -> folder aplikasi yang baru
//
// Hasil build lama (dist, .next) TIDAK dipindah: isinya masih memakai path
// lama. runner.js membuat ulang build yang hilang saat dijalankan.
//
//   node scripts/migrasi-struktur.js --dry-run   (hanya menampilkan rencana)
//   node scripts/migrasi-struktur.js
const fs = require('fs');
const path = require('path');
const net = require('net');

const ROOT = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const PORTS = require('../config/ports');

const r = (...p) => path.join(ROOT, ...p);
const rel = (p) => path.relative(ROOT, p) || '.';

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// Daftar [sumber, tujuan]. Isi folder dipindah per item agar tujuan yang
// sudah ada (mis. data/backups dari sebelumnya) tidak tertimpa.
function plan() {
  const moves = [];
  const addDirContents = (from, to, filter = () => true) => {
    if (!fs.existsSync(from)) return;
    for (const name of fs.readdirSync(from)) {
      if (filter(name)) moves.push([path.join(from, name), path.join(to, name)]);
    }
  };

  addDirContents(r('server', 'data'), r('data', 'simklinik'));
  addDirContents(r('portal', 'identity-service', 'data'), r('data', 'identity'), (n) => n !== 'service-keys');
  addDirContents(r('portal', 'identity-service', 'data', 'service-keys'), r('secrets', 'service-keys'));
  addDirContents(r('backups'), r('data', 'backups'));

  moves.push([r('server', 'google-credentials.json'), r('secrets', 'google-credentials.json')]);
  moves.push([r('google-credentials.json'), r('secrets', 'google-credentials-baru.json')]);
  moves.push([r('server', '.identity-key'), r('apps', 'simklinik-api', '.identity-key')]);

  moves.push([r('server', 'node_modules'), r('apps', 'simklinik-api', 'node_modules')]);
  moves.push([r('client', 'node_modules'), r('apps', 'simklinik-web', 'node_modules')]);
  moves.push([r('portal', 'portal-dashboard', 'node_modules'), r('apps', 'portal', 'node_modules')]);
  moves.push([r('portal', 'identity-service', 'node_modules'), r('services', 'identity', 'node_modules')]);

  return moves.filter(([from]) => fs.existsSync(from));
}

// Isi folder lama yang boleh dibuang setelah pemindahan: semuanya bisa dibuat
// ulang (build, cache, penanda mode). Selain ini, folder lama dibiarkan dan
// dilaporkan agar diperiksa manual.
const DISPOSABLE = new Set(['dist', 'dist-dev', '.next', '.next-dev', '.env.local', 'tsconfig.tsbuildinfo', 'next-env.d.ts', 'data', 'service-keys']);

function isDisposableTree(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (DISPOSABLE.has(name) && !['data', 'service-keys'].includes(name)) continue;
      if (!isDisposableTree(full)) return false;
    } else if (!DISPOSABLE.has(name)) {
      return false;
    }
  }
  return true;
}

async function main() {
  console.log(`\nMigrasi struktur folder${dryRun ? ' (DRY-RUN, tidak ada yang diubah)' : ''}\n`);

  if (!fs.existsSync(r('apps', 'simklinik-api', 'package.json'))) {
    console.error('[GAGAL] apps/simklinik-api tidak ada. Checkout branch struktur baru lebih dulu.');
    process.exit(1);
  }

  // Database yang sedang dibuka proses lain tidak boleh dipindah.
  const allPorts = [...Object.values(PORTS.prod), ...Object.values(PORTS.dev)];
  const busy = [];
  for (const port of allPorts) if (await portInUse(port)) busy.push(port);
  if (busy.length > 0) {
    const message = `Port ${busy.join(', ')} masih dipakai. Tutup semua jendela aplikasi klinik lalu ulangi.`;
    if (!dryRun) {
      console.error(`[GAGAL] ${message}`);
      process.exit(1);
    }
    console.warn(`[PERINGATAN] ${message}\n`);
  }

  const moves = plan();
  const conflicts = moves.filter(([, to]) => fs.existsSync(to));
  if (conflicts.length > 0) {
    console.error('[GAGAL] Tujuan berikut sudah ada. Tidak ada yang dipindah agar tidak menimpa data:');
    for (const [from, to] of conflicts) console.error(`  ${rel(from)} -> ${rel(to)}`);
    process.exit(1);
  }

  if (moves.length === 0) {
    console.log('Tidak ada yang perlu dipindah; struktur sudah baru.');
  }

  // Salinan pengaman database sebelum dipindah. Pemindahan di disk yang sama
  // hanya mengganti nama, tapi salinan ini menjamin data utuh bila terputus.
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const safetyDir = r('data', 'backups', `sebelum-restruktur-${stamp}`);
  const dbFiles = moves.filter(([from]) => /\.sqlite(-wal|-shm)?$/.test(from) && !rel(from).startsWith('backups'));
  console.log(`Salinan pengaman: ${dbFiles.length} file database -> ${rel(safetyDir)}`);
  if (!dryRun && dbFiles.length > 0) {
    fs.mkdirSync(safetyDir, { recursive: true });
    for (const [from] of dbFiles) {
      const tag = rel(from).startsWith('server') ? 'simklinik' : 'identity';
      fs.copyFileSync(from, path.join(safetyDir, `${tag}-${path.basename(from)}`));
    }
  }

  console.log('\nPemindahan:');
  for (const [from, to] of moves) {
    console.log(`  ${rel(from)} -> ${rel(to)}`);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
    }
  }

  console.log('\nFolder lama:');
  for (const dir of [r('server'), r('client'), r('portal'), r('backups')]) {
    if (!fs.existsSync(dir)) continue;
    if (dryRun) {
      console.log(`  ${rel(dir)}: diperiksa setelah pemindahan`);
    } else if (isDisposableTree(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`  ${rel(dir)}: dihapus (hanya berisi hasil build)`);
    } else {
      console.log(`  ${rel(dir)}: DIBIARKAN, masih ada file selain hasil build. Periksa manual.`);
    }
  }

  console.log(dryRun ? '\nDry-run selesai.\n' : '\nMigrasi selesai. Jalankan JALANKAN.bat; build yang hilang dibuat ulang otomatis.\n');
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
