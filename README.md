# SIMKlinik — Klinik Utama Dr. H. A. Rotinsulu Cianjur

Sistem Informasi Manajemen Pelayanan Klinik: vaksinasi internasional, buku kuning (ICV), Medical Check Up (MCU), stok vaksin, dan rekam medis pasien.

**Untuk apa:** menggantikan pencatatan manual (Excel, Word, buku tulis) di klinik. Dokter, perawat, dan admin bekerja dari satu database yang sama lewat browser di dalam jaringan LAN/Wi-Fi klinik — satu komputer sebagai server, sisanya cukup membuka alamat IP server.

Repositori: `https://github.com/MRegiAgustianH/sim-klinik.git`

---

## 1. Isi Aplikasi

| Modul | Fungsi |
| :--- | :--- |
| Dashboard | Ringkasan kunjungan, stok kritis, dan aktifitas terbaru |
| Pasien | Registrasi & 22 parameter rekam medis vaksinasi, skrining tes kehamilan WUS, nomor ICV, persetujuan dokter |
| MCU | Laporan hasil Medical Check Up, template 1-klik isi normal, pratinjau A4, ekspor PDF 4 halaman |
| Stok | Master stok vaksin per batch, inventaris buku ICV, mutasi masuk/keluar, pengurangan otomatis saat vaksinasi |
| Laporan | Ekspor Excel multi-sheet (rekap pasien, stok, ICV), PDF rekap bulanan, kartu bukti vaksinasi per pasien |
| Pengguna | Manajemen akun & peran (Superadmin / Dokter / Perawat) |
| Registrasi Mandiri | QR Code + Google Form, sinkronisasi otomatis tiap 30 detik dari Google Sheets |

**Akun bawaan** (seeding otomatis saat database pertama kali dibuat):

| Peran | Username | Password |
| :--- | :--- | :--- |
| Superadmin | `superadmin` | `admin123` |
| Dokter | `dokter` | `dokter123` |
| Perawat | `perawat` | `perawat123` |

Ubah kata sandi lewat menu **Profil** setelah login pertama.

---

## 2. Struktur Folder

```
sim-klinik/
├─ runner.js                  Launcher SIMKlinik (production & development)
├─ JALANKAN_APLIKASI.bat      Jalankan SIMKlinik saja    -> port 8080 / 4000
├─ MODE_PENGEMBANGAN_DEV.bat  SIMKlinik development      -> port 8081 / 4001
├─ DEPLOY_PRODUCTION.bat      Backup DB + build + restart production
├─ PERBAIKI_BACKEND.bat       Build ulang backend bila dist rusak
├─ VERIFIKASI_MCU.bat         Cek TypeScript + tes cetak PDF (tanpa ganggu production)
├─ server/                    Backend NestJS (REST API, SQLite, PDF, Excel)
├─ client/                    Frontend Next.js 14 + Tailwind
├─ portal/                    Portal dashboard & layanan identitas
│  ├─ JALANKAN_PORTAL.bat     ** SATU-SATUNYA YANG DIKLIK DI SERVER KLINIK **
│  │                          (identitas + portal + SIMKlinik sekaligus)
│  ├─ MODE_PENGEMBANGAN_PORTAL.bat  versi development (port 8083/8081)
│  ├─ runner.js               Launcher portal; --with-simklinik = seluruh sistem
│  ├─ portal-dashboard/       Next.js :8082 — login, kartu aplikasi, pasien, pengguna
│  └─ identity-service/       NestJS :4010 — pengguna, pasien, app, token SSO
└─ backups/                   Hasil backup database otomatis
```

---

## 3. Cara Menjalankan Server

**Prasyarat:** Windows 10/11 dan Node.js (backend memakai modul `node:sqlite`, jadi gunakan **Node.js 22.13 atau lebih baru** — cek dengan `node -v`). Dependensi terpasang otomatis saat pertama dijalankan.

### Production (dipakai klinik sehari-hari)

1. Klik ganda **`portal\JALANKAN_PORTAL.bat`**. Satu klik menyalakan layanan identitas (4010), portal (8082), dan SIMKlinik (8080).
2. Staf membuka `http://<IP-server>:8082` — login sekali di portal, lalu pilih aplikasi dari beranda.
3. Biarkan jendela Command Prompt tetap terbuka. **CTRL + C** untuk mematikan semuanya.

Bila portal tidak dipakai, SIMKlinik masih bisa dijalankan sendiri dengan **`JALANKAN_APLIKASI.bat`** (port 8080 / 4000, membuka browser ke halaman login SIMKlinik). Jangan jalankan keduanya bersamaan — port 8080 bentrok.

Database production: `server/data/vaksinku.sqlite` (SIMKlinik) dan `portal/identity-service/data/identity.sqlite` (identitas). Folder `data/` tidak diunggah ke GitHub demi kerahasiaan rekam medis — **cadangkan keduanya**.

### Development (menguji fitur baru)

1. Klik ganda **`MODE_PENGEMBANGAN_DEV.bat`**, atau: `node runner.js --dev`
2. Berjalan **berdampingan** dengan production — web pasien di port 8080 tidak terganggu.

| Aspek | Production | Development |
| :--- | :--- | :--- |
| Frontend | `http://localhost:8080` | `http://localhost:8081` |
| Backend | 4000 | 4001 |
| Database | `server/data/vaksinku.sqlite` | `server/data/vaksinku-dev.sqlite` |
| Folder build | `client/.next` | `client/.next-dev` |
| Backend dari | `server/dist` (hasil build) | `server/src` (ts-node) |
| Hot reload | Tidak | Ya (fast refresh) |

Penanda mode adalah keberadaan `server/.env.local`. File itu hanya dibuat di mode dev dan **dihapus otomatis** saat production dijalankan, agar backend tidak salah memakai database dev.

---

## 4. Maintenance Web

### Alur rilis fitur

1. Uji di mode development (port 8081) — cek form, pratinjau A4, unduh PDF.
2. Jalankan `VERIFIKASI_MCU.bat` untuk memastikan tidak ada error TypeScript dan cetak PDF masih benar.
3. Tutup jendela production (CTRL + C), lalu klik ganda **`DEPLOY_PRODUCTION.bat`**. Skrip ini otomatis: menghentikan port 8080/4000 → mencadangkan database ke `backups\vaksinku-<tanggal>.sqlite` → build backend & frontend → menjalankan production kembali. Downtime 1–3 menit, jalankan saat klinik sepi.

Build manual tanpa skrip:

```bat
cd server && npm run build && cd ..
cd client && npm run build && cd ..
node runner.js
```

### Perbaikan cepat

| Gejala | Tindakan |
| :--- | :--- |
| Tidak bisa dibuka, port bentrok (`EADDRINUSE`) | Tutup jendela lama, jalankan ulang `JALANKAN_APLIKASI.bat` |
| Backend gagal start: `Cannot find module './mcu-template'` | `PERBAIKI_BACKEND.bat` (hapus `server\dist`, build ulang bersih) |
| Perubahan kode tidak muncul di port 8080 | Build ulang (`DEPLOY_PRODUCTION.bat`) — production tidak hot reload |
| Halaman blank / error setelah update | Kembalikan source ke commit sebelumnya (`git checkout <commit>`), lalu deploy ulang |

### Backup dan pemulihan

- **Backup manual:** salin `server/data/vaksinku.sqlite` (beserta `-wal` dan `-shm` bila ada) saat aplikasi mati.
- **Backup otomatis:** `DEPLOY_PRODUCTION.bat` mencadangkan ke `backups\` setiap kali deploy.
- **Pemulihan:** matikan aplikasi, timpa `server/data/vaksinku.sqlite` dengan file backup, jalankan ulang.
- Jadwalkan penyalinan folder `backups\` ke drive eksternal / cloud minimal sekali seminggu.

### Keamanan wajib sebelum dipakai luas

- Ganti `JWT_SECRET` (bawaan `VaksinKU_Super_Secret_Key_Hospital_2026`) lewat variabel lingkungan di `runner.js`.
- Ganti ketiga kata sandi akun bawaan.
- `google-credentials.json` dan `*.sqlite` sudah masuk `.gitignore` — jangan pernah di-commit (rahasia medis, UU PDP).

---

## 5. Portal Dashboard Klinik

Folder `portal/` berisi **pintu masuk tunggal** ke semua aplikasi klinik: satu akun untuk semua aplikasi, satu data induk pasien, dan satu tempat melihat aplikasi mana yang sedang berjalan.

**Status:** identity service dan portal dashboard **sudah jalan**. Impor pasien lama siap dijalankan; migrasi `patientId` di SIMKlinik dan sistem surat & laporan belum dikerjakan (lihat 5.7).

### 5.0 Menjalankan portal

**Di komputer utama klinik, cukup satu klik: `portal\JALANKAN_PORTAL.bat`.**

Itu menyalakan layanan identitas, portal, dan SIMKlinik sekaligus dari satu jendela. Tidak perlu menjalankan `JALANKAN_APLIKASI.bat` terpisah — launcher portal sudah menyalakan SIMKlinik, dan keduanya memakai layanan identitas yang sama.

| Akses | Production | Development |
| :--- | :--- | :--- |
| Portal | `http://<IP-server>:8082` | `8083` |
| SIMKlinik | `http://<IP-server>:8080` | `8081` |
| Layanan identitas | `http://<IP-server>:4010` | `4011` |

Staf cukup membuka portal di 8082; SIMKlinik dibuka lewat tombol **Buka Aplikasi** di portal. Panduan lengkap: `portal/README.md`.

**Cara pakai:** login di portal → pilih aplikasi di beranda → tombol **Buka Aplikasi** membuka aplikasi tujuan di **tab baru** tanpa login ulang, sehingga portal tetap terbuka di tab semula dan staf bisa berpindah ke aplikasi lain. Tombol **Portal SIMKlinik** di sidebar SIMKlinik mengembalikan ke portal.

**Kapan memakai launcher root (`JALANKAN_APLIKASI.bat`)?** Hanya bila portal memang tidak dipakai — mis. menguji SIMKlinik sendirian tanpa portal. Bila portal sedang berjalan, launcher root mendeteksi layanan identitas yang sudah hidup dan tidak menyalakan instance kedua, tetapi port 8080/4000 akan bentrok bila SIMKlinik sudah berjalan.

### 5.1 Pilih dulu: satu database atau satu identitas?

Portal yang matang memisahkan dua hal ini, dan urutan pengerjaannya menentukan biaya:

- **Satu identitas (SSO)** — mudah, cepat, berisiko rendah. Portal menerbitkan token login, aplikasi lain memverifikasinya. Data tetap di database masing-masing.
- **Satu database** — mahal dan berisiko. Menggabungkan tabel pasien milik dua aplikasi yang sudah berjalan berarti migrasi data, penyamaan NIK, dan penanganan data ganda.

Rekomendasi: **mulai dari SSO**, integrasi database menyusul per domain. Yang benar-benar perlu terintegrasi lebih dulu biasanya hanya **identitas pasien** (satu pasien, satu NIK, satu nomor rekam medis), bukan seluruh tabel.

### 5.2 Arsitektur yang disarankan

```
                     ┌───────────────────────────┐
   browser  ────────►│  PORTAL (Next.js :8082)   │
                     │  login, daftar app, SSO   │
                     └───────┬───────────┬───────┘
                             │           │
              redirect + tiket           │ baca/tulis identitas pasien
                             │           │
        ┌────────────────────▼──┐   ┌────▼─────────────────────┐
        │ SIMKlinik  :8080      │   │ Layanan Identitas        │
        │ Backend    :4000      │   │ (NestJS :4010 + SQLite)  │
        │ vaksinku.sqlite       │   │ patients, users, app_akses│
        └───────────────────────┘   └──────────────────────────┘
        ┌───────────────────────┐            ▲
        │ Surat & Laporan :8083 │────────────┘   (belum dikerjakan)
        └───────────────────────┘
```

Prinsip yang membuat penambahan app berikutnya murah:

- **Satu layanan identitas** memegang tabel `patients`, `users`, dan `app_access`. Aplikasi lain menyimpan `patient_id` (kunci asing), bukan menyalin data pasien.
- **Satu format token** (JWT dengan `sub`, `username`, `role`, `aud`, `apps`) dan satu `JWT_SECRET` bersama. `aud` menandai aplikasi tujuan, sehingga token portal tidak bisa dipakai di aplikasi pelayanan.
- **Satu pola port**: frontend `80xx`, backend `40xx`, database di folder `data/` masing-masing app.
- **Satu launcher**: `portal/runner.js` menyalakan portal; `--with-simklinik` menyalakan aplikasi pelayanan sekaligus.

### 5.3 Langkah membuat portal

1. ~~**Siapkan folder** `portal/` dengan `portal/portal-dashboard/` (Next.js) dan `portal/identity-service/` (NestJS).~~ Selesai.
2. ~~**Identity service** — port `4010`, database `portal/identity-service/data/identity.sqlite`~~ Selesai: `users`, `patients`, `app_access`, `app_registry`, `service_keys`, lengkap dengan endpoint.
3. ~~**Portal dashboard** — port `8082`~~ Selesai: login, beranda kartu aplikasi dengan status hidup/mati, data pasien, pengguna & hak akses, daftar aplikasi, profil.
4. ~~**Sesuaikan setiap app agar menerima token portal**~~ Selesai untuk SIMKlinik lewat halaman `/sso` (`client/src/app/sso/`) dan route `/api/sso/redeem`; backend memeriksa `aud`.
5. ~~**Launcher terpadu** — `portal/runner.js`~~ Selesai.
6. **Uji tanpa mengganggu production** — pakai `MODE_PENGEMBANGAN_PORTAL.bat` (port 8083/8081).

### 5.4 Menambah app baru yang terintegrasi portal

Urutan ini bisa diulang untuk setiap modul baru (mis. apotek, kasir, laboratorium):

1. **Tentukan kode & port.** Contoh: kode `apotek`, frontend `8084`, backend `4002`, database `server/data/apotek.sqlite` — jangan pakai port yang sudah dipakai (8080/8081/4000/4001/4010/8082).
2. **Buat backend** dari pola `server/`:
   - Salin `server/src/database/database.service.ts`, ubah nama file database, dan **pertahankan gaya migrasi yang idempoten** (`CREATE TABLE IF NOT EXISTS`) — kode itu berjalan setiap start dan tidak merusak data lama.
   - Baca port dari `process.env.PORT` dan bind ke `0.0.0.0` agar bisa diakses dari jaringan (`server/src/main.ts`).
   - Pindahkan modul `auth/` apa adanya agar guard per peran (`roles.decorator.ts`, `roles.guard.ts`) langsung berfungsi.
   - Tambahkan `GET /api/health` sebagai penanda status untuk portal.
3. **Buat frontend** dari pola `client/`: `distDir` dari `process.env.NEXT_DIST_DIR`, rewrite `/api/:path*` ke port backend lewat `process.env.BACKEND_PORT` (lihat `client/next.config.mjs`), dan helper `src/lib/api.ts` yang mengambil token dari `localStorage`.
4. **Sambungkan ke identitas, bukan menyalin data.** App baru menyimpan `patient_id` dari identity service. Jangan buat tabel pasien kedua — inilah yang membuat data ganda muncul di kemudian hari.
5. **Daftarkan di portal.** Tambahkan satu baris ke `app_registry` (kode, nama, URL frontend, URL backend). Kartu aplikasi muncul otomatis di beranda portal tanpa mengubah kode portal.
6. **Daftarkan di launcher** `portal/runner.js` dengan pasangan port yang sama seperti di langkah 1.
7. **Mode dev dan production tetap terpisah.** Ikuti pola penanda `.env.local` milik SIMKlinik: ada penanda = database dev, tidak ada = database production.
8. **Verifikasi sebelum deploy:** jalankan mode dev app baru, cek login SSO dari portal, cek halaman tidak error, lalu deploy dengan skrip yang mencadangkan database lebih dulu.

### 5.5 Catatan integrasi dengan SIMKlinik

**Data pasien saat ini masih tercatat per transaksi, bukan satu identitas.** `vaccination_records` (`server/src/database/database.service.ts:103`) dan `mcu_reports` (`:205`) masing-masing menyimpan `nik + fullName + birthDate + address` dan seterusnya. Pasien yang pernah vaksinasi lalu MCU akan punya dua baris, dan tidak ada tabel pasien tunggal yang menjadi acuan. Karena sistem surat & laporan **butuh data pasien**, inilah pekerjaan integrasi yang sebenarnya.

**Urutan pengerjaan yang menghindari input ganda:**

1. **Identity service lebih dulu** (`portal/identity-service/`, port `4010`) berisi `patients(nik UNIQUE, fullName, gender, birthPlace, birthDate, address, phoneWa, email, occupation, maritalStatus)` — gabungan kolom yang sudah ada di `vaccination_records`. Semua field ini wajib ada agar app pendukung tidak perlu menebak umur/jenis kelamin.
2. **Impor pasien lama** ke identity service: `INSERT OR IGNORE` berdasarkan NIK dari `vaccination_records` lalu `mcu_reports`; baris tanpa NIK dibiarkan sebagai data lama saja dan ditandai untuk pengecekan manual. No. ICV, hasil skrining WUS, dan nomor laporan **tidak** ikut dipindah — itu milik transaksinya.
3. **Tambah kolom `patientId`** ke `vaccination_records` dan `mcu_reports` lewat migrasi `ALTER TABLE ... ADD COLUMN` di `runMigrations()` (pola yang sudah dipakai di `:231`), lalu isi dengan mencocokkan NIK. Kolom lama `fullName`/`nik` tetap ada sebagai arsip dan pembanding — jangan langsung dihapus.
4. **SIMKlinik membaca pasien dari identity service** saat registrasi baru, bukan mengetik ulang. Simpan salinan nama/NIK saat transaksi agar cetak PDF lama tetap utuh meski data pasien berubah.
5. **Sistem surat & laporan** dibuat setelah langkah 1–3 untuk **surat keluar** (surat sakit dan sejenisnya): hanya menyimpan `patientId` + nomor surat, data pasien diambil lewat `GET /api/patients/:id` dari identity service. Surat **internal** (pengajuan, pengadaan, dll) tidak memakai langkah ini sama sekali — lihat bagian 5.6.

**Yang sudah bisa dipakai sekarang:** token JWT 12 jam (`server/src/auth/auth.module.ts`), tiga peran dengan guard (`roles.guard.ts` — Superadmin otomatis lolos semua endpoint), dan autentikasi lewat query `?token=` (`server/src/auth/jwt.strategy.ts`), sehingga SSO dari portal bisa jalan tanpa mengubah backend.

**Backup wajib sebelum migrasi:** jalankan `DEPLOY_PRODUCTION.bat` tidak cukup — salin dulu `server/data/vaksinku.sqlite` beserta `-wal`/`-shm` ke folder terpisah. Langkah 3 mengubah tabel production yang berisi rekam medis.

### 5.6 App surat & laporan: dua jenis surat

App ini **bukan hanya surat sakit**. Ada dua jenis surat dengan kebutuhan data yang berbeda, dan keduanya harus dipisah sejak perancangan skema:

| Jenis | Contoh | Sumber data |
| :--- | :--- | :--- |
| **Surat keluar** (berkaitan dengan pasien) | Surat keterangan sakit, surat keterangan sehat, surat rujukan, surat hasil MCU | `patientId` dari identity service + data transaksi |
| **Surat internal** (administratif klinik) | Surat pengajuan, surat pengadaan barang, surat permohonan, surat tugas, surat edaran, berita acara | Data klinik & penandatangan saja — **tanpa data pasien** |

**Surat internal tidak boleh bergantung pada data pasien.** Kalau satu tabel `letters` menyatukan keduanya dengan `patientId` yang boleh kosong, setiap perubahan pada identitas pasien berisiko menyentuh surat pengadaan. Pisahkan:

```
letter_templates(id, code, name, category, bodyDoc, variables, isActive)
letters(id, letterNumber UNIQUE, templateId, subject, classifiedAs,
        patientId NULL,      -- hanya untuk surat keluar
        payload JSON,        -- nilai untuk mengisi variabel template
        status, createdBy, letterDate, filePath)
letter_signers(id, letterId, level, role, name, sip, signedAt, note)  -- 0..n penandatangan
letter_numbering(id, code, pattern, scopeYear, lastSeq)   -- penomoran otomatis
```

**Penandatangan fleksibel, bukan satu kolom.** Jangan tetapkan jumlah tanda tangan di skema — `letter_signers` menampung 0 sampai berapa pun, berurutan lewat `level`. Klinik bisa memakai satu penandatangan hari ini dan menambah tembusan atau persetujuan berjenjang nanti tanpa migrasi. Isi `role` menyesuaikan template (mis. `Direktur`, `Kepala Pelayanan Vaksinasi`, `Diketahui`), dan nama penandatangan diambil dari `users` sehingga tidak diketik ulang tiap surat. Bila alur persetujuan berantai dibutuhkan, status surat mengikuti `letter_signers` yang belum terisi — tidak perlu tabel alur terpisah.

**Template disimpan sebagai dokumen, nilai diisi sebagai data.** Jangan membuat komponen kode terpisah untuk tiap jenis surat — klinik akan terus menambah surat baru dan setiap penambahan berarti minta developer. Buat satu editor dokumen bertoken:

```
Kepada Yth. {{nama_instansi}}
Perihal: {{perihal}}

Sehubungan dengan {{keperluan}}, kami mengajukan {{jumlah_barang}} ...
Cianjur, {{tanggal_surat}}
```

Daftar variabel yang tersedia dibatasi per kategori: `{{nama_pasien}}`, `{{nik}}`, `{{umur}}`, `{{diagnosis}}` hanya muncul untuk template kategori *surat keluar*; `{{nama_instansi}}`, `{{jumlah_barang}}`, `{{kode_barang}}` untuk *surat internal*. Penambahan template baru jadi pekerjaan admin klinik, bukan pekerjaan developer.

**Fitur yang perlu ada:**

- **Nomor surat otomatis** — pola seperti `001/SK/KR-ITS/XI/2026`, dengan urutan terpisah per kode dan per tahun (`letter_numbering`). Nomor harus terkunci setelah surat disimpan.
- **Ekspor Word dan PDF** memakai kop klinik (`header-hasil.jpeg` sudah ada di root dan `server/`) serta blok tanda tangan yang dicetak berurutan dari `letter_signers`. Ini pola yang sudah terbukti di modul MCU — lihat `server/src/mcu/mcu-template.ts` dan `server/src/export/` untuk cara PDFKit dan ExcelJS dipakai.
- **Arsip dan pencarian** — filter per jenis, per instansi, per rentang tanggal, per status (`draft` / `menunggu tanda tangan` / `terkirim`).
- **Impor template dari Word** — paling praktis: admin mengunggah `.docx` berisi `{{variabel}}`, sistem mengambil tokennya. Ini menghindari admin belajar editor baru dari nol.
- **Riwayat versi template** — surat lama harus tetap tercetak sesuai template saat dibuat dibuat. Simpan salinan isi surat (`payload`) di baris `letters`, jangan hanya menunjuk `templateId`.

**Hak akses:** staf administrasi membuat draft dan surat internal; dokter menandatangani surat keluar; Superadmin mengelola template, pola penomoran, dan kop surat. Guard per peran sudah tersedia di `server/src/auth/roles.guard.ts` dan bisa dipakai apa adanya.

### 5.7 Versi ringkas urutan pengerjaan

| Prioritas | Pekerjaan | Bergantung pada | Status |
| :--- | :--- | :--- | :--- |
| 1 | Identity service (`portal/identity-service/`, port 4010) | — | **Selesai** |
| 2 | Portal dashboard + SSO (port 8082) | 1 | **Selesai** |
| 3 | Impor pasien lama per NIK | 1 | **Siap dijalankan** (`npm run import:patients`) |
| 4 | Migrasi `patientId` di SIMKlinik (uji di mode dev) | 1, 3 | Belum |
| 5 | App surat & laporan: template + surat internal (tidak menunggu 3–4) | 1 | Belum |
| 6 | App surat & laporan: surat keluar bermuatan pasien | 4 | Belum |

Surat internal sudah bisa dikerjakan setelah langkah 1, karena tidak menyentuh data pasien — jadi ada hasil yang bisa dipakai klinik tanpa menunggu migrasi database yang berisiko.

Urutan pengerjaan yang disarankan berikutnya: **jalankan impor pasien (3) saat klinik sepi**, sekaligus mengecek bentrok NIK yang dilaporkan. Setelah itu baru migrasi `patientId` di mode dev.

---

## 6. Push ke GitHub

`.gitignore` sudah mengamankan: `google-credentials.json`, semua `*.sqlite` dan folder `data/`, `backups/`, `node_modules/`, serta hasil build.

```bash
git init
git add .
git commit -m "feat: inisialisasi SIMKlinik Utama Dr. H. A. Rotinsulu Cianjur"
git branch -M main
git remote add origin https://github.com/MRegiAgustianH/sim-klinik.git
git push -u origin main
```
