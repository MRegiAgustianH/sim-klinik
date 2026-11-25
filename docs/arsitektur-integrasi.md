# Arsitektur Integrasi Portal Klinik

Portal (`apps/portal/`) bersama layanan identitas (`services/identity/`) adalah **pintu masuk tunggal** ke semua aplikasi klinik: satu akun untuk semua aplikasi, satu data induk pasien, dan satu tempat melihat aplikasi mana yang sedang berjalan.

**Status:** identity service, portal dashboard, dan sistem surat (`apps/surat-laporan/`, lihat README-nya) **sudah jalan**. Impor pasien lama siap dijalankan; migrasi `patientId` di SIMKlinik belum dikerjakan (lihat bagian 7).

## 0. Menjalankan portal

**Di komputer utama klinik, cukup satu klik: `JALANKAN.bat`.**

Itu menyalakan layanan identitas, portal, dan SIMKlinik sekaligus dari satu jendela. Satu launcher (`runner.js`) menyalakan semuanya, dan semua aplikasi memakai layanan identitas yang sama.

| Akses | Production | Development |
| :--- | :--- | :--- |
| Portal | `http://<IP-server>:8082` | `8083` |
| SIMKlinik | `http://<IP-server>:8080` | `8081` |
| Layanan identitas | `http://<IP-server>:4010` | `4011` |

Staf cukup membuka portal di 8082; SIMKlinik dibuka lewat tombol **Buka Aplikasi** di portal. Panduan lengkap: `docs/portal-dan-sso.md`.

**Cara pakai:** login di portal → pilih aplikasi di beranda → tombol **Buka Aplikasi** membuka aplikasi tujuan di **tab baru** tanpa login ulang, sehingga portal tetap terbuka di tab semula dan staf bisa berpindah ke aplikasi lain. Tombol **Portal SIMKlinik** di sidebar SIMKlinik mengembalikan ke portal.

**Kapan memakai `scripts\JALANKAN_SIMKLINIK_SAJA.bat`?** Hanya bila portal memang tidak dipakai, mis. menguji SIMKlinik sendirian. Bila layanan identitas sudah hidup, runner memakainya ulang dan tidak menyalakan instance kedua, tetapi port 8080/4000 akan bentrok bila SIMKlinik sudah berjalan.

## 1. Pilih dulu: satu database atau satu identitas?

Portal yang matang memisahkan dua hal ini, dan urutan pengerjaannya menentukan biaya:

- **Satu identitas (SSO)** — mudah, cepat, berisiko rendah. Portal menerbitkan token login, aplikasi lain memverifikasinya. Data tetap di database masing-masing.
- **Satu database** — mahal dan berisiko. Menggabungkan tabel pasien milik dua aplikasi yang sudah berjalan berarti migrasi data, penyamaan NIK, dan penanganan data ganda.

Rekomendasi: **mulai dari SSO**, integrasi database menyusul per domain. Yang benar-benar perlu terintegrasi lebih dulu biasanya hanya **identitas pasien** (satu pasien, satu NIK, satu nomor rekam medis), bukan seluruh tabel.

## 2. Arsitektur yang disarankan

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
        │ Sistem Surat   :8084  │────────────┘   (api :4002, data/surat/)
        └───────────────────────┘
```

Prinsip yang membuat penambahan app berikutnya murah:

- **Satu layanan identitas** memegang tabel `patients`, `users`, dan `app_access`. Aplikasi lain menyimpan `patient_id` (kunci asing), bukan menyalin data pasien.
- **Satu format token** (JWT dengan `sub`, `username`, `role`, `aud`, `apps`) dan satu `JWT_SECRET` bersama. `aud` menandai aplikasi tujuan, sehingga token portal tidak bisa dipakai di aplikasi pelayanan.
- **Satu pola port**: frontend `80xx`, backend `40xx`, semuanya terdaftar di `config/ports.js`. Database setiap app di `data/<app>/`.
- **Satu launcher**: `runner.js` di root menyalakan seluruh sistem; `--only=simklinik` / `--only=portal` untuk sebagian.

## 3. Langkah membuat portal

1. ~~**Siapkan folder** `apps/portal/` (Next.js) dan `services/identity/` (NestJS).~~ Selesai.
2. ~~**Identity service** — port `4010`, database `data/identity/identity.sqlite`~~ Selesai: `users`, `patients`, `app_access`, `app_registry`, `service_keys`, lengkap dengan endpoint.
3. ~~**Portal dashboard** — port `8082`~~ Selesai: login, beranda kartu aplikasi dengan status hidup/mati, data pasien, pengguna & hak akses, daftar aplikasi, profil.
4. ~~**Sesuaikan setiap app agar menerima token portal**~~ Selesai untuk SIMKlinik lewat halaman `/sso` (`apps/simklinik-web/src/app/sso/`) dan route `/api/sso/redeem`; backend memeriksa `aud`.
5. ~~**Launcher terpadu** — `runner.js`~~ Selesai.
6. **Uji tanpa mengganggu production** — pakai `MODE_PENGEMBANGAN.bat` (port 8083/8081).

## 4. Menambah app baru yang terintegrasi portal

Urutan ini bisa diulang untuk setiap modul baru (mis. apotek, kasir, laboratorium):

1. **Tentukan kode & port.** Contoh: kode `apotek`, frontend `8084`, backend `4002`, database `data/apotek/apotek.sqlite` — jangan pakai port yang sudah dipakai (8080/8081/4000/4001/4010/8082).
2. **Buat backend** di `apps/<kode>-api/` dari pola `apps/simklinik-api/`:
   - Salin `apps/simklinik-api/src/database/database.service.ts`, ubah nama file database, dan **pertahankan gaya migrasi yang idempoten** (`CREATE TABLE IF NOT EXISTS`) — kode itu berjalan setiap start dan tidak merusak data lama.
   - Baca port dari `process.env.PORT` dan bind ke `0.0.0.0` agar bisa diakses dari jaringan (`apps/simklinik-api/src/main.ts`). Path data dan rahasia ikuti pola `src/config/paths.ts` (berbasis `KLINIK_ROOT`).
   - Pindahkan modul `auth/` apa adanya agar guard per peran (`roles.decorator.ts`, `roles.guard.ts`) langsung berfungsi.
   - Tambahkan `GET /api/health` sebagai penanda status untuk portal.
3. **Buat frontend** di `apps/<kode>-web/` dari pola `apps/simklinik-web/`: `distDir` dari `process.env.NEXT_DIST_DIR`, rewrite `/api/:path*` ke port backend lewat `process.env.BACKEND_PORT` (lihat `apps/simklinik-web/next.config.mjs`), dan helper `src/lib/api.ts` yang mengambil token dari `localStorage`.
4. **Sambungkan ke identitas, bukan menyalin data.** App baru menyimpan `patient_id` dari identity service. Jangan buat tabel pasien kedua — inilah yang membuat data ganda muncul di kemudian hari.
5. **Daftarkan di portal.** Tambahkan satu baris ke `app_registry` (kode, nama, URL frontend, URL backend). Kartu aplikasi muncul otomatis di beranda portal tanpa mengubah kode portal.
6. **Daftarkan port** di `config/ports.js` dan tambahkan prosesnya di `runner.js`.
7. **Mode dev dan production tetap terpisah.** Ikuti pola penanda `.env.local` milik SIMKlinik: ada penanda = database dev, tidak ada = database production.
8. **Verifikasi sebelum deploy:** jalankan mode dev app baru, cek login SSO dari portal, cek halaman tidak error, lalu deploy dengan skrip yang mencadangkan database lebih dulu.

## 5. Catatan integrasi dengan SIMKlinik

**Data pasien saat ini masih tercatat per transaksi, bukan satu identitas.** `vaccination_records` (`apps/simklinik-api/src/database/database.service.ts:103`) dan `mcu_reports` (`:205`) masing-masing menyimpan `nik + fullName + birthDate + address` dan seterusnya. Pasien yang pernah vaksinasi lalu MCU akan punya dua baris, dan tidak ada tabel pasien tunggal yang menjadi acuan. Karena sistem surat & laporan **butuh data pasien**, inilah pekerjaan integrasi yang sebenarnya.

**Urutan pengerjaan yang menghindari input ganda:**

1. **Identity service lebih dulu** (`services/identity/`, port `4010`) berisi `patients(nik UNIQUE, fullName, gender, birthPlace, birthDate, address, phoneWa, email, occupation, maritalStatus)` — gabungan kolom yang sudah ada di `vaccination_records`. Semua field ini wajib ada agar app pendukung tidak perlu menebak umur/jenis kelamin.
2. **Impor pasien lama** ke identity service: `INSERT OR IGNORE` berdasarkan NIK dari `vaccination_records` lalu `mcu_reports`; baris tanpa NIK dibiarkan sebagai data lama saja dan ditandai untuk pengecekan manual. No. ICV, hasil skrining WUS, dan nomor laporan **tidak** ikut dipindah — itu milik transaksinya.
3. **Tambah kolom `patientId`** ke `vaccination_records` dan `mcu_reports` lewat migrasi `ALTER TABLE ... ADD COLUMN` di `runMigrations()` (pola yang sudah dipakai di `:231`), lalu isi dengan mencocokkan NIK. Kolom lama `fullName`/`nik` tetap ada sebagai arsip dan pembanding — jangan langsung dihapus.
4. **SIMKlinik membaca pasien dari identity service** saat registrasi baru, bukan mengetik ulang. Simpan salinan nama/NIK saat transaksi agar cetak PDF lama tetap utuh meski data pasien berubah.
5. **Sistem surat & laporan** dibuat setelah langkah 1–3 untuk **surat keluar** (surat sakit dan sejenisnya): hanya menyimpan `patientId` + nomor surat, data pasien diambil lewat `GET /api/patients/:id` dari identity service. Surat **internal** (pengajuan, pengadaan, dll) tidak memakai langkah ini sama sekali — lihat bagian 6.

**Yang sudah bisa dipakai sekarang:** token JWT 12 jam (`apps/simklinik-api/src/auth/auth.module.ts`), tiga peran dengan guard (`roles.guard.ts` — Superadmin otomatis lolos semua endpoint), dan autentikasi lewat query `?token=` (`apps/simklinik-api/src/auth/jwt.strategy.ts`), sehingga SSO dari portal bisa jalan tanpa mengubah backend.

**Backup wajib sebelum migrasi:** jalankan `scripts\DEPLOY_PRODUCTION.bat` tidak cukup — salin dulu `data/simklinik/vaksinku.sqlite` beserta `-wal`/`-shm` ke folder terpisah. Langkah 3 mengubah tabel production yang berisi rekam medis.

## 6. App surat & laporan: dua jenis surat

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
- **Ekspor Word dan PDF** memakai kop klinik (`assets/header-hasil.jpeg`) serta blok tanda tangan yang dicetak berurutan dari `letter_signers`. Ini pola yang sudah terbukti di modul MCU — lihat `apps/simklinik-api/src/mcu/mcu-template.ts` dan `apps/simklinik-api/src/export/` untuk cara PDFKit dan ExcelJS dipakai.
- **Arsip dan pencarian** — filter per jenis, per instansi, per rentang tanggal, per status (`draft` / `menunggu tanda tangan` / `terkirim`).
- **Impor template dari Word** — paling praktis: admin mengunggah `.docx` berisi `{{variabel}}`, sistem mengambil tokennya. Ini menghindari admin belajar editor baru dari nol.
- **Riwayat versi template** — surat lama harus tetap tercetak sesuai template saat dibuat dibuat. Simpan salinan isi surat (`payload`) di baris `letters`, jangan hanya menunjuk `templateId`.

**Hak akses:** staf administrasi membuat draft dan surat internal; dokter menandatangani surat keluar; Superadmin mengelola template, pola penomoran, dan kop surat. Guard per peran sudah tersedia di `apps/simklinik-api/src/auth/roles.guard.ts` dan bisa dipakai apa adanya.

## 7. Versi ringkas urutan pengerjaan

| Prioritas | Pekerjaan | Bergantung pada | Status |
| :--- | :--- | :--- | :--- |
| 1 | Identity service (`services/identity/`, port 4010) | — | **Selesai** |
| 2 | Portal dashboard + SSO (port 8082) | 1 | **Selesai** |
| 3 | Impor pasien lama per NIK | 1 | **Siap dijalankan** (`npm run import:patients`) |
| 4 | Migrasi `patientId` di SIMKlinik (uji di mode dev) | 1, 3 | Belum |
| 5 | App surat & laporan: template + surat internal (tidak menunggu 3–4) | 1 | **Selesai** |
| 6 | App surat & laporan: surat keluar bermuatan pasien | 1 | **Selesai** — pasien dibaca langsung dari layanan identitas, tidak menunggu migrasi `patientId` SIMKlinik |

Surat internal sudah bisa dikerjakan setelah langkah 1, karena tidak menyentuh data pasien — jadi ada hasil yang bisa dipakai klinik tanpa menunggu migrasi database yang berisiko.

Urutan pengerjaan yang disarankan berikutnya: **jalankan impor pasien (3) saat klinik sepi**, sekaligus mengecek bentrok NIK yang dilaporkan. Setelah itu baru migrasi `patientId` di mode dev.
