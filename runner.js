// runner.js - Unified Application Launcher for SIMKlinik
// Mode:
//   node runner.js           -> PRODUCTION (port 8080 / 4000, database production)
//   node runner.js --dev     -> DEVELOPMENT (port 8081 / 4001, database terpisah, fast refresh)
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const http = require('http');
const fs = require('fs');

// Mode dev dijalankan berdampingan dengan web production yang sedang melayani pasien,
// jadi port dan file database sengaja berbeda.
const MODES = {
  prod: {
    label: 'PRODUCTION',
    backendPort: 4000,
    frontendPort: 8080,
    nextMode: 'start',
    dbFile: path.join(__dirname, 'server', 'data', 'vaksinku.sqlite'),
    // distDir Next.js harus berupa path relatif terhadap folder client
    nextDir: '.next',
    envMarker: null,
    // Layanan identitas (portal/identity-service). Dijalankan lebih dulu dari
    // backend SIMKlinik karena mode gagal cepat: tanpa layanan ini, pendaftaran
    // pasien tidak bisa dilayani.
    identityPort: 4010,
    identityEnvMarker: null,
    // Portal dashboard. Hanya dipakai sebagai alamat tujuan tombol "Portal"
    // dan penukaran tiket SSO; portalnya dinyalakan lewat portal/runner.js.
    portalPort: 8082,
  },
  dev: {
    label: 'DEVELOPMENT',
    backendPort: 4001,
    frontendPort: 8081,
    nextMode: 'dev',
    dbFile: path.join(__dirname, 'server', 'data', 'vaksinku-dev.sqlite'),
    nextDir: '.next-dev',
    envMarker: path.join(__dirname, 'server', '.env.local'),
    identityPort: 4011,
    identityEnvMarker: path.join(__dirname, 'portal', 'identity-service', '.env.local'),
    portalPort: 8083,
  },
};

const isDev = process.argv.includes('--dev') || process.env.MODE === 'dev';
const MODE = isDev ? MODES.dev : MODES.prod;
const BACKEND_PORT = MODE.backendPort;
const FRONTEND_PORT = MODE.frontendPort;
const USE_COLOR = process.stdout.isTTY;
const color = (code, text) => (USE_COLOR ? `\x1b[${code}m${text}\x1b[0m` : text);
const cyan = (t) => color('36', t);
const yellow = (t) => color('33', t);
const green = (t) => color('32', t);
const red = (t) => color('31', t);

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

function isPortInUse(port, healthPath = '/api/auth/profile') {
  const { promise, resolve } = Promise.withResolvers();
  const req = http.get(`http://127.0.0.1:${port}${healthPath}`, (res) => {
    res.resume();
    resolve(true);
  });
  req.on('error', () => resolve(false));
  req.setTimeout(1500, () => {
    req.destroy();
    resolve(false);
  });
  return promise;
}

function checkPortReady(port, timeoutMs = 15000, healthPath = '/api/auth/profile') {
  const { promise, resolve } = Promise.withResolvers();
  const startTime = Date.now();

  const interval = setInterval(() => {
    const req = http.get(`http://127.0.0.1:${port}${healthPath}`, (res) => {
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
  logBanner(
    isDev
      ? cyan('SIMKLINIK - MODE DEVELOPMENT (TERPISAH DARI WEB PRODUCTION)')
      : green('SIMKLINIK - MODE PRODUCTION - KLINIK UTAMA DR. H. A. ROTINSULU CIANJUR'),
    isDev
      ? [
          `Frontend dev : http://localhost:${FRONTEND_PORT}`,
          `Backend dev  : http://localhost:${BACKEND_PORT}`,
          'Database     : server/data/vaksinku-dev.sqlite (terpisah dari production)',
          'Web production di port 8080 tetap berjalan dan tidak terpengaruh.',
        ]
      : [
          'Sistem Informasi Manajemen Pelayanan Klinik (Vaksinasi, ICV, MCU & Layanan Medis)',
          'Menyiapkan lingkungan aplikasi...',
        ]
  );

  // 1. Bersihkan port milik mode ini saja (mode lain dibiarkan berjalan).
  // Layanan identitas diperiksa lebih dulu: bila sudah berjalan, portnya tidak
  // boleh dibersihkan — bisa jadi portal/runner.js yang menjalankannya, dan
  // mematikannya akan memutus portal beserta aplikasi lain yang sedang dipakai.
  const identityAlreadyRunning =
    process.env.IDENTITY_ALREADY_RUNNING === '1' || (await isPortInUse(MODE.identityPort, '/api/health'));

  console.log(`[1/5] Memeriksa port ${FRONTEND_PORT}, ${BACKEND_PORT}, dan ${MODE.identityPort}...`);
  killPortProcess(FRONTEND_PORT);
  killPortProcess(BACKEND_PORT);
  if (identityAlreadyRunning) {
    console.log(`      [INFO] Layanan identitas sudah berjalan di port ${MODE.identityPort}. Tidak akan diganggu.`);
  } else {
    killPortProcess(MODE.identityPort);
  }
  if (!isDev) {
    // Konfirmasi mode dev tidak ikut terbawa saat start production
    const devBackendAlive = await isPortInUse(MODES.dev.backendPort);
    if (devBackendAlive) {
      console.log(`      [INFO] Mode development masih berjalan di port ${MODES.dev.frontendPort}/${MODES.dev.backendPort}.`);
    }
  } else {
    const prodBackendAlive = await isPortInUse(MODES.prod.backendPort);
    console.log(
      prodBackendAlive
        ? yellow(`      [INFO] Web production aktif di port ${MODES.prod.frontendPort}. Tidak akan diganggu.`)
        : yellow('      [INFO] Web production tidak sedang berjalan.')
    );
  }
  console.log(`      [OK] Port ${FRONTEND_PORT}, ${BACKEND_PORT}, dan ${MODE.identityPort} siap digunakan.\n`);

  const serverDir = path.join(__dirname, 'server');
  const clientDir = path.join(__dirname, 'client');
  const identityDir = path.join(__dirname, 'portal', 'identity-service');

  // Penanda mode untuk DatabaseService: ada = development (vaksinku-dev.sqlite),
  // tidak ada = production (vaksinku.sqlite). Hanya dibaca backend, bukan Next.js.
  if (MODE.envMarker) {
    if (!fs.existsSync(MODE.envMarker)) {
      fs.writeFileSync(MODE.envMarker, '# Dibuat otomatis oleh runner.js untuk mode development\n');
    }
  } else if (fs.existsSync(MODES.dev.envMarker)) {
    // Mode production: penanda development harus dihapus, jika tidak backend akan
    // memakai vaksinku-dev.sqlite dan melewati pembersihan data demo.
    fs.unlinkSync(MODES.dev.envMarker);
    console.log('      [OK] Penanda mode development dihapus; backend memakai database production.');
  }

  // Penanda yang sama berlaku untuk layanan identitas. Penanda tertinggal di
  // mode production membuat pasien baru masuk ke identity-dev.sqlite tanpa
  // ada yang menyadari, jadi harus dihapus di sini juga.
  if (MODE.identityEnvMarker) {
    if (!fs.existsSync(MODE.identityEnvMarker)) {
      fs.writeFileSync(MODE.identityEnvMarker, '# Dibuat otomatis oleh runner.js untuk mode development\n');
    }
  } else if (fs.existsSync(MODES.dev.identityEnvMarker)) {
    fs.unlinkSync(MODES.dev.identityEnvMarker);
    console.log('      [OK] Penanda development layanan identitas dihapus; memakai identity.sqlite.');
  }

  // Pastikan dependensi terpasang
  if (!fs.existsSync(path.join(serverDir, 'node_modules'))) {
    console.log('      [SETUP] Dependensi backend belum terpasang. Menjalankan npm install...');
    execSync('npm install', { cwd: serverDir, stdio: 'inherit' });
  }
  if (!fs.existsSync(path.join(clientDir, 'node_modules'))) {
    console.log('      [SETUP] Dependensi frontend belum terpasang. Menjalankan npm install...');
    execSync('npm install', { cwd: clientDir, stdio: 'inherit' });
  }
  if (!fs.existsSync(path.join(identityDir, 'node_modules'))) {
    console.log('      [SETUP] Dependensi layanan identitas belum terpasang. Menjalankan npm install...');
    execSync('npm install', { cwd: identityDir, stdio: 'inherit' });
  }

  // 1b. Bila layanan identitas sudah berjalan (mis. dinyalakan portal/runner.js),
  // jangan menyalakan instance kedua: dua instance pada satu file SQLite tidak
  // aman, dan instance kedua akan mematikannya saat membersihkan port.
  let identity = null;

  if (identityAlreadyRunning) {
    console.log(`[2/5] Layanan Identitas sudah berjalan di port ${MODE.identityPort} (tidak dijalankan ulang).\n`);
  } else {
    // 2. Layanan identitas harus hidup lebih dulu. Backend SIMKlinik memakai mode
    // gagal cepat, jadi tanpa langkah ini pendaftaran pasien akan langsung gagal.
    console.log('[2/5] Menjalankan Layanan Identitas (port ' + MODE.identityPort + ')...');
    identity = spawn(
      process.execPath,
      ['node_modules/ts-node/dist/bin.js', path.join(identityDir, 'src', 'main.ts')],
      {
        cwd: identityDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PORT: String(MODE.identityPort) },
      }
    );

    identity.stdout.on('data', (d) => {
      const str = d.toString();
      if (str.includes('Layanan Identitas SIMKlinik Aktif')) {
        process.stdout.write(`      [OK] ${str.trim()}\n`);
      }
    });
    identity.stderr.on('data', (d) => {
      const str = d.toString();
      if (!str.includes('ExperimentalWarning')) {
        process.stderr.write(`      [Identity Log]: ${str}`);
      }
    });

    const isIdentityReady = await checkPortReady(MODE.identityPort, isDev ? 40000 : 20000, '/api/health');
    if (!isIdentityReady) {
      console.error(`      [GAGAL] Layanan identitas tidak siap di port ${MODE.identityPort}.`);
      console.error('      Backend SIMKlinik tidak dijalankan karena pendaftaran pasien butuh layanan ini.');
      identity.kill();
      killPortProcess(MODE.identityPort);
      process.exit(1);
    }
    console.log(`      [OK] Layanan identitas aktif pada port ${MODE.identityPort}.\n`);
  }

  // 3. Jalankan Backend NestJS
  console.log('[3/5] Menjalankan Backend Service (NestJS)...');
  const serverDist = path.join(serverDir, 'dist', 'main.js');
  const backendEntry = isDev || !fs.existsSync(serverDist) ? null : serverDist;
  if (!backendEntry) {
    console.log('      [INFO] Menjalankan backend dari source (ts-node), tanpa menyentuh dist production.');
  }
  const backend = spawn(
    process.execPath,
    backendEntry
      ? [backendEntry]
      : ['node_modules/ts-node/dist/bin.js', path.join(serverDir, 'src', 'main.ts')],
    {
      cwd: serverDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
        NODE_ENV: isDev ? 'development' : 'production',
        // Backend membaca alamat ini untuk memanggil layanan identitas.
        IDENTITY_SERVICE_URL: `http://127.0.0.1:${MODE.identityPort}`,
      },
    }
  );

  backend.stdout.on('data', (d) => {
    const str = d.toString();
    if (str.includes('Backend SIMKlinik Server Aktif') || str.includes('Nest application successfully started')) {
      process.stdout.write(`      [OK] ${str.trim()}\n`);
    }
    if (isDev && (str.includes('Error') || str.includes('error TS'))) {
      process.stdout.write(`${red('      [Backend Log]: ')}${str}`);
    }
  });
  backend.stderr.on('data', (d) => {
    const str = d.toString();
    if (!str.includes('ExperimentalWarning') && !str.includes('keyFilename')) {
      process.stderr.write(`      [Backend Log]: ${str}`);
    }
  });

  // Tunggu backend siap
  const isBackendReady = await checkPortReady(BACKEND_PORT, isDev ? 40000 : 15000);
  if (!isBackendReady) {
    console.warn('      [PERINGATAN] Backend memerlukan waktu lebih lama untuk inisialisasi.');
    if (isDev) {
      console.warn('      [PERINGATAN] Cek log TypeScript di atas bila ada error kompilasi.');
    }
  } else {
    console.log(`      [OK] Backend Service aktif pada port ${BACKEND_PORT}.\n`);
  }

  // 3. Ambil IP Jaringan LAN
  const lanIps = getLocalIpAddresses();
  const primaryIp = lanIps[0] || '127.0.0.1';

  // 4. Jalankan Frontend Next.js
  console.log(`[4/5] Menjalankan Frontend Web Portal (Next.js - Mode: ${MODE.nextMode.toUpperCase()})...`);
  if (isDev) {
    console.log('      [FITUR AKTIF] Fast Refresh / Auto-Reload saat edit file .tsx aktif!');
  } else {
    const clientBuildId = path.join(clientDir, MODE.nextDir, 'BUILD_ID');
    if (!fs.existsSync(clientBuildId)) {
      console.log('      [BUILD] Build produksi Next.js belum ada.');
      console.log('      [BUILD] Menjalankan kompilasi frontend (npm run build)...');
      execSync('npm run build', {
        cwd: clientDir,
        stdio: 'inherit',
        env: { ...process.env, NEXT_DIST_DIR: MODE.nextDir },
      });
      console.log('      [OK] Kompilasi frontend selesai.\n');
    }
  }

  const nextBin = path.join(clientDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  const frontend = spawn(
    process.execPath,
    [nextBin, MODE.nextMode, '-H', '0.0.0.0', '-p', String(FRONTEND_PORT)],
    {
      cwd: clientDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        BACKEND_PORT: String(BACKEND_PORT),
        PORT: String(FRONTEND_PORT),
        NEXT_DIST_DIR: MODE.nextDir,
        // Dipakai halaman /sso dan route /api/sso/redeem: alamat portal tujuan
        // penukaran tiket, dan port layanan identitas untuk mengambil profil
        // akun portal.
        PORTAL_URL: `http://127.0.0.1:${MODE.portalPort}`,
        IDENTITY_PORT: String(MODE.identityPort),
      },
    }
  );

  // 5. Tampilkan Banner Akses
  setTimeout(() => {
    logBanner(
      isDev
        ? cyan('SIMKLINIK MODE DEVELOPMENT BERHASIL DIJALANKAN')
        : green('APLIKASI SIMKLINIK ROTINSULU BERHASIL DIJALANKAN!'),
      [
        `Mode: ${MODE.label}`,
        `Akses dari Komputer Ini:`,
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
        isDev
          ? `Database: server/data/vaksinku-dev.sqlite (web production tidak tersentuh)`
          : `Database: server/data/vaksinku.sqlite`,
        `Database identitas: portal/identity-service/data/${isDev ? 'identity-dev' : 'identity'}.sqlite`,
        ``,
        `Layanan Identitas (dipakai bersama semua app klinik):`,
        `  -> http://localhost:${MODE.identityPort}/api/health`,
        ``,
        `Portal Dashboard (pintu masuk semua aplikasi klinik):`,
        `  -> http://localhost:${MODE.portalPort}`,
        `     Dinyalakan lewat portal/runner.js. Bila belum berjalan, tombol`,
        `     "Portal SIMKlinik" di sidebar tidak muncul dan staf tetap bisa`,
        `     login langsung seperti biasa.`,
        ``,
        `Tekan CTRL + C di jendela ini untuk mematikan aplikasi ${MODE.label}.`,
      ]
    );

    console.log('[5/5] Membuka peramban browser otomatis...');
    openBrowser(`http://localhost:${FRONTEND_PORT}/login`);
  }, 1500);

  // Clean exit handlers
  function cleanup() {
    console.log(`\n[INFO] Menghentikan seluruh service SIMKlinik (${MODE.label})...`);
    try {
      backend.kill();
      frontend.kill();
      // Hanya hentikan layanan identitas bila jendela ini yang menjalankannya.
      // Bila portal/runner.js yang menyalakannya, mematikannya di sini akan
      // memutus portal dan aplikasi lain yang sedang dipakai.
      if (identity) identity.kill();
    } catch {}
    killPortProcess(FRONTEND_PORT);
    killPortProcess(BACKEND_PORT);
    if (identity) killPortProcess(MODE.identityPort);
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  backend.on('exit', () => cleanup());
  frontend.on('exit', () => cleanup());
  if (identity) identity.on('exit', () => cleanup());
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
