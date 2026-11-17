// portal/runner.js — Launcher terpadu seluruh aplikasi klinik
//
// Mode:
//   node runner.js                    -> PORTAL saja (identity + dashboard portal)
//   node runner.js --with-simklinik   -> PORTAL + SIMKlinik (vaksinasi/ICV/MCU)
//   node runner.js --dev              -> mode development (port & database terpisah)
//
// SIMKlinik sudah punya launcher sendiri (runner.js di root). Flag
// --with-simklinik disediakan agar seluruh sistem bisa dinyalakan dari satu
// jendela; menjalankannya lewat runner.js root tetap sah dan menghasilkan
// port yang sama.
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const http = require('http');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

const MODES = {
  prod: {
    label: 'PRODUCTION',
    identityPort: 4010,
    portalPort: 8082,
    nextMode: 'start',
    nextDir: '.next',
    envMarker: null,
    simklinikFrontend: 8080,
    simklinikBackend: 4000,
  },
  dev: {
    label: 'DEVELOPMENT',
    identityPort: 4011,
    portalPort: 8083,
    nextMode: 'dev',
    nextDir: '.next-dev',
    envMarker: path.join(__dirname, 'identity-service', '.env.local'),
    simklinikFrontend: 8081,
    simklinikBackend: 4001,
  },
};

const isDev = process.argv.includes('--dev') || process.env.MODE === 'dev';
const withSimklinik = process.argv.includes('--with-simklinik');
const MODE = isDev ? MODES.dev : MODES.prod;

const USE_COLOR = process.stdout.isTTY;
const color = (code, text) => (USE_COLOR ? `\x1b[${code}m${text}\x1b[0m` : text);
const cyan = (t) => color('36', t);
const yellow = (t) => color('33', t);
const green = (t) => color('32', t);
const red = (t) => color('31', t);

const identityDir = path.join(__dirname, 'identity-service');
const portalDir = path.join(__dirname, 'portal-dashboard');
const children = [];

function logBanner(title, lines = []) {
  console.log('\n====================================================================');
  console.log(`  ${title}`);
  console.log('====================================================================');
  for (const line of lines) console.log(`  ${line}`);
  console.log('====================================================================\n');
}

function getLocalIpAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        addresses.push(net.address);
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
    // Port memang sudah bebas.
  }
}

function checkPortReady(port, timeoutMs, healthPath = '/api/health') {
  const { promise, resolve } = Promise.withResolvers();
  const startedAt = Date.now();

  const interval = setInterval(() => {
    const req = http.get(`http://127.0.0.1:${port}${healthPath}`, (res) => {
      res.resume();
      clearInterval(interval);
      resolve(true);
    });
    req.on('error', () => {
      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    });
  }, 400);

  return promise;
}

function openBrowser(url) {
  try {
    if (process.platform === 'win32') execSync(`start "" "${url}"`, { stdio: 'ignore' });
    else if (process.platform === 'darwin') execSync(`open "${url}"`, { stdio: 'ignore' });
    else execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
  } catch {
    // Browser tidak wajib terbuka.
  }
}

function spawnTracked(label, command, args, options, readyPattern) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });

  // Pemanggil boleh memakai stdio 'inherit' (mis. Next.js yang ingin menulis
  // langsung ke terminal). Saat itu child.stdout bernilai null, jadi listener
  // hanya dipasang bila stream-nya memang ada.
  child.stdout?.on('data', (data) => {
    const text = data.toString();
    if (!readyPattern || text.includes(readyPattern)) {
      process.stdout.write(`      [${label}] ${text.trim()}\n`);
    }
  });
  child.stderr?.on('data', (data) => {
    const text = data.toString();
    if (!text.includes('ExperimentalWarning')) {
      process.stderr.write(`${red(`      [${label}]`)} ${text}`);
    }
  });

  children.push({ label, child });
  return child;
}

async function main() {
  logBanner(
    isDev ? cyan('PORTAL SIMKLINIK - MODE DEVELOPMENT') : green('PORTAL SIMKLINIK - MODE PRODUCTION'),
    [
      `Portal dashboard : http://localhost:${MODE.portalPort}`,
      `Layanan identitas: http://localhost:${MODE.identityPort}`,
      `Database         : portal/identity-service/data/identity${isDev ? '-dev' : ''}.sqlite`,
      isDev
        ? `SIMKlinik dev    : http://localhost:${MODE.simklinikFrontend} (jalankan MODE_PENGEMBANGAN_DEV.bat)`
        : `SIMKlinik        : http://localhost:${MODE.simklinikFrontend}${withSimklinik ? ' (dinyalakan skrip ini)' : ' (jalankan JALANKAN_APLIKASI.bat)'}`,
    ]
  );

  // 1. Bersihkan port milik mode ini
  console.log(`[1/5] Memeriksa port ${MODE.identityPort} dan ${MODE.portalPort}...`);
  killPortProcess(MODE.identityPort);
  killPortProcess(MODE.portalPort);
  console.log(`      [OK] Port ${MODE.identityPort} dan ${MODE.portalPort} siap digunakan.\n`);

  // Penanda mode: ada .env.local = development. Penanda tertinggal di mode
  // production membuat data pasien masuk ke database dev tanpa disadari.
  if (MODE.envMarker) {
    if (!fs.existsSync(MODE.envMarker)) {
      fs.writeFileSync(MODE.envMarker, '# Dibuat otomatis oleh portal/runner.js untuk mode development\n');
    }
  } else if (fs.existsSync(MODES.dev.envMarker)) {
    fs.unlinkSync(MODES.dev.envMarker);
    console.log('      [OK] Penanda development dihapus; memakai identity.sqlite.\n');
  }

  // 2. Dependensi
  for (const [label, dir] of [
    ['layanan identitas', identityDir],
    ['portal dashboard', portalDir],
  ]) {
    if (!fs.existsSync(path.join(dir, 'node_modules'))) {
      console.log(`      [SETUP] Dependensi ${label} belum terpasang. Menjalankan npm install...`);
      execSync('npm install', { cwd: dir, stdio: 'inherit' });
    }
  }

  // 3. Layanan identitas lebih dulu: portal tidak bisa login tanpa layanan ini.
  console.log(`[2/5] Menjalankan Layanan Identitas (port ${MODE.identityPort})...`);
  spawnTracked(
    'Identity',
    process.execPath,
    ['node_modules/ts-node/dist/bin.js', path.join(identityDir, 'src', 'main.ts')],
    { cwd: identityDir, env: { ...process.env, PORT: String(MODE.identityPort) } },
    'Layanan Identitas SIMKlinik Aktif'
  );

  const identityReady = await checkPortReady(MODE.identityPort, isDev ? 40000 : 20000);
  if (!identityReady) {
    console.error(`      [GAGAL] Layanan identitas tidak siap di port ${MODE.identityPort}.`);
    cleanup(1);
  }
  console.log(`      [OK] Layanan identitas aktif.\n`);

  // 4. Kunci antar-layanan. Portal butuh kuncinya untuk menukar token menjadi
  // token aplikasi; SIMKlinik butuh kuncinya untuk menukar tiket SSO. Kunci
  // dibaca aplikasi langsung dari folder data layanan identitas, jadi tidak ada
  // salinan ke variabel lingkungan yang bisa basi saat kunci dibuat ulang.
  const suffix = isDev ? '-dev' : '';
  const keyDir = path.join(identityDir, 'data', 'service-keys');
  const keys = [
    ['portal', 'portal --portal'],
    ['simklinik', 'simklinik'],
  ];
  console.log('[3/5] Memeriksa service key antar-layanan...');
  for (const [name, command] of keys) {
    if (!fs.existsSync(path.join(keyDir, `${name}${suffix}.key`))) {
      console.log(`      [SETUP] Membuat service key ${name}...`);
      execSync(`npm run generate-key -- ${command}`, { cwd: identityDir, stdio: 'inherit' });
    }
  }
  console.log(`      [OK] Service key tersedia di ${path.relative(ROOT, keyDir)}.\n`);

  // 5. Portal dashboard
  console.log(`[4/5] Menjalankan Portal Dashboard (Next.js - ${MODE.nextMode.toUpperCase()})...`);
  if (!isDev) {
    const buildId = path.join(portalDir, MODE.nextDir, 'BUILD_ID');
    if (!fs.existsSync(buildId)) {
      console.log('      [BUILD] Build produksi portal belum ada. Menjalankan npm run build...');
      execSync('npm run build', {
        cwd: portalDir,
        stdio: 'inherit',
        env: { ...process.env, NEXT_DIST_DIR: MODE.nextDir },
      });
      console.log('      [OK] Build portal selesai.\n');
    }
  }

  spawnTracked(
    'Portal',
    process.execPath,
    [
      path.join(portalDir, 'node_modules', 'next', 'dist', 'bin', 'next'),
      MODE.nextMode,
      '-H',
      '0.0.0.0',
      '-p',
      String(MODE.portalPort),
    ],
    {
      cwd: portalDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: String(MODE.portalPort),
        NEXT_DIST_DIR: MODE.nextDir,
        IDENTITY_PORT: String(MODE.identityPort),
        IDENTITY_MODE: isDev ? 'development' : 'production',
      },
    }
  );

  // 6. SIMKlinik opsional. Launcher SIMKlinik memakai port layanan identitas
  // dari modenya sendiri (prod 4010 / dev 4011) — sengaja sama dengan portal,
  // jadi tidak perlu diteruskan. Yang diteruskan hanya alamat portal untuk
  // penukaran tiket SSO, dan penanda bahwa layanan identitas sudah berjalan
  // agar launcher SIMKlinik tidak menyalakan instance kedua di file SQLite
  // yang sama.
  if (withSimklinik) {
    console.log('      [INFO] Menyalakan SIMKlinik...');
    const simklinik = spawn(process.execPath, [path.join(ROOT, 'runner.js'), ...(isDev ? ['--dev'] : [])], {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        PORTAL_URL: `http://127.0.0.1:${MODE.portalPort}`,
        IDENTITY_ALREADY_RUNNING: '1',
      },
    });
    children.push({ label: 'SIMKlinik', child: simklinik });
  }

  const lanIps = getLocalIpAddresses();
  const primaryIp = lanIps[0] || '127.0.0.1';

  setTimeout(() => {
    logBanner(
      isDev ? cyan('PORTAL SIMKLINIK MODE DEVELOPMENT BERJALAN') : green('PORTAL SIMKLINIK BERJALAN'),
      [
        `Mode: ${MODE.label}`,
        '',
        'Portal Dashboard (pintu masuk semua aplikasi):',
        `  Komputer ini   -> http://localhost:${MODE.portalPort}`,
        `  Jaringan LAN   -> http://${primaryIp}:${MODE.portalPort}`,
        '',
        withSimklinik ? 'SIMKlinik (aplikasi pelayanan):' : null,
        withSimklinik ? `  Komputer ini   -> http://localhost:${MODE.simklinikFrontend}` : null,
        withSimklinik ? `  Jaringan LAN   -> http://${primaryIp}:${MODE.simklinikFrontend}` : null,
        withSimklinik ? null : 'SIMKlinik TIDAK dinyalakan. Jalankan JALANKAN_PORTAL.bat untuk seluruh sistem.',
        '',
        'Layanan Identitas (dipakai bersama semua aplikasi):',
        `  -> http://localhost:${MODE.identityPort}/api/health`,
        '',
        'Akun Login (satu akun untuk portal dan SIMKlinik):',
        '  - Superadmin : superadmin / admin123',
        '  - Dokter     : dokter     / dokter123',
        '  - Perawat    : perawat    / perawat123',
        '',
        `Database identitas: portal/identity-service/data/identity${isDev ? '-dev' : ''}.sqlite`,
        '',
        `Tekan CTRL + C untuk mematikan seluruh layanan ${MODE.label}.`,
      ].filter((line) => line !== null)
    );

    console.log('[5/5] Membuka peramban browser otomatis...');
    openBrowser(`http://localhost:${MODE.portalPort}/login`);
  }, 1500);

  function cleanup(exitCode = 0) {
    console.log(`\n[INFO] Menghentikan seluruh layanan portal (${MODE.label})...`);
    for (const { child } of children) {
      try {
        child.kill();
      } catch {
        // Proses sudah berhenti.
      }
    }
    killPortProcess(MODE.identityPort);
    killPortProcess(MODE.portalPort);
    process.exit(exitCode);
  }

  process.on('SIGINT', () => cleanup(0));
  process.on('SIGTERM', () => cleanup(0));

  // Kegagalan satu proses tidak boleh meninggalkan proses lain berjalan
  // tanpa terpantau di jendela ini.
  for (const { label, child } of children) {
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`      [GAGAL] Proses ${label} berhenti dengan kode ${code}.`);
      }
      cleanup(code ?? 0);
    });
  }
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
