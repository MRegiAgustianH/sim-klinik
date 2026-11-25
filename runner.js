// runner.js — launcher tunggal seluruh aplikasi klinik.
//
//   node runner.js                    -> PRODUCTION: identitas + portal + SIMKlinik + sistem surat
//   node runner.js --dev              -> DEVELOPMENT: port & database terpisah, hot reload
//   node runner.js --only=simklinik   -> identitas + SIMKlinik saja
//   node runner.js --only=portal      -> identitas + portal saja
//   node runner.js --only=surat       -> identitas + sistem surat saja
//
// Port diambil dari config/ports.js. Mode dev berjalan berdampingan dengan
// production yang sedang melayani pasien, jadi port dan database sengaja beda.
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const http = require('http');
const fs = require('fs');
const PORTS = require('./config/ports');

const ROOT = __dirname;
const DIRS = {
  identity: path.join(ROOT, 'services', 'identity'),
  api: path.join(ROOT, 'apps', 'simklinik-api'),
  web: path.join(ROOT, 'apps', 'simklinik-web'),
  portal: path.join(ROOT, 'apps', 'portal'),
  suratApi: path.join(ROOT, 'apps', 'surat-laporan', 'api'),
  suratWeb: path.join(ROOT, 'apps', 'surat-laporan', 'web'),
};

// Penanda mode untuk backend: keberadaan .env.local = development (database
// -dev). Penanda yang tertinggal di production membuat data pasien masuk ke
// database dev tanpa disadari, jadi runner selalu menyesuaikannya.
const DEV_MARKERS = [
  path.join(DIRS.api, '.env.local'),
  path.join(DIRS.identity, '.env.local'),
  path.join(DIRS.suratApi, '.env.local'),
];

const args = process.argv.slice(2);
const isDev = args.includes('--dev') || process.env.MODE === 'dev';
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length) : null;
if (only && !['simklinik', 'portal', 'surat'].includes(only)) {
  console.error(`[GAGAL] --only=${only} tidak dikenal. Pilihan: simklinik, portal, surat.`);
  process.exit(1);
}

const P = isDev ? PORTS.dev : PORTS.prod;
const OTHER = isDev ? PORTS.prod : PORTS.dev;
const LABEL = isDev ? 'DEVELOPMENT' : 'PRODUCTION';
const NEXT_MODE = isDev ? 'dev' : 'start';
const NEXT_DIR = isDev ? '.next-dev' : '.next';
const KEY_SUFFIX = isDev ? '-dev' : '';
const runSimklinik = !only || only === 'simklinik';
const runPortal = !only || only === 'portal';
const runSurat = !only || only === 'surat';

const USE_COLOR = process.stdout.isTTY;
const color = (code, text) => (USE_COLOR ? `\x1b[${code}m${text}\x1b[0m` : text);
const cyan = (t) => color('36', t);
const yellow = (t) => color('33', t);
const green = (t) => color('32', t);
const red = (t) => color('31', t);

// Diteruskan ke setiap proses agar path data/rahasia tidak bergantung pada cwd.
const BASE_ENV = { ...process.env, KLINIK_ROOT: ROOT };

const children = [];
let identityStartedHere = false;

function logBanner(title, lines = []) {
  console.log('\n====================================================================');
  console.log(`  ${title}`);
  console.log('====================================================================');
  for (const line of lines) console.log(`  ${line}`);
  console.log('====================================================================\n');
}

function getLocalIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) return net.address;
    }
  }
  return '127.0.0.1';
}

function killPortProcess(port) {
  if (process.platform !== 'win32') return;
  try {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'ignore' }
    );
  } catch {
    // Port memang sudah bebas.
  }
}

function ping(port, healthPath) {
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

async function waitReady(port, timeoutMs, healthPath) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await ping(port, healthPath)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
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

// stdout hanya diteruskan bila memuat salah satu pola (log NestJS sangat
// ramai); stderr selalu diteruskan kecuali peringatan yang tidak penting.
function spawnTracked(label, cmdArgs, options, { showPatterns = null, ignoreStderr = [] } = {}) {
  const child = spawn(process.execPath, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  child.stdout?.on('data', (data) => {
    const text = data.toString();
    if (!showPatterns || showPatterns.some((p) => text.includes(p))) {
      process.stdout.write(`      [${label}] ${text.trim()}\n`);
    }
  });
  child.stderr?.on('data', (data) => {
    const text = data.toString();
    if (!['ExperimentalWarning', ...ignoreStderr].some((p) => text.includes(p))) {
      process.stderr.write(`${red(`      [${label}]`)} ${text}`);
    }
  });
  children.push({ label, child });
  return child;
}

function ensureInstalled(label, dir) {
  if (!fs.existsSync(path.join(dir, 'node_modules'))) {
    console.log(`      [SETUP] Dependensi ${label} belum terpasang. Menjalankan npm install...`);
    execSync('npm install', { cwd: dir, stdio: 'inherit' });
  }
}

function ensureNextBuild(label, dir) {
  if (isDev || fs.existsSync(path.join(dir, NEXT_DIR, 'BUILD_ID'))) return;
  console.log(`      [BUILD] Build produksi ${label} belum ada. Menjalankan npm run build...`);
  execSync('npm run build', { cwd: dir, stdio: 'inherit', env: { ...BASE_ENV, NEXT_DIST_DIR: NEXT_DIR } });
  console.log(`      [OK] Build ${label} selesai.`);
}

function nextArgs(dir, port) {
  return [path.join(dir, 'node_modules', 'next', 'dist', 'bin', 'next'), NEXT_MODE, '-H', '0.0.0.0', '-p', String(port)];
}

function cleanup(exitCode = 0) {
  console.log(`\n[INFO] Menghentikan layanan klinik (${LABEL})...`);
  for (const { child } of children) {
    try {
      child.kill();
    } catch {
      // Proses sudah berhenti.
    }
  }
  if (runSimklinik) {
    killPortProcess(P.simklinikWeb);
    killPortProcess(P.simklinikApi);
  }
  if (runPortal) killPortProcess(P.portal);
  if (runSurat) {
    killPortProcess(P.suratWeb);
    killPortProcess(P.suratApi);
  }
  // Layanan identitas milik jendela lain tidak boleh ikut dimatikan: portal
  // dan aplikasi lain yang memakainya akan terputus.
  if (identityStartedHere) killPortProcess(P.identity);
  process.exit(exitCode);
}

async function main() {
  const apps = [runPortal && 'portal', runSimklinik && 'SIMKlinik', runSurat && 'surat'].filter(Boolean).join(' + ');
  logBanner(
    isDev ? cyan(`KLINIK - MODE DEVELOPMENT (${apps})`) : green(`KLINIK UTAMA DR. H. A. ROTINSULU CIANJUR - PRODUCTION (${apps})`),
    isDev
      ? ['Port dan database terpisah; production yang sedang berjalan tidak terganggu.']
      : ['Menyiapkan layanan identitas, portal, dan aplikasi pelayanan...']
  );

  // 1. Port. Layanan identitas yang sudah hidup dipakai ulang, bukan dimatikan:
  //    dua instance pada satu file SQLite tidak aman.
  console.log('[1/7] Memeriksa port...');
  const identityRunning = await ping(P.identity, '/api/health');
  if (identityRunning) {
    console.log(yellow(`      [INFO] Layanan identitas sudah berjalan di port ${P.identity}; dipakai ulang.`));
  } else {
    killPortProcess(P.identity);
  }
  if (runSimklinik) {
    killPortProcess(P.simklinikWeb);
    killPortProcess(P.simklinikApi);
  }
  if (runPortal) killPortProcess(P.portal);
  if (runSurat) {
    killPortProcess(P.suratWeb);
    killPortProcess(P.suratApi);
  }
  if (await ping(OTHER.identity, '/api/health')) {
    console.log(yellow(`      [INFO] Mode ${isDev ? 'production' : 'development'} juga sedang berjalan; tidak diganggu.`));
  }
  console.log('      [OK] Port siap.\n');

  // 2. Penanda mode dan dependensi.
  for (const marker of DEV_MARKERS) {
    if (isDev && !fs.existsSync(marker)) {
      fs.writeFileSync(marker, '# Dibuat otomatis oleh runner.js untuk mode development\n');
    } else if (!isDev && fs.existsSync(marker)) {
      fs.unlinkSync(marker);
      console.log(`      [OK] Penanda development dihapus: ${path.relative(ROOT, marker)}`);
    }
  }
  console.log('[2/7] Memeriksa dependensi...');
  ensureInstalled('layanan identitas', DIRS.identity);
  if (runSimklinik) {
    ensureInstalled('backend SIMKlinik', DIRS.api);
    ensureInstalled('frontend SIMKlinik', DIRS.web);
  }
  if (runPortal) ensureInstalled('portal', DIRS.portal);
  if (runSurat) {
    ensureInstalled('backend sistem surat', DIRS.suratApi);
    ensureInstalled('frontend sistem surat', DIRS.suratWeb);
  }
  console.log('      [OK] Dependensi lengkap.\n');

  // 3. Layanan identitas lebih dulu: login portal dan pendaftaran pasien di
  //    SIMKlinik (mode gagal cepat) tidak bisa jalan tanpa layanan ini.
  if (!identityRunning) {
    console.log(`[3/7] Menjalankan Layanan Identitas (port ${P.identity})...`);
    spawnTracked(
      'Identitas',
      ['node_modules/ts-node/dist/bin.js', path.join(DIRS.identity, 'src', 'main.ts')],
      { cwd: DIRS.identity, env: { ...BASE_ENV, PORT: String(P.identity) } },
      { showPatterns: ['Layanan Identitas SIMKlinik Aktif'] }
    );
    identityStartedHere = true;
    if (!(await waitReady(P.identity, isDev ? 40000 : 20000, '/api/health'))) {
      console.error(red(`      [GAGAL] Layanan identitas tidak siap di port ${P.identity}.`));
      cleanup(1);
    }
    console.log('      [OK] Layanan identitas aktif.\n');
  } else {
    console.log('[3/7] Layanan identitas sudah berjalan (tidak dijalankan ulang).\n');
  }

  // 4. Service key antar-layanan di secrets/service-keys/. Portal memakainya
  //    untuk menukar token; SIMKlinik untuk menukar tiket SSO.
  console.log('[4/7] Memeriksa service key...');
  const keyDir = path.join(ROOT, 'secrets', 'service-keys');
  for (const [name, command] of [
    ['portal', 'portal --portal'],
    ['simklinik', 'simklinik'],
    ['surat', 'surat'],
  ]) {
    if (!fs.existsSync(path.join(keyDir, `${name}${KEY_SUFFIX}.key`))) {
      console.log(`      [SETUP] Membuat service key ${name}...`);
      execSync(`npm run generate-key -- ${command}`, { cwd: DIRS.identity, stdio: 'inherit', env: BASE_ENV });
    }
  }
  console.log('      [OK] Service key tersedia di secrets/service-keys.\n');

  // 5. SIMKlinik: backend lalu frontend.
  if (runSimklinik) {
    console.log(`[5/7] Menjalankan SIMKlinik (backend ${P.simklinikApi}, frontend ${P.simklinikWeb})...`);
    const dist = path.join(DIRS.api, 'dist', 'main.js');
    const useDist = !isDev && fs.existsSync(dist);
    if (!useDist) console.log('      [INFO] Backend dijalankan dari source (ts-node).');
    spawnTracked(
      'Backend',
      useDist ? [dist] : ['node_modules/ts-node/dist/bin.js', path.join(DIRS.api, 'src', 'main.ts')],
      {
        cwd: DIRS.api,
        env: {
          ...BASE_ENV,
          PORT: String(P.simklinikApi),
          NODE_ENV: isDev ? 'development' : 'production',
          IDENTITY_SERVICE_URL: `http://127.0.0.1:${P.identity}`,
        },
      },
      {
        showPatterns: ['Backend SIMKlinik Server Aktif', 'Nest application successfully started', ...(isDev ? ['error TS'] : [])],
        ignoreStderr: ['keyFilename'],
      }
    );
    if (await waitReady(P.simklinikApi, isDev ? 40000 : 15000, '/api/auth/profile')) {
      console.log('      [OK] Backend SIMKlinik aktif.');
    } else {
      console.warn(yellow('      [PERINGATAN] Backend memerlukan waktu lebih lama. Cek log di atas.'));
    }

    ensureNextBuild('frontend SIMKlinik', DIRS.web);
    spawnTracked('SIMKlinik', nextArgs(DIRS.web, P.simklinikWeb), {
      cwd: DIRS.web,
      stdio: 'inherit',
      env: {
        ...BASE_ENV,
        BACKEND_PORT: String(P.simklinikApi),
        PORT: String(P.simklinikWeb),
        NEXT_DIST_DIR: NEXT_DIR,
        // Dipakai halaman /sso dan route /api/sso/redeem.
        PORTAL_URL: `http://127.0.0.1:${P.portal}`,
        IDENTITY_PORT: String(P.identity),
      },
    });
    console.log('');
  }

  // 6. Portal dashboard.
  if (runPortal) {
    console.log(`[6/7] Menjalankan Portal (port ${P.portal})...`);
    ensureNextBuild('portal', DIRS.portal);
    spawnTracked('Portal', nextArgs(DIRS.portal, P.portal), {
      cwd: DIRS.portal,
      stdio: 'inherit',
      env: {
        ...BASE_ENV,
        PORT: String(P.portal),
        NEXT_DIST_DIR: NEXT_DIR,
        IDENTITY_PORT: String(P.identity),
        IDENTITY_MODE: isDev ? 'development' : 'production',
      },
    });
  }

  // 7. Sistem surat: backend lalu frontend. Memakai layanan identitas yang
  //    sama untuk login, izin fitur, dan data pasien surat keluar.
  if (runSurat) {
    console.log(`[7/7] Menjalankan Sistem Surat (backend ${P.suratApi}, frontend ${P.suratWeb})...`);
    const suratDist = path.join(DIRS.suratApi, 'dist', 'main.js');
    const useSuratDist = !isDev && fs.existsSync(suratDist);
    spawnTracked(
      'Surat-API',
      useSuratDist ? [suratDist] : ['node_modules/ts-node/dist/bin.js', path.join(DIRS.suratApi, 'src', 'main.ts')],
      {
        cwd: DIRS.suratApi,
        env: {
          ...BASE_ENV,
          PORT: String(P.suratApi),
          NODE_ENV: isDev ? 'development' : 'production',
          IDENTITY_SERVICE_URL: `http://127.0.0.1:${P.identity}`,
        },
      },
      { showPatterns: ['Backend Sistem Surat Aktif', ...(isDev ? ['error TS'] : [])] }
    );
    if (await waitReady(P.suratApi, isDev ? 40000 : 20000, '/api/health')) {
      console.log('      [OK] Backend sistem surat aktif.');
    } else {
      console.warn(yellow('      [PERINGATAN] Backend sistem surat memerlukan waktu lebih lama. Cek log di atas.'));
    }

    ensureNextBuild('frontend sistem surat', DIRS.suratWeb);
    spawnTracked('Surat', nextArgs(DIRS.suratWeb, P.suratWeb), {
      cwd: DIRS.suratWeb,
      stdio: 'inherit',
      env: {
        ...BASE_ENV,
        BACKEND_PORT: String(P.suratApi),
        PORT: String(P.suratWeb),
        NEXT_DIST_DIR: NEXT_DIR,
        // Dipakai halaman /sso dan route /api/sso/redeem.
        PORTAL_URL: `http://127.0.0.1:${P.portal}`,
      },
    });
    console.log('');
  }

  const ip = getLocalIp();
  setTimeout(() => {
    logBanner(isDev ? cyan('MODE DEVELOPMENT BERJALAN') : green('SISTEM KLINIK BERJALAN'), [
      `Mode: ${LABEL}`,
      '',
      ...(runPortal
        ? ['Portal (pintu masuk semua aplikasi):', `  Komputer ini -> http://localhost:${P.portal}`, `  Jaringan LAN -> http://${ip}:${P.portal}`, '']
        : []),
      ...(runSimklinik
        ? ['SIMKlinik (vaksinasi, ICV, MCU):', `  Komputer ini -> http://localhost:${P.simklinikWeb}`, `  Jaringan LAN -> http://${ip}:${P.simklinikWeb}`, '']
        : []),
      ...(runSurat
        ? ['Sistem Surat (surat keluar & internal):', `  Komputer ini -> http://localhost:${P.suratWeb}`, `  Jaringan LAN -> http://${ip}:${P.suratWeb}`, '']
        : []),
      `Layanan identitas: http://localhost:${P.identity}/api/health`,
      '',
      'Akun login (satu akun untuk semua aplikasi):',
      '  - Superadmin : superadmin / admin123',
      '  - Dokter     : dokter     / dokter123',
      '  - Perawat    : perawat    / perawat123',
      '',
      `Database: data/simklinik/vaksinku${KEY_SUFFIX}.sqlite, data/identity/identity${KEY_SUFFIX}.sqlite, data/surat/surat${KEY_SUFFIX}.sqlite`,
      '',
      `Tekan CTRL + C di jendela ini untuk mematikan seluruh layanan ${LABEL}.`,
    ]);
    if (!process.env.NO_BROWSER) {
      openBrowser(
        runPortal
          ? `http://localhost:${P.portal}/login`
          : runSimklinik
            ? `http://localhost:${P.simklinikWeb}/login`
            : `http://localhost:${P.suratWeb}/login`
      );
    }
  }, 1500);

  process.on('SIGINT', () => cleanup(0));
  process.on('SIGTERM', () => cleanup(0));
  // Kegagalan satu proses tidak boleh meninggalkan proses lain berjalan tanpa
  // terpantau di jendela ini.
  for (const { label, child } of children) {
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) console.error(red(`      [GAGAL] Proses ${label} berhenti dengan kode ${code}.`));
      cleanup(code ?? 0);
    });
  }
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
