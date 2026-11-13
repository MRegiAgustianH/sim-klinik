// runner.js - Unified Application Launcher for VaksinKU
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const http = require('http');
const fs = require('fs');

const BACKEND_PORT = 4000;
const FRONTEND_PORT = 8080;

function logBanner(title, lines = []) {
  console.log('\n====================================================================');
  console.log(`  ${title}`);
  console.log('====================================================================');
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log('====================================================================\n');
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
          addresses.push(net.address);
        }
      }
    }
  }
  return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

function killPortProcess(port) {
  try {
    if (process.platform === 'win32') {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { stdio: 'ignore' }
      );
    }
  } catch {
    // ignore
  }
}

function checkPortReady(port, timeoutMs = 15000) {
  const { promise, resolve } = Promise.withResolvers();
  const startTime = Date.now();

  const interval = setInterval(() => {
    const req = http.get(`http://127.0.0.1:${port}/api/auth/profile`, (res) => {
      res.resume();
      clearInterval(interval);
      resolve(true);
    });

    req.on('error', () => {
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    });
  }, 400);

  return promise;
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }
  } catch {
    // fallback
  }
}

async function main() {
  logBanner('SIMKLINIK - KLINIK UTAMA DR. H. A. ROTINSULU CIANJUR', [
    'Sistem Informasi Manajemen Pelayanan Klinik (Vaksinasi, ICV, MCU & Layanan Medis)',
    'Menyiapkan lingkungan aplikasi...'
  ]);

  // 1. Bersihkan port jika ada proses yang menggantung
  console.log('[1/4] Memeriksa dan membersihkan port 8080 dan 4000...');
  killPortProcess(FRONTEND_PORT);
  killPortProcess(BACKEND_PORT);
  console.log('      [OK] Port 8080 dan 4000 bersih dan siap digunakan.\n');
  const serverDir = path.join(__dirname, 'server');
  const clientDir = path.join(__dirname, 'client');

  // Pastikan dependensi terpasang
  if (!fs.existsSync(path.join(serverDir, 'node_modules'))) {
    console.log('      [SETUP] Dependensi backend belum terpasang. Menjalankan npm install...');
    execSync('npm install', { cwd: serverDir, stdio: 'inherit' });
  }
  if (!fs.existsSync(path.join(clientDir, 'node_modules'))) {
    console.log('      [SETUP] Dependensi frontend belum terpasang. Menjalankan npm install...');
    execSync('npm install', { cwd: clientDir, stdio: 'inherit' });
  }

  // Pastikan backend sudah ter-build
  const serverDist = path.join(serverDir, 'dist', 'main.js');
  if (!fs.existsSync(serverDist)) {
    console.log('      [BUILD] Mengompilasi backend NestJS (npm run build)...');
    execSync('npm run build', { cwd: serverDir, stdio: 'inherit' });
  }

  // 2. Jalankan Backend NestJS
  console.log('[2/4] Menjalankan Backend Service (NestJS)...');
  const backend = spawn(process.execPath, ['dist/main.js'], {
    cwd: serverDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(BACKEND_PORT) },
  });

  backend.stdout.on('data', (d) => {
    const str = d.toString();
    if (str.includes('Backend SIMKlinik Server Aktif') || str.includes('Backend VaksinKU Server Aktif') || str.includes('Nest application successfully started')) {
      process.stdout.write(`      [OK] ${str.trim()}\n`);
    }
  });
  backend.stderr.on('data', (d) => {
    const str = d.toString();
    if (!str.includes('ExperimentalWarning') && !str.includes('keyFilename')) {
      process.stderr.write(`      [Backend Log]: ${str}`);
    }
  });

  // Tunggu backend siap
  const isBackendReady = await checkPortReady(BACKEND_PORT);
  if (!isBackendReady) {
    console.warn('      [PERINGATAN] Backend memerlukan waktu lebih lama untuk inisialisasi.');
  } else {
    console.log('      [OK] Backend Service aktif pada port 4000.\n');
  }

  // 3. Ambil IP Jaringan LAN
  const lanIps = getLocalIpAddresses();
  const primaryIp = lanIps[0] || '127.0.0.1';

  // 4. Jalankan Frontend Next.js (Dukungan Mode Dev / Prod)
  const isDev = process.argv.includes('--dev') || process.env.MODE === 'dev';
  const nextMode = isDev ? 'dev' : 'start';
  console.log(`[3/4] Menjalankan Frontend Web Portal (Next.js - Mode: ${nextMode.toUpperCase()})...`);
  if (isDev) {
    console.log('      [FITUR AKTIF] Fast Refresh / Auto-Reload saat edit file .tsx aktif!');
  }
  const clientBuildId = path.join(clientDir, '.next', 'BUILD_ID');
  if (nextMode === 'start' && !fs.existsSync(clientBuildId)) {
    console.log('      [BUILD] Build produksi Next.js belum ada / ditimpa mode dev.');
    console.log('      [BUILD] Menjalankan kompilasi frontend (npm run build)...');
    execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });
    console.log('      [OK] Kompilasi frontend selesai.\n');
  }

  const nextBin = path.join(clientDir, 'node_modules', 'next', 'dist', 'bin', 'next');

  const frontend = spawn(process.execPath, [nextBin, nextMode, '-H', '0.0.0.0', '-p', String(FRONTEND_PORT)], {
    cwd: clientDir,
    stdio: 'inherit',
  });
  // 5. Tampilkan Banner Akses
  setTimeout(() => {
    logBanner('APLIKASI SIMKLINIK ROTINSULU BERHASIL DIJALANKAN!', [
      `Akses dari Komputer Ini (Server):`,
      `  -> http://localhost:${FRONTEND_PORT}`,
      ``,
      `Akses dari Komputer/Tablet Lain dalam SATU JARINGAN (LAN / Wi-Fi):`,
      `  -> http://${primaryIp}:${FRONTEND_PORT}`,
      ``,
      `Akun Login Staf Klinik:`,
      `  - Superadmin : Username: superadmin  | Password: admin123`,
      `  - Dokter     : Username: dokter      | Password: dokter123`,
      `  - Perawat    : Username: perawat     | Password: perawat123`,
      ``,
      `Tekan CTRL + C di jendela ini untuk mematikan seluruh aplikasi.`
    ]);

    console.log('[4/4] Membuka peramban browser otomatis...');
    openBrowser(`http://localhost:${FRONTEND_PORT}/login`);
  }, 1500);

  // Clean exit handlers
  function cleanup() {
    console.log('\n[INFO] Menghentikan seluruh service SIMKlinik...');
    try {
      backend.kill();
      frontend.kill();
    } catch {}
    killPortProcess(FRONTEND_PORT);
    killPortProcess(BACKEND_PORT);
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  backend.on('exit', () => cleanup());
  frontend.on('exit', () => cleanup());
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
